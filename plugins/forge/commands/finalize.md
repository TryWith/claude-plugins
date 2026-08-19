---
description: Run the full post-implementation workflow — commit, push, PR, code-review --fix loop, conditional security-review, CI/review watch, and notify on completion.
---

# /forge:finalize

Run the full post-implementation workflow. Do **not** advance to the next step until the current one fully completes.

## Step 0: Determine output language

Resolve the user's preferred output language and use it consistently for the
rest of the command. See the **Language preamble & i18n contract** section of
`watch.md` for the full priority rules (env var → Claude conversation language
→ user message language → `ja` default), translation scope, and override
options.

```bash
LANG_CODE="${FORGE_LANG:-ja}"
echo "🌐 Language: $LANG_CODE"
```

All subsequent user-facing output (logs, notifications, commit message bodies,
review replies, progress reports) must be translated to `$LANG_CODE` at
runtime.

## Step 0.5: Pre-flight — verify required dependencies

Before invoking any external slash command, verify that the skills it needs are
loaded in the current Claude Code session, split by **when** they are needed:

**Required — Step 1 always runs, so abort up front if it is missing:**

| Required slash command | Provided by | How to install |
|------------------------|-------------|----------------|
| `/commit-commands:commit-push-pr` | `commit-commands` plugin | `/plugin install commit-commands` |

**Runtime-gated — Step 2 resolves this by attempting the call; do NOT check for
it here and do NOT abort if it looks unavailable:**

| Slash command | Provided by | Note |
|---------------|-------------|------|
| `/code-review --fix` | Claude Code built-in | Whether Claude may launch it is a runtime feature gate, not a version fact. Step 2 tries it and falls back to prompting the user only if refused — see Step 2 for the full rationale. |

**Conditional — Step 3 runs `/security-review` only when the diff is
security-relevant, so do NOT abort up front for it:**

| Conditional slash command | Provided by | How to install |
|---------------------------|-------------|----------------|
| `/security-review` | Claude Code bundled skill | Built-in (only fails if the user disabled it) |

Consult the **available skills list** (visible in this session's
system-reminder messages, or via `/help`) to confirm each command is loaded.
If any of the **required** commands is missing, do **not** proceed — Claude
Code will reject the invocation mid-chain with an opaque "skill not found"
error after partial work has been done. Instead, report exactly which ones are
missing with the install hints from the table above, then abort:

```
⚠️ /forge:finalize cannot run — the following required commands are missing:
  • /commit-commands:commit-push-pr   →  /plugin install commit-commands

Install/enable the missing items, run /reload-plugins, then re-invoke /forge:finalize.
```

(Translate the message above to `$LANG_CODE`; keep the slash command names
and install hints as-is — they are proper nouns.)

A missing `/security-review` does **not** block startup — it is invoked only
conditionally in Step 3. If Step 3 later finds the diff security-relevant but
`/security-review` is unavailable, it warns and skips the security pass instead
of aborting (commit / PR / watch are already done by then).

`/forge:watch` for Step 4 is internal to forge itself — if `/forge:finalize`
loaded, `/forge:watch` is also available, so no check needed there.

## Step 1: Commit, push, and open a PR

Invoke the slash command:

```
/commit-commands:commit-push-pr
```

If this fails with "skill not found" (preflight should have caught this —
backstop), report `/plugin install commit-commands` and abort. After it
completes, capture the **PR number** and **PR URL** for later steps:

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
PR_URL=$(gh pr view --json url --jq '.url')
echo "📋 PR #$PR_NUMBER: $PR_URL"
```

## Step 2: Code-review auto-fix loop

`/code-review --fix` finds issues **and applies the fixes to the working tree
automatically**. Repeat until a run produces no further changes.

> **Always pass `--fix`.** Plain `/code-review` reports findings without
> touching the working tree, so the loop below would have nothing to converge
> on — the parent would have to re-derive and re-apply every finding by hand.
> `--fix` keeps the fixing inside the agent that already holds the review
> context.
>
> Call the **built-in** `code-review`. Never the plugin skill
> `code-review:code-review` — see the note at the end of this section — and
> never retry a refused built-in call against the plugin as a substitute.

> **Whether Claude may start this review is decided at runtime — attempt it,
> never predict it.**
> `/code-review` does not carry a static `disable-model-invocation` flag; the
> built-in resolves it through a **runtime feature gate**, so the very same
> Claude Code build permits model invocation in some sessions and refuses it in
> others. Never branch on the Claude Code version — it does not predict the
> gate. Step 2 makes the call and branches on the actual result.
>
> If the attempt **is** refused, that refusal is a deliberate guard, not a bug.
> Fall back to the manual prompt in 2-2; do **not** route around it via
> `claude -p "/code-review --fix"` from Bash (the permission classifier blocks
> that too, by design).
>
> Note `code-review:code-review` (the marketplace plugin) is always
> model-invocable, but it is a **different command** — it posts a review
> comment on the PR and never touches the working tree, so it cannot drive this
> loop. Do not substitute it.

### 2-1. Initialise loop state

Loop state lives in **files under the repository's git directory**
(`$(git rev-parse --absolute-git-dir)/forge/`): each Bash call runs in a fresh
shell, so plain shell variables would reset every iteration — silently defeating both the
cap and the stickiness rule in 2-2. That applies to the *paths* of those files
as much as to the state inside them, so the paths get re-derived in every Step 2
Bash block, never carried over from Step 1.

`.git/forge/` rather than `/tmp/forge-*` for two reasons, both load-bearing:

- **It is scoped to this repository by construction.** A `/tmp` path keyed on
  the PR number alone collides whenever two repositories run `/forge:finalize`
  on the same PR number — one clobbers the other's baseline. `git rev-parse
  --absolute-git-dir` also resolves per *worktree* (a linked worktree gets
  `.git/worktrees/<name>`), which is exactly the right scope: one worktree, one
  branch, one PR. Use `--absolute-git-dir`, never plain `--git-dir`: the latter
  prints a *relative* `.git` when the shell's cwd happens to be the repository
  root, and that relative string is what gets baked into `FORGE_STATE_DIR` when
  the env file is sourced — so a block that `cd`s anywhere would then read and
  write a different set of state files.
- **`git status` cannot see it.** State kept anywhere inside the working tree
  would show up in `forge_snapshot` below and be mistaken for a change the
  review made. Everything under the git directory is invisible to
  `git status`, so the state and the change detection cannot interfere.

Run this block **once**, at the start of Step 2. It writes a small sourceable
env file holding everything the later blocks need:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
mkdir -p "$(git rev-parse --absolute-git-dir)/forge"
REVIEW_ENV_FILE="${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"

# Quoted heredoc: nothing below is expanded now — it resolves when sourced,
# against the $PR_NUMBER the sourcing block re-derived for itself.
cat > "$REVIEW_ENV_FILE" <<'FORGE_ENV'
FORGE_STATE_DIR="$(git rev-parse --absolute-git-dir)/forge"
MAX_REVIEW_LOOP="${FORGE_MAX_REVIEW_LOOP:-10}"
REVIEW_LOOP_FILE="${FORGE_REVIEW_LOOP_FILE:-$FORGE_STATE_DIR/review-loop-$PR_NUMBER}"
REVIEW_TREE_FILE="${FORGE_REVIEW_TREE_FILE:-$FORGE_STATE_DIR/review-tree-$PR_NUMBER}"
# Working buffers. The durable home for deferred findings is the PR comment
# posted at the end of Step 2 — this file only carries them until then.
REVIEW_DEFERRED_FILE="${FORGE_REVIEW_DEFERRED_FILE:-$FORGE_STATE_DIR/review-deferred-$PR_NUMBER}"
REVIEW_TREND_FILE="${FORGE_REVIEW_TREND_FILE:-$FORGE_STATE_DIR/review-trend-$PR_NUMBER}"

# Snapshot the working tree as one sorted "<path><TAB><content-hash>" line per
# dirty-or-untracked path. Three details matter:
#   -z            git C-quotes paths with spaces or non-ASCII bytes under plain
#                 --porcelain ("\346\227\245...") and `git add` cannot consume
#                 that form; -z emits raw paths.
#   -uall         without it an untracked directory collapses to one "?? dir/"
#                 entry, hiding new files added inside it.
#   --no-renames  keeps every entry a single path, never "old -> new".
# The content hash is what makes an edit to an *already dirty* path visible:
# the porcelain status line alone is byte-identical before and after such an
# edit, which would otherwise read as convergence and drop the fix on the floor.
forge_snapshot() {
  git status --porcelain -z -uall --no-renames \
    | tr '\0' '\n' | cut -c4- \
    | while IFS= read -r p; do
        [ -n "$p" ] || continue
        printf '%s\t%s\n' "$p" "$(git hash-object -- "$p" 2>/dev/null || echo absent)"
      done \
    | LC_ALL=C sort -u
}
FORGE_ENV

. "$REVIEW_ENV_FILE"
echo 0 > "$REVIEW_LOOP_FILE"
```

Every later Step 2 Bash block opens with the same two-line preamble:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
. "${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"
```

`REVIEW_MODE` (`""` undecided → `auto` or `manual`) is the one piece of state
that is *not* a shell value — it is a decision Claude carries in the
conversation. 2-2 is the only place that sets it, and only the
model-invocation-declined branch makes it stick.

### 2-2. Start the review

Check the cap **before** starting anything: if `REVIEW_LOOP` has already reached
`MAX_REVIEW_LOOP`, do not start another review — go to **2-7**. Otherwise
increment it, snapshot the working tree so 2-3 can tell what this review
changed, and start the review:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
. "${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"

# Default to the cap, not to 0: an unreadable counter must fail *closed*.
# `$(( $(cat missing) + 1 ))` evaluates to 1 without erroring, which would pin
# the counter at 1 forever and let the loop run unbounded.
REVIEW_LOOP=$(cat "$REVIEW_LOOP_FILE" 2>/dev/null) || REVIEW_LOOP=""
case "$REVIEW_LOOP" in ''|*[!0-9]*) REVIEW_LOOP="$MAX_REVIEW_LOOP" ;; esac

if [ "$REVIEW_LOOP" -ge "$MAX_REVIEW_LOOP" ]; then
  echo "cap-reached"        # → 2-7 exit handling; do NOT start another review
else
  REVIEW_LOOP=$((REVIEW_LOOP + 1))
  echo "$REVIEW_LOOP" > "$REVIEW_LOOP_FILE"
  forge_snapshot > "$REVIEW_TREE_FILE"   # pre-review baseline
  echo "iteration $REVIEW_LOOP/$MAX_REVIEW_LOOP"
fi
```

Then, unless `REVIEW_MODE` is already `manual`, start the review yourself by
calling the **`Skill` tool** (not by printing a slash command) with skill
`code-review` — the unprefixed built-in, never `code-review:code-review` — and
args `--fix`.

Branch on what comes back:

- **It starts** → set `REVIEW_MODE=auto`, tell the user the review is running,
  and continue to the completion wait below. Nothing is asked of the user this
  iteration.

  ```
  🔭 Step 2: code review running automatically — PR #<PR_NUMBER> · iteration <REVIEW_LOOP>/<MAX_REVIEW_LOOP>
  ```

  (Translate to `$LANG_CODE`; keep the command name and emoji as-is.)

- **Model invocation is declined** — the tool result refuses on
  invocation-policy grounds (e.g. a `disable-model-invocation` rejection) and
  tells you to ask the user to run the command instead → set
  `REVIEW_MODE=manual`, print the prompt below, and **stop and wait**.

  This is the **only** branch that makes `manual` sticky: the gate is fixed for
  the session, so every later attempt is refused identically and re-trying just
  adds noise. Later iterations go straight to the prompt.

- **The command does not exist** — skill not found, or disabled by the user →
  the manual route cannot help either, because the user typing
  `/code-review --fix` hits the same missing command. Do **not** prompt. Warn
  and **skip the review loop, then leave Step 2 through 2-8 and 2-9** (they are
  the exit path, not part of the loop) and proceed to Step 3 — exactly as Step 3
  does for a missing `/security-review`:

  ```
  ⚠️ Step 2 skipped — /code-review is not available in this session (not found or disabled).
  ```

  (Translate to `$LANG_CODE`; keep the command name and emoji as-is.)

- **Anything else goes wrong** — a transient tool error, a launch failure →
  fall back to the manual prompt for *this* iteration only. Do **not** set
  `REVIEW_MODE=manual`; a blip must not permanently downgrade a session whose
  gate would have allowed the automatic route on the next pass.

Manual prompt (used by the declined branch and the transient-error branch):

```
⏳ Step 2 needs you — this session does not let Claude start a code review.

    Type:  /code-review --fix

I'll pick the workflow back up automatically once it finishes.
(PR #<PR_NUMBER> · iteration <REVIEW_LOOP>/<MAX_REVIEW_LOOP>)
```

(Translate to `$LANG_CODE`; keep the command name and emoji as-is.)

**Waiting for completion.** `/code-review --fix` usually runs as a **background
subagent** that hands control back to the conversation before it has finished.
Whenever the run is backgrounded — in either mode — wait for its completion
notification before inspecting the working tree; reading `git diff` mid-run
sees a half-applied state. If instead the review completes inline and returns
its result in the same turn, that returned result **is** the completion signal
— go straight to 2-3. This applies to both modes: never sit waiting for a
notification that will never arrive.

**Keep the review's report.** 2-3 and 2-4 both need the findings it returned,
not just the edits it made. Do not discard the completion result after reading
whether it succeeded.

**Confirm the review actually ran.** A review that errored, was cancelled, or
hit a limit leaves the tree untouched — indistinguishable in 2-3 from a genuine
convergence, which would silently advance an unreviewed PR toward merge. If the
completion signal reports failure or cancellation rather than a finished
review, treat it as the transient-error branch above (re-prompt / retry, and do
not count it as convergence).

`--fix` applies fixes directly to the working tree. It does **not** commit or
push — that's the next step.

If the user declines to run it in `manual` mode, **skip the review loop, leave
Step 2 through 2-8 and 2-9, and proceed to Step 3**, stating plainly that the
code review was skipped at their request. 2-8 and 2-9 are not part of the loop:
skipping them would strand the deferred findings and leave stale state files for
the next run on this PR to read as a baseline.

### 2-3. Judge the outcome

Convergence is a property of what the review **found**, not of what it changed.
Read both signals before deciding:

1. **The review's own report** — the findings it returned with its completion
   signal, and which of them it says it applied. An empty findings list is the
   only thing that means "nothing left to fix".
2. **The tree delta** — the baseline comparison below.

`--fix` is instructed to skip findings it judges wrong or not worth fixing, so a
review can report real findings and still leave the tree untouched. Treating
that as convergence discards them silently; it is the case this step exists to
catch.

Compare against the baseline 2-2 took **before** this review ran. Comparing
against a baseline — rather than testing whether the tree is dirty — is what
keeps a pre-existing untracked scratch file from being mistaken for a review
fix, committed under a `fix: address code-review findings` message, and looping
forever because it never goes away:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
. "${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"

forge_snapshot > "$REVIEW_TREE_FILE.after"
cmp -s "$REVIEW_TREE_FILE" "$REVIEW_TREE_FILE.after" && echo "no-tree-delta"

# Record the findings count for the non-convergence check in 2-6. Read the
# iteration back from its file — 2-2's $REVIEW_LOOP was a shell value in a
# different shell, so referencing it here would just write a blank column.
REVIEW_LOOP=$(cat "$REVIEW_LOOP_FILE" 2>/dev/null || echo "?")
echo "$REVIEW_LOOP <count of findings this review reported>" >> "$REVIEW_TREND_FILE"
```

Substitute the `<count …>` placeholder with the actual number before running
this block — exactly as you do for `<summarize…>` in 2-5. Left verbatim it
writes the placeholder text into the trend file and 2-6's check reads garbage.

Then act on the pair:

| Findings | Tree delta | Do this |
|----------|-----------|---------|
| empty | none | **Converged.** → 2-7 |
| non-empty | some | Triage the unapplied ones in 2-4, then commit in 2-5 |
| non-empty | none | Triage in 2-4. If nothing comes out as *Fix now*, → 2-7 — **never re-run the review hoping for a different answer**; it already declined to apply them |
| empty | some | Something outside the review touched the tree. Commit in 2-5, and say so — but **not** under `fix: address code-review findings`: the review found nothing, so use a subject that describes what actually changed |

If the completion signal carries no findings list you can read, fall back to the
tree delta alone and **state that you did**. Never infer an empty findings list
from an unchanged tree — that is the exact inversion this step removes.

### 2-4. Triage what the review did not apply

`--fix` routinely leaves findings alone — in a converged run and a normal one
alike. They are not noise to discard: the reviewer skipped them on its own
narrow view of the diff, without the repo's conventions, the user's intent, or
this conversation. You have all three.

Give **every** unapplied finding exactly one outcome, in writing:

- **Fix now** — a correctness or data-loss defect in this change set, or a
  violation of a convention this repo documents (`CLAUDE.md`, an established
  pattern in a sibling command). Apply it yourself.
- **Defer** — real, but out of this PR's scope: it needs a decision, spans files
  this PR does not touch, or would half-change a convention shared with another
  command. Record it — deferring is not dropping.
- **Reject** — wrong, or a false positive. One line of reason.

Default to the reviewer's judgment. Override it to **Fix now** only for the two
categories named above; "it would read a bit nicer" is a **Defer**. Silently
agreeing with a skip is not an outcome — each finding gets one of the three.

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
. "${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"

# Append every Defer. The durable copy is the PR comment posted in 2-8; this
# buffer only has to survive until then.
printf '%s\t%s\n' "<file>:<line>" "<one-line summary>" \
  >> "$REVIEW_DEFERRED_FILE"
```

A finding you classified **Defer** or **Reject** stays classified. If a later
iteration reports it again, restate the recorded outcome and move on — do not
re-litigate it, and do **not** append it to `$REVIEW_DEFERRED_FILE` a second
time (the buffer is never deduplicated, so a re-append becomes a duplicate
bullet in the 2-8 comment). Without this rule the loop can ping-pong on one
contested finding until the cap fires.

Anything in **Fix now** is applied and folded into the same commit as the
review's own fixes, then goes back through 2-2 so the next review sees your
edits too. **Step 2 must never exit with a self-applied fix that no review has
looked at**: 2-5 pushes it, but 2-6 then re-reviews the pushed commit, so a
*Fix now* always costs one more iteration — never take the 2-7 exit directly
after applying one.

### 2-5. Commit and push the applied fixes

Stage exactly the paths this review (and your 2-4 fixes) touched — not
`git add .`, which would sweep unrelated dirt into the commit — then commit and
push:

First, list what changed. This block only reads:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
. "${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"

# Re-take the after-snapshot: 2-3 wrote it *before* 2-4 applied any Fix now
# edits, so the copy on disk is stale here and would miss exactly those paths.
# (The preamble above is what makes `forge_snapshot` and $REVIEW_TREE_FILE
# exist at all — without it this block sees nothing and drops every fix.)
forge_snapshot > "$REVIEW_TREE_FILE.after"

# Lines present in the after-snapshot but not the baseline = paths this review
# created or whose content it changed. Paths that only *disappeared* from the
# snapshot (the review reverted pre-existing dirt) are already back at HEAD —
# nothing to stage for them, which is why only the added side is read.
LC_ALL=C comm -13 "$REVIEW_TREE_FILE" "$REVIEW_TREE_FILE.after" | cut -f1
```

Then stage those paths by **naming them literally** in the next command, using
`-A` so a path the review deleted stages as a deletion:

```bash
git add -A -- <path> [<path> …]
```

> **Do not pipe the list into `git add`.** A loop like
> `… | while IFS= read -r p; do git add -A -- "$p"; done` is blocked: Claude
> Code's permission classifier cannot resolve an argument that only exists at
> runtime, so it sandboxes the call — and inside that sandbox `git` is not on
> `PATH`. The failure surfaces as `command not found: git`, which looks like a
> broken environment and is nothing of the kind, and it poisons the *rest* of
> that Bash invocation: every later command in the same block, `git` or not,
> fails the same way. Verified by reproduction: the identical loop with a
> literal path runs fine, as does `git add` on a variable assigned literally in
> the same shell — only a value arriving through the pipe trips it.

Finally commit and push:

```bash
# A delta made purely of removals stages nothing — don't commit an empty change.
if git diff --cached --quiet; then
  echo "nothing staged"   # treat as a no-op iteration: skip the commit, go to 2-6
else
  git commit -m "fix: address code-review findings

- <summarize the fixes --fix applied>
"
  git push
fi
```

Fill in the `<summarize…>` placeholder before running the commit: use the
review's own returned report when it came back with one, otherwise inspect the
staged change with `git diff --cached` (i.e. after staging, before
`git commit`). Note separately anything you applied yourself in 2-4, so the
commit body distinguishes the review's fixes from your triage. Never invent a
summary.

> Note: the commit subject prefix (`fix:` etc.) stays in English regardless of `$LANG_CODE` — Conventional Commits is language-neutral. Translate only the body.

### 2-6. Re-review

**First, check that the loop is actually converging** — do this *before*
returning to 2-2, not after. Each fix commit enlarges the diff the next review
reads, so the findings count can climb rather than fall:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
. "${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"

tail -3 "$REVIEW_TREND_FILE"
```

If the count has not decreased across three consecutive iterations, say so,
show the trend, and ask the user whether to continue. The cap will stop it
eventually, but silently burning the remaining iterations is not a useful
default. Fewer than three lines means the loop is too young to judge — proceed
without asking.

Then **return to 2-2 and run `/code-review --fix` again** — via `Skill` in
`auto` mode, via the prompt in `manual` mode. 2-2 takes a fresh baseline each
pass, so the convergence signal is a review that leaves the tree identical to
the baseline it started from *and* reports no findings.

In `manual` mode each iteration costs the user one keystroke, so keep the
re-prompt terse — it already carries the iteration counter — and never pad it
with a recap of what was just fixed.

### 2-7. Loop exit conditions

```
Maximum $MAX_REVIEW_LOOP review iterations (default 10, override with FORGE_MAX_REVIEW_LOOP).
If /code-review --fix still applies changes after that many iterations, report
to the user, run 2-8 and 2-9, then proceed to Step 3 — do not abort the run.
```

Hitting the cap means the review is not converging, which is worth reporting —
but Step 1 has already pushed commits to an open PR, so abandoning the run here
would leave that PR with no security pass and no watcher. Degrade to Step 3,
the same way the user-declines path in 2-2 does.

**This section exits *through* 2-8 and 2-9, never around them.** Every arrow
pointing at 2-7 — convergence, cap, "nothing came out as Fix now" — continues
into 2-8 (post the deferred findings) and then 2-9 (drop the state files)
before Step 3 begins.

The counter itself is initialised once in **2-1** and incremented in 2-2 — this
section is a loop-*exit* target only, so re-entering it must never re-run 2-1's
init block.

### 2-8. Record deferred findings on the PR

Every exit path from Step 2 comes through here — convergence, cap, skip, or user
decline. Deferred findings are **decisions with a lifetime longer than this
run**: someone reviewing the PR later is the audience. They therefore live on
the PR itself, not in local state, which 2-9 is about to delete and which does
not survive an interrupted run or a different machine.

Post them as a **single comment, updated in place** rather than one comment per
iteration. Find a previous forge comment by its marker and edit it; create it
only if none exists:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
. "${FORGE_REVIEW_ENV_FILE:-$(git rev-parse --absolute-git-dir)/forge/review-env-$PR_NUMBER.sh}"
[ -s "$REVIEW_DEFERRED_FILE" ] || exit 0        # nothing deferred — no comment

# The marker is a machine key, NOT a user-facing string: it must stay byte-for-
# byte identical across runs and languages or the next run cannot find this
# comment and posts a duplicate. Never translate it. The heading on the next
# line *is* user-facing — translate it to $LANG_CODE, emoji unchanged.
MARKER='<!-- forge:deferred-findings -->'
BODY="$MARKER"$'\n'"### ⏳ Deferred code-review findings"$'\n\n'"$(
  while IFS=$'\t' read -r loc summary; do
    printf -- '- `%s` — %s\n' "$loc" "$summary"
  done < "$REVIEW_DEFERRED_FILE"
)"

# `--edit-last` edits your most recent comment, whatever it is — not the one
# carrying the marker. Only reuse it when your last comment *is* the deferred
# one; otherwise post fresh rather than clobber something else forge said.
# Bail if the login cannot be resolved: an empty $ME matches no comment, which
# would silently take the "post fresh" branch and add a duplicate every run.
ME=$(gh api user --jq '.login') || ME=""
if [ -z "$ME" ]; then
  echo "cannot resolve gh login — skipping the deferred comment" >&2
  exit 1
fi
# `gh --jq` takes one expression and has no `--arg`; pass the login through the
# environment instead of interpolating it into the jq source.
LAST_MINE=$(ME="$ME" gh pr view "$PR_NUMBER" --json comments \
  --jq '[.comments[] | select(.author.login == env.ME)] | last | .body // empty')

case "$LAST_MINE" in
  *"$MARKER"*) COMMENT_URL=$(gh pr comment "$PR_NUMBER" --edit-last --body "$BODY") ;;
  *)           COMMENT_URL=$(gh pr comment "$PR_NUMBER" --body "$BODY") ;;
esac
echo "$COMMENT_URL"   # Step 4 restates this link — keep it
```

Also tell the user directly, in `$LANG_CODE` — a comment they have to go looking
for is not a report:

```
⏳ Step 2 deferred <N> finding(s) — posted to PR #<PR_NUMBER> for review.
```

(Translate to `$LANG_CODE`; keep the emoji and the PR reference as-is.)

Carry the count **and the `$COMMENT_URL` the block printed** forward yourself —
like `REVIEW_MODE`, they are values you hold in the conversation, not files (2-9
deletes the buffer). Step 4 restates both, so a run that deferred anything never
reports as unqualified success.

If this block fails (no `gh` login, comment API error), say so and **still run
2-9** — but keep the deferred list in the conversation and repeat it in Step 4,
since nothing durable was written.

### 2-9. Cleanup

Whichever way Step 2 ends, drop the state files before moving on, mirroring
`watch.md`'s Cleanup section. Leaving them behind lets a later run on the same
PR read a stale baseline. Run this **after** 2-8 — it deletes the deferred
buffer, so posting the comment first is what makes deferring durable rather than
just delayed:

```bash
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
FORGE_STATE_DIR="$(git rev-parse --absolute-git-dir)/forge"
REVIEW_ENV_FILE="${FORGE_REVIEW_ENV_FILE:-$FORGE_STATE_DIR/review-env-$PR_NUMBER.sh}"
# Source it when it exists, but do not depend on it: a run interrupted before
# 2-1 finished leaves the env file missing, and `rm -f ""` would silently clean
# nothing while the stale loop counter and baseline stay behind.
[ -f "$REVIEW_ENV_FILE" ] && . "$REVIEW_ENV_FILE"
REVIEW_LOOP_FILE="${REVIEW_LOOP_FILE:-${FORGE_REVIEW_LOOP_FILE:-$FORGE_STATE_DIR/review-loop-$PR_NUMBER}}"
REVIEW_TREE_FILE="${REVIEW_TREE_FILE:-${FORGE_REVIEW_TREE_FILE:-$FORGE_STATE_DIR/review-tree-$PR_NUMBER}}"
REVIEW_DEFERRED_FILE="${REVIEW_DEFERRED_FILE:-${FORGE_REVIEW_DEFERRED_FILE:-$FORGE_STATE_DIR/review-deferred-$PR_NUMBER}}"
REVIEW_TREND_FILE="${REVIEW_TREND_FILE:-${FORGE_REVIEW_TREND_FILE:-$FORGE_STATE_DIR/review-trend-$PR_NUMBER}}"

rm -f "$REVIEW_LOOP_FILE" "$REVIEW_TREE_FILE" "$REVIEW_TREE_FILE.after" \
      "$REVIEW_DEFERRED_FILE" "$REVIEW_TREND_FILE" "$REVIEW_ENV_FILE"
```

Once `/code-review --fix` converges (a review that reports no findings and
changes nothing relative to its pre-review baseline), proceed to **Step 3**.

## Step 3: Security review (conditional)

`/code-review --fix` covers correctness and cleanup but not security. Decide
whether this change set warrants a dedicated security pass, then run it if so.

### 3-1. Decide whether to run

Inspect the full diff of the PR branch against its base:

```bash
BASE_REF=$(gh pr view --json baseRefName --jq '.baseRefName')
# Use the remote-tracking base: a PR branch's local base (e.g. `main`) is often
# stale or absent, which would make the three-dot diff key off the wrong
# merge-base and skew the security-review trigger.
git diff "origin/$BASE_REF"...HEAD --stat
git diff "origin/$BASE_REF"...HEAD
```

Run `/security-review` if the diff touches **any** security-relevant surface:

- Authentication / authorization / session / access-control logic
- Handling of external or untrusted input (HTTP params, request bodies, file
  uploads, deserialization)
- SQL / shell command / path / template construction (injection surfaces)
- Secrets, credentials, tokens, crypto, or signing
- New or bumped dependencies
- File system, network, or subprocess I/O
- CORS, CSP, cookies, or other web-security headers

If **none** of these apply (e.g. docs-only, pure refactor, test-only, or config
that touches nothing sensitive), **skip** this step, state the reason
explicitly, and proceed to Step 4:

```
🔒 Security review skipped — the diff touches no security-relevant surface (<one-line reason>).
```

(Translate the message to `$LANG_CODE`; keep the emoji and command names as-is.)

### 3-2. Run the security review

```
/security-review
```

If this fails with "skill not found", report that `/security-review` is a
Claude Code bundled skill that may need re-enabling, then **skip the security
pass and proceed to Step 4** — do **not** abort. Commit / PR / review / watch
should still complete; the security pass is an optional, conditional add-on.
`/security-review` is **read-only** — it reports vulnerabilities but does not
apply fixes itself.

### 3-3. Triage findings by severity

`/security-review` classifies findings by severity. Split them and act:

| Severity | Action |
|----------|--------|
| 🔴 Critical / High | **Auto-fix** — fix → commit → push → re-run `/security-review` |
| 🟡 Medium / Low | **Defer to human** — report and ask; do not auto-fix |

#### Critical / High → auto-fix loop

For each Critical or High finding, apply the fix, then commit and push:

```bash
git add .
git commit -m "fix: address security-review findings — <concrete fix>"
git push
```

Then **re-run `/security-review`** (return to 3-2) to confirm the fix and catch
any new findings. Repeat until no Critical / High findings remain.

```
Maximum 5 iterations.
If Critical / High findings still remain after 5 iterations, report to the user and abort.
```

```bash
SEC_LOOP=0
MAX_SEC_LOOP=5
# At the start of each security iteration: SEC_LOOP=$((SEC_LOOP + 1)) and check the cap
```

(Subject prefix `fix:` stays English; translate only the body to `$LANG_CODE`.)

#### Medium / Low → defer to human

Do **not** auto-fix Medium / Low findings. Surface them and let the user decide
before moving on:

```
🔒 Security review found Medium/Low findings that need your decision:

  • [<severity>] <file>:<line> — <summary>
  • …

Fix now, defer to a follow-up, or accept the risk?
(Any Critical/High findings were already auto-fixed above.)
```

(Translate to `$LANG_CODE`; keep emoji, severity labels, file paths, and command
names as-is.) Ask the user how to proceed and act on their answer. Once
Critical / High are cleared and Medium / Low have been surfaced (and handled per
the user's choice), proceed to **Step 4**.

## Step 4: PR watch loop & completion notification

Invoke the slash command:

```
/forge:watch
```

`/forge:watch` runs the full watch loop (5-min interval, exits after 2
consecutive all-clear checks; watches CI / open review threads / Changes
Requested) and, on exit, emits the completion notification (macOS desktop
notification + final terminal summary). Success and aborted outcomes produce
different notifications — see `watch.md` Section 3 for details.

If Step 2 deferred any findings (2-8), restate the count and the PR comment link
alongside that summary. `/forge:watch` reports on CI and reviews only; it knows
nothing about the triage, so an otherwise-green run would read as unqualified
success while real findings sit unaddressed on the PR.
