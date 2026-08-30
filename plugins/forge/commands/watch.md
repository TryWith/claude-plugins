---
description: Watch the current PR every 5 minutes and auto-fix until CI and reviews are all green.
---

# /forge:watch

Watch the current PR until it converges (CI green + all review threads resolved
+ no active Changes Requested) for two consecutive 5-minute checks, then
notify. Auto-fix any detected issues along the way.

## Prerequisite

A PR matching the current branch must already exist. If it does not, prefer
running `/forge:finalize` instead.

---

## Section 1: Language preamble & i18n contract

This section serves a dual purpose:

1. **Runtime preamble** — the shell snippet Claude runs at the start of every
   Forge command to resolve `$LANG_CODE`.
2. **i18n contract** — the canonical specification for what gets translated,
   how language is resolved, what stays in source form, and how to override.

### Runtime preamble

Resolve the user's preferred output language and use it consistently for the
rest of the command.

```bash
LANG_CODE="${FORGE_LANG:-ja}"
echo "🌐 Language: $LANG_CODE"
```

All subsequent user-facing output (logs, notifications, commit message bodies,
review replies, progress reports) must be translated to `$LANG_CODE` at
runtime. The English strings throughout this file are source templates, not
literal output.

### Language resolution

The shell snippet above only handles the env var and the `ja` default
mechanically. Steps 2 and 3 below are Claude's runtime decisions (LLM
behavior), not encoded in shell. Priority order (highest first):

1. The `FORGE_LANG` environment variable (e.g. `ja`, `en`, `zh-CN`, `ko`,
   `fr`, `de` — BCP 47 form)
2. Claude Code's conversation language setting (CLAUDE.md / settings Language
   directive, etc.)
3. The language of the user's most recent message
4. Default: `ja` (Japanese)

### Translation scope

| Item | Translate? | Example |
|------|-----------|---------|
| Shell `echo` messages | ✅ | "Watching started" → "監視開始" |
| `osascript` notification title and body | ✅ | "All checks passed!" → "全チェッククリア!" |
| Final summary report labels | ✅ | "CI checks" → "CI チェック" |
| Commit message **body** | ✅ | "address self-review findings" → "自己レビュー指摘事項の修正" |
| Replies to review comments | ✅ | "Addressed." → "対応しました。" |
| Progress updates to the user | ✅ | All of Claude's natural-language replies |
| Conventional Commits prefix | ❌ | `fix:`, `feat:` stay in English |
| Emoji | ❌ | All emoji are language-neutral and shared across every language |
| File and command names | ❌ | `/forge:finalize` etc. are proper nouns |
| Placeholders in templates | ❌ | `{pr_number}`, `{repo}` are substituted, not translated |
| Verdict, severity and disposition labels | ❌ | `Verdict:`, `READY`, `NOT READY`, `Blocker`, `Major`, `Minor`, `Fix now`, `Ask`, `Defer`, `Reject` — machine-readable keys: verdict prefix, verdict and severity from `/forge:review-design`, dispositions shared by `/forge:review-design` (`Fix now` / `Ask` / `Reject`) and `/forge:finalize` (`Fix now` / `Defer` / `Reject`). **Untranslated as labels only** — on a report row, a `Disposition:` line, a triage heading. The same word running inside a sentence is prose and is translated, so `/forge:finalize`'s "Fix now, defer to a follow-up, or accept the risk?" still reads naturally in `$LANG_CODE` |
| Document type keys | ❌ | `spec`, `plan` — `/forge:review-design` emits them on its report header line and in its `— not applicable (<type>)` rows |
| Perspective names | ❌ | `Completeness`, `Consistency`, `Repo Grounding`, `Blind Spots`, `Buildability`, `Scope`, `Assumptions`, `Alternatives`, `YAGNI`, `Acceptance` — `/forge:review-design` emits the names in English and translates only their descriptions |
| Loop-counter lines | ❌ | `pass n/<cap>` — `/forge:review-design` reads its own pass count back out of the transcript by matching this literal, so a translated line is unreadable to it |

### Translation policy

- The English strings inside each command file are **source templates**, not
  literal output.
- Claude generates the natural-language translation for `$LANG_CODE` at
  runtime.
- Within a single session, do **not** mix languages — stick with the language
  resolved at start.
- If a non-supported language is requested, fall back to `en`.

### Supported languages

Officially verified:

- `ja` — Japanese (default)
- `en` — English (source language)

Other languages (e.g. `zh-CN`, `ko`, `fr`, `de`) work whenever Claude can
translate to them, but naturalness is not guaranteed.

### How to check or override

```bash
# Inspect current setting
echo "FORGE_LANG: ${FORGE_LANG:-(unset)}"

# Force a language for a single invocation
FORGE_LANG=en /forge:finalize

# Persist for the shell session
export FORGE_LANG=en
/forge:finalize
```

### Future extension: static message catalog

The current design relies on Claude's runtime translation. If output
consistency or QA becomes a concern, a static catalog
(e.g. `commands/messages/{lang}.json`) can be introduced later.

---

## Section 2: Watch loop

### Initialization

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName')
CONSECUTIVE_CLEAR=0
WATCH_ITER=0
MAX_WATCH_ITER="${FORGE_MAX_WATCH_ITER:-24}"   # ~2 h at 5-min interval; override via env
STUCK_THRESHOLD="${FORGE_STUCK_THRESHOLD:-6}"  # consecutive pending iters before a check is flagged "stuck" (~30 min); override via env

# Cross-iteration state for the "neither red nor green" handling (Phase 2/3).
# Stored in files, NOT shell vars / associative arrays: each iteration may run
# as a separate shell, so in-memory state wouldn't survive, and macOS ships
# bash 3.2 which has no associative arrays.
#
# They live under the repository's git directory rather than /tmp. A /tmp path
# keyed on the PR number alone collides whenever two repositories watch the same
# PR number — one clobbers the other's streak counts. `git rev-parse
# --absolute-git-dir` is repository-scoped by construction, and resolves per
# worktree (a linked worktree gets .git/worktrees/<name>), which is the right
# granularity: one worktree, one branch, one PR. Anything under the git
# directory is also invisible to `git status`, so watch state can never be
# mistaken for a working tree change. Use `--absolute-git-dir`, not plain
# `--git-dir`: the latter prints a relative `.git` at the repository root, which
# would point somewhere else the moment a later block runs from another cwd.
# `finalize.md` Step 2 uses the same convention.
#
# These three paths are re-derived, not carried over, by any later block that
# needs them (Section 3 and Cleanup) — see the re-derive preamble there.
#   - STREAK_FILE:   per-check pending streak, one "<count>\t<check name>" line each
#   - NOTIFIED_FILE: space-joined set of awaiting-human check names last notified,
#                    so a long approval wait doesn't re-notify every 5 minutes
FORGE_STATE_DIR="$(git rev-parse --absolute-git-dir)/forge"
mkdir -p "$FORGE_STATE_DIR"
STREAK_FILE="${FORGE_STREAK_FILE:-$FORGE_STATE_DIR/pending-streak-$PR_NUMBER}"
NOTIFIED_FILE="${FORGE_NOTIFIED_FILE:-$FORGE_STATE_DIR/blocked-notified-$PR_NUMBER}"
: > "$STREAK_FILE"
: > "$NOTIFIED_FILE"

# Result marker consumed by Section 3 (notification). Default to "aborted" so
# any abnormal exit (cap hit, error, killed) produces an honest notification
# rather than a false "Ready to merge".
WATCH_RESULT_FILE="${FORGE_RESULT_FILE:-$FORGE_STATE_DIR/watch-result-$PR_NUMBER}"
echo "aborted" > "$WATCH_RESULT_FILE"

# These echoes must be translated to $LANG_CODE before being emitted
echo "🔭 Watching started: PR #$PR_NUMBER ($REPO) on branch $BRANCH"
echo "📋 Interval: 5 min / Exit: 2 consecutive clears / Cap: $MAX_WATCH_ITER iterations"
```

### Loop body

Repeat the steps below **until two consecutive all-clear checks** have occurred.

#### Phase 1: Wait and check iteration cap

Increment the iteration counter and bail if the cap was hit.
Skip the 5-minute wait on the first iteration; otherwise wait:

```bash
WATCH_ITER=$((WATCH_ITER + 1))
if [ "$WATCH_ITER" -gt "$MAX_WATCH_ITER" ]; then
  echo "⛔ Reached MAX_WATCH_ITER=$MAX_WATCH_ITER without converging. Aborting and reporting."
  # WATCH_RESULT_FILE already holds "aborted" from initialization; leave as-is
  break
fi

if [ "$WATCH_ITER" -gt 1 ]; then
  echo "⏳ Iter $WATCH_ITER/$MAX_WATCH_ITER — next check in 5 min ($(date '+%H:%M'))"
  sleep 300
fi
echo "🔍 Iter $WATCH_ITER/$MAX_WATCH_ITER — checking ($(date '+%H:%M:%S'))"
```

#### Phase 2: Gather status

##### CI checks

`gh pr checks --json` does **not** accept `conclusion` (only `bucket`, `state`,
`name`, `completedAt`, etc.). Use `bucket` — it's the derived tri-state that
collapses raw check states into pass / fail / pending / skipping / cancel.

```bash
gh pr checks "$PR_NUMBER" --json name,state,bucket,link
```

`bucket` collapses every check into pass / fail / pending / skipping / cancel —
enough for the red/green decision, but it **hides the "neither red nor green,
and won't move without a human" states**: a workflow run held at the "Approve
and run" gate on a fork PR, an environment / deployment protection rule waiting
for a required reviewer, or any check the Checks API reports as `waiting` /
`action_required`. Those land in the `pending` (or `fail`) bucket and, left to
the plain pending branch, would just burn iterations to the cap. Detect them
explicitly so Phase 3 can **surface them to a human** instead of silently
waiting or mis-routing an `action_required` check into the auto-fix path.

```bash
# Raw check-run detail for the PR's head commit. status: queued|in_progress|
# completed|waiting|requested|pending ; conclusion (when completed) includes
# action_required. "Awaiting human" = status waiting/requested OR conclusion action_required.
# Stream objects (not one array per page) so --paginate composes with jq -s below.
HEAD_SHA=$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid')
BLOCKED_FROM_API=$(gh api "repos/$REPO/commits/$HEAD_SHA/check-runs" --paginate \
  --jq '.check_runs[]
        | select(.status == "waiting" or .status == "requested"
                 or .conclusion == "action_required")
        | {name, status, conclusion, link: .html_url}')

# The same gate, when surfaced as a check, shows up in `gh pr checks` raw state
# (ACTION_REQUIRED / WAITING / MANUAL). Union the two sources so neither misses it.
BLOCKED_FROM_CHECKS=$(gh pr checks "$PR_NUMBER" --json name,state,link \
  --jq '.[] | (.state | ascii_upcase) as $s
        | select($s == "ACTION_REQUIRED" or $s == "WAITING" or $s == "MANUAL")
        | {name, status: $s, conclusion: null, link}')

BLOCKED_CHECKS=$(printf '%s\n%s\n' "$BLOCKED_FROM_API" "$BLOCKED_FROM_CHECKS" \
  | jq -s 'unique_by(.name)')
BLOCKED_COUNT=$(echo "$BLOCKED_CHECKS" | jq 'length')
```

Now derive the fail / pending counts **with the blocked checks removed**, so an
`action_required` check (which some `bucket` mappings fold into `fail`) is never
counted as a failure and mis-routed to the log-fetch auto-fix path. `gh --jq`
can't take `--argjson` (cli/cli#10263), so pipe to standalone `jq`:

```bash
BLOCKED_NAME_SET=$(echo "$BLOCKED_CHECKS" | jq '[.[].name]')
CI_RAW=$(gh pr checks "$PR_NUMBER" --json name,bucket)

FAIL_CANCEL_COUNT=$(echo "$CI_RAW" | jq --argjson blocked "$BLOCKED_NAME_SET" '
  [.[] | select(.name as $n | ($blocked | index($n)) | not)
       | select(.bucket == "fail" or .bucket == "cancel")] | length')

PENDING_COUNT=$(echo "$CI_RAW" | jq --argjson blocked "$BLOCKED_NAME_SET" '
  [.[] | select(.name as $n | ($blocked | index($n)) | not)
       | select(.bucket == "pending")] | length')
```

CI decision (**evaluated in this priority order — first match wins**):

1. `FAIL_CANCEL_COUNT` ≥ 1 → ❌ (needs fixing; a failure dominates other still-running checks — don't wait for them)
2. `BLOCKED_COUNT` ≥ 1 → 🔔 (awaiting human action — surface, don't auto-fix; see Phase 3)
3. `PENDING_COUNT` ≥ 1 → ⏳ (wait and re-check; track for stuck detection)
4. Otherwise (all remaining `pass` or `skipping`, e.g. NEUTRAL completion) → ✅

##### Open review threads

Use GitHub's review-thread state (the "Resolved" button), not raw comment counts.
A top-level review comment's `in_reply_to_id` stays `null` even after we reply,
so counting top-level comments would never reach zero and the loop would never
exit.

```bash
# Single GraphQL call returns full thread details; derive count locally.
# Includes thread id (for resolveReviewThread mutation) and the latest comment's
# REST databaseId (for the reply endpoint).
UNRESOLVED_THREADS=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            id isResolved isOutdated path line
            comments(last: 1) { nodes { databaseId body author { login } } }
          }
        }
      }
    }
  }' \
  -F owner="${REPO%%/*}" -F repo="${REPO#*/}" -F number="$PR_NUMBER" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]
         | select(.isResolved == false and .isOutdated == false)]')

UNRESOLVED_COUNT=$(echo "$UNRESOLVED_THREADS" | jq 'length')
echo "$UNRESOLVED_THREADS" | jq '.[]'   # one thread per line, for inspection
```

Decision:
- 0 → ✅
- ≥1 → ❌ (needs response)

##### Changes Requested reviews

A `CHANGES_REQUESTED` state only clears when the human reviewer dismisses or
re-submits the review (we intentionally don't auto-dismiss). To prevent the
loop from re-detecting the same CR forever after we push a fix, treat a CR as
**active** only if it was submitted *after* the most recent commit on the
branch. Once our fix lands, the CR is "superseded — awaiting re-review" and
the loop stops counting it as an open issue.

```bash
LAST_COMMIT_AT=$(gh api repos/"$REPO"/commits/"$BRANCH" --jq '.commit.committer.date')
# Guard against silent fetch failure: an empty $last would make every CR
# satisfy ".submittedAt > \"\"" and the loop would re-detect superseded CRs
# forever, defeating the timestamp filter entirely.
: "${LAST_COMMIT_AT:?failed to fetch latest commit timestamp for $BRANCH}"

# `gh --jq` only accepts a filter string (cli/cli#10263 — no --arg passthrough).
# Pipe to standalone `jq` so we can pass --arg cleanly.
#
# Drop COMMENTED and PENDING reviews before group_by:
#   - GitHub treats a reviewer's "current resolution state" as the latest of
#     APPROVED / CHANGES_REQUESTED / DISMISSED. COMMENTED reviews never change
#     that state, and PENDING reviews are private drafts. Including them
#     means a clarification COMMENT submitted *after* a CHANGES_REQUESTED
#     would be picked by map(last), and the active CR would silently
#     disappear from the filter — causing premature convergence.
gh pr view "$PR_NUMBER" --json reviews \
  | jq --arg last "$LAST_COMMIT_AT" '
      .reviews
      | map(select(.state != "COMMENTED" and .state != "PENDING"))
      | group_by(.author.login) | map(last)
      | .[] | select(.state == "CHANGES_REQUESTED" and .submittedAt > $last)
      | {author: .author.login, body: .body, submittedAt: .submittedAt}'
```

Decision:
- 0 → ✅ (no active CR — either none, or all superseded by a newer commit)
- ≥1 → ❌ (needs response)

#### Phase 3: Decide and branch

The decision tree maps Phase 2's four CI outcomes (✅ / 🔔 / ⏳ / ❌) plus thread
and Changes Requested state to four Phase 3 branches:

| CI | Threads / CR | Branch |
|----|--------------|--------|
| ✅ all pass | 0 / 0 | ✅ All clear (counter +1) |
| 🔔 awaiting human action | 0 / 0 | 🔔 Surface & hold (counter unchanged, notify once) |
| ⏳ pending or in_progress | 0 / 0 | ⏳ Hold (counter unchanged, track stuck) |
| ❌ failure, OR any threads, OR any active CR | — | ❌ Problems found (counter = 0, fix) |

Threads / CR are an **independently actionable axis**: any unresolved thread or
active Changes Requested routes to ❌ **even when CI is 🔔 or ⏳** (those are
things we can act on now, regardless of CI state). The 🔔 and ⏳ branches apply
only when threads and CR are both clear — fix what's actionable first.

##### ✅ All clear

```bash
CONSECUTIVE_CLEAR=$((CONSECUTIVE_CLEAR + 1))
echo "✅ Clear $CONSECUTIVE_CLEAR/2 ($(date '+%H:%M'))"

if [ "$CONSECUTIVE_CLEAR" -ge 2 ]; then
  echo "success" > "$WATCH_RESULT_FILE"   # consumed by Section 3 below
  break                                    # mirror Phase 1's cap-check break
fi
```

| Counter | Action |
|---------|--------|
| 1 | Keep looping (back to Phase 1) |
| 2 | **Exit loop** (`break`) → notification (success) |

##### 🔔 CI awaiting human action

One or more checks are blocked on a human (`BLOCKED_COUNT` ≥ 1): a workflow
approval gate, an environment protection reviewer, or any `waiting` /
`action_required` check. These never clear on their own and there is nothing to
auto-fix — waiting silently just burns iterations to the cap. So **notify the
human once** (and again only when the blocked set changes), then hold exactly
like pending: do **not** touch `CONSECUTIVE_CLEAR`. Once the human approves, the
check resumes and the loop converges naturally on a later iteration.

```bash
BLOCKED_NAMES=$(echo "$BLOCKED_CHECKS" | jq -r '[.[].name] | sort | join(" ")')
PREV_NOTIFIED=$(cat "$NOTIFIED_FILE" 2>/dev/null)

# Notify only when the blocked set differs from what we already told the user,
# so a long approval wait doesn't fire a desktop notification every 5 minutes.
# The osascript body interpolates only the numeric count and PR number — never a
# raw check name — so a job named with a quote can't break the AppleScript literal.
if [ -n "$BLOCKED_NAMES" ] && [ "$BLOCKED_NAMES" != "$PREV_NOTIFIED" ]; then
  echo "🔔 CI awaiting human action — $BLOCKED_COUNT check(s) need approval:"
  echo "$BLOCKED_CHECKS" | jq -r '.[] | "  • \(.name) [\(.conclusion // .status)] — \(.link)"'
  osascript -e "display notification \"$BLOCKED_COUNT CI check(s) awaiting your approval — see terminal for which; they won't proceed without you.\" \
    with title \"Forge — PR #$PR_NUMBER needs approval\" \
    sound name \"Funk\""
  printf '%s' "$BLOCKED_NAMES" > "$NOTIFIED_FILE"
fi
```

(Translate the `echo` lines and the notification title/body to `$LANG_CODE`;
keep emoji, check names, and URLs as-is.) Then **return to Phase 1** — keep
watching so the loop converges the moment the gate is cleared.

##### ⏳ CI pending and no other issues

If CI is still running but threads and Changes Requested are both empty,
the iteration is inconclusive. Do **not** touch `CONSECUTIVE_CLEAR` — neither
increment (no fresh evidence of success) nor reset (no evidence of failure).
This prevents premature convergence and also avoids resetting a hard-won streak
just because CI hasn't finished yet.

```bash
echo "⏳ CI still running — holding at $CONSECUTIVE_CLEAR/2 ($(date '+%H:%M'))"
# Optional: run the CI completion polling helper below to wait this out
```

A plain `pending` bucket is detail-blind: it cannot tell a check that is
progressing from one that is hung or waiting on an external dependency the loop
can't see. Track each check's consecutive-pending streak and surface any that
crosses `STUCK_THRESHOLD`, so a silently-stalled check doesn't just ride the
loop to the cap unnoticed.

State lives in `$STREAK_FILE` (one `<count>\t<name>` line per check) — portable
to bash 3.2 and durable across separate-shell iterations. Each pass rebuilds the
file from the checks that are *still* pending, so any check that cleared is
dropped and its streak naturally resets; names with spaces/parens survive
because the name is the whole tab-delimited second field.

```bash
PENDING_NOW=$(gh pr checks "$PR_NUMBER" --json name,bucket \
  --jq '[.[] | select(.bucket == "pending") | .name] | unique | .[]')

NEW_STREAK=""
while IFS= read -r name; do
  [ -z "$name" ] && continue
  prev=$(awk -F'\t' -v n="$name" '$2 == n { print $1; exit }' "$STREAK_FILE")
  count=$(( ${prev:-0} + 1 ))
  NEW_STREAK="${NEW_STREAK}${count}	${name}
"
  # Fire once, exactly when the streak crosses the threshold (not every iter after).
  # Keep the check name out of the AppleScript literal (injection-safe); the
  # terminal echo carries the specifics.
  if [ "$count" -eq "$STUCK_THRESHOLD" ]; then
    echo "⚠️ '$name' has stayed pending for $STUCK_THRESHOLD checks (~$((STUCK_THRESHOLD * 5)) min) — possibly stuck. Inspect it."
    osascript -e "display notification \"A CI check has been pending ~$((STUCK_THRESHOLD * 5)) min — possibly stuck; see terminal for which.\" \
      with title \"Forge — PR #$PR_NUMBER CI stuck?\" \
      sound name \"Funk\""
  fi
done <<< "$PENDING_NOW"

printf '%s' "$NEW_STREAK" > "$STREAK_FILE"   # checks absent this pass drop out → streak reset
```

(Translate the `echo` / notification strings to `$LANG_CODE`; keep emoji and
check names as-is.) Then **return to Phase 1**.

##### ❌ Problems found

```bash
CONSECUTIVE_CLEAR=0
echo "⚠️ Problems detected — counter reset ($(date '+%H:%M'))"
```

###### Triage before acting (review comments & Changes Requested only)

Not every reported issue is a real issue. Before committing a fix for a review
comment or a Changes Requested review, classify it. CI failures skip triage —
a broken build is unambiguous.

Score the **agreement with the reviewer's point** (not your confidence in your
own counter-argument). Read the cited code carefully before scoring. The
rubric is derived from `/code-review`'s 0-100 confidence scale,
with the threshold split into three classes instead of `/code-review`'s
single `< 80` filter — if you adjust one, keep the other deliberately
aligned.

| Score | Meaning |
|-------|---------|
| **0** | False positive that doesn't survive light scrutiny — wrong line cited, wrong API claim, or the code already does what's requested |
| **25** | Might be a real issue, but unverified; or applies only to a hypothetical that doesn't fit this codebase |
| **50** | Real issue but a nitpick, or unclear whether the reviewer has full project context |
| **75** | Clear real issue; the reviewer's analysis matches the code; fixing aligns with project direction |
| **100** | Definitely real, confirmed by reading the cited code; the fix is obvious |

Map score → action:

| Score | Classification | Action |
|-------|----------------|--------|
| **≥ 75** | **Valid** | Fix → commit → push → reply "Addressed. <what>" → resolve the thread |
| **50–74** | **Ambiguous** | Reply with a specific clarifying question. **Leave the thread unresolved.** The watch loop will re-detect it next iteration — that's expected; it should clear once the human answers. Do not commit speculatively. |
| **< 50** | **Invalid** | Reply explaining the disagreement, then resolve the thread (allowing re-open). Phrase the reply as tentative, e.g. *"After review we believe this may not apply because <reason>. Happy to re-open if you disagree."* Do NOT push a code change. |

Guardrails:

- **Don't auto-accept** review-bot output just because it was posted. False
  positives from review bots are common; silently fixing them dilutes the
  loop's value and trains the team to ignore the bot.
- **Don't auto-reject** a comment because you'd rather not deal with it. A
  real issue mislabelled "Invalid" is worse than addressing a false positive.
- **When in doubt, choose Ambiguous over Invalid** — keep the human in the loop.
- The Invalid action resolves the thread with reasoning attached. Reviewers
  can re-open. This is the right default for a watch loop to converge against
  noisy reviewers, but it does shift the rebuttal burden to the reviewer —
  use it honestly.

For Changes Requested specifically: the GitHub model doesn't expose a
programmatic resolve, and we intentionally never auto-dismiss other people's
reviews. So an Invalid or Ambiguous CR will keep being detected on each
iteration until either (a) the reviewer dismisses or re-submits, or
(b) `MAX_WATCH_ITER` aborts. The aborted notification correctly flags this
as "needs manual attention."

###### Avoid re-classifying stable threads

Re-triaging an unchanged thread on every 5-min iteration is the dominant
per-iteration cost. Skip the classification work and reuse the prior result
when both of the following are true since the last iteration:

- The thread's latest comment `databaseId` is unchanged (no new reply was
  posted by anyone).
- The HEAD SHA of the cited file is unchanged (the code being commented on
  hasn't moved).

This applies especially to threads that were classified **Ambiguous** and
left unresolved — same thread on the same code means the answer hasn't
changed; re-running the rubric will just produce the same Ambiguous verdict
at LLM cost.

Suggested cache key: `threadId + latestCommentDatabaseId + citedFileSha`,
held in an in-memory associative array. Persistence across watch sessions is
not needed (every cron firing starts fresh and re-fetches all threads).

Re-triage is required when **either** key component changes — a new reply,
or a new commit touching the cited file.

Handle by category:

###### CI failure

Scope the run lookup to this PR's branch — without `--branch`, `gh run list`
returns runs from across all branches and the loop may analyse and "fix" an
unrelated failure. Match the non-success conclusions Phase 2's `cancel`/`fail`
buckets cover that are genuinely fixable from logs (raw values: `failure`,
`cancelled`, `timed_out`, `startup_failure`) — otherwise a cancelled or
timed-out run leaves `FAILED_RUN` empty, no fix is pushed, and the loop spins
to `MAX_WATCH_ITER` resetting `CONSECUTIVE_CLEAR` on every iteration.
`action_required` is deliberately **excluded** here: Phase 2 peels those runs
into the 🔔 awaiting-human branch (they have no failure log to fix — they need a
human to approve), so they never reach this fixer.

```bash
FAILED_RUN=$(gh run list --branch "$BRANCH" --limit 5 --json databaseId,conclusion \
  --jq '.[] | select(.conclusion == "failure"
                      or .conclusion == "cancelled"
                      or .conclusion == "timed_out"
                      or .conclusion == "startup_failure") | .databaseId' | head -1)
gh run view "$FAILED_RUN" --log-failed
```

Analyze the log → fix the code → commit and push:

```bash
git add .
git commit -m "fix: CI failure — <concrete fix>"
git push
```

(Subject prefix `fix:` stays English; translate only the body to `$LANG_CODE`.)

###### Review comment response

For each unresolved thread, first classify per **Triage before acting** above,
then act based on the classification.

**Valid → fix, reply, resolve:**

```bash
git add .
git commit -m "fix: address review feedback — <summary>"
git push

# Reply (COMMENT_ID = REST databaseId of latest comment, from the GraphQL query above)
gh api repos/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies \
  -f body="Addressed. <what was done>"

# Resolve the thread (THREAD_ID = GraphQL node id from the same query)
gh api graphql -f query='
  mutation($id: ID!) {
    resolveReviewThread(input: { threadId: $id }) {
      thread { isResolved }
    }
  }' -F id="$THREAD_ID"
```

**Ambiguous → ask clarification, leave unresolved:**

```bash
gh api repos/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies \
  -f body="Quick clarification before we act: <specific question>"
# No resolve mutation. The thread stays unresolved; the loop will surface it
# again on the next iteration. That's expected — it should clear once the
# reviewer answers.
```

**Invalid → reply with reasoning, resolve (allowing re-open):**

```bash
gh api repos/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies \
  -f body="After review we believe this may not apply because <concrete reason citing the code>. Happy to re-open if you disagree."

# Resolve so the loop converges. Reviewers can re-open the thread on GitHub
# if they want to push back.
gh api graphql -f query='
  mutation($id: ID!) {
    resolveReviewThread(input: { threadId: $id }) {
      thread { isResolved }
    }
  }' -F id="$THREAD_ID"
```

(All reply bodies must be translated to `$LANG_CODE`; the mutations are
language-neutral. Commit subject prefixes stay English.)

###### Changes Requested response

```bash
gh pr view $PR_NUMBER --comments
```

Classify the CR per **Triage before acting** above, then act:

**Valid → fix and push:**

Read the requested changes → fix the code → commit and push. Once a fix commit
lands, the CR is considered superseded by the timestamp filter and will not be
re-detected on the next iteration. Do **not** auto-`re-request-review`; leave
that to the human.

**Ambiguous → ask clarification, do NOT push:**

Post a top-level PR comment with `gh pr comment "$PR_NUMBER" --body "..."`
asking a specific clarifying question. Do not push a commit, so the timestamp
filter does NOT supersede the CR — it will continue to surface on each
iteration. This is expected. Once the reviewer responds (re-submits or
dismisses), the loop converges naturally.

(Don't reach for `gh api repos/.../reviews/{id}/comments` — that REST endpoint
is GET-only for listing review comments, not for posting.)

**Invalid → reply with reasoning, do NOT push or auto-dismiss:**

Post a top-level PR comment with `gh pr comment "$PR_NUMBER" --body "..."`
explaining the disagreement, e.g. *"After review we believe this CR may not
apply because <reason>. Could you confirm whether to dismiss or proceed?"*
We intentionally never auto-dismiss other people's reviews, so the CR will
persist. On subsequent iterations the loop will continue to
detect it (the timestamp filter only supersedes via *fix* commits, not via
comments). Eventually either:

- the reviewer dismisses/re-submits → loop converges, OR
- `MAX_WATCH_ITER` is reached → loop aborts with a "needs manual attention"
  notification (correct outcome for a stalled disagreement).

If the reviewer is unresponsive and you're confident the CR is invalid, the
right escalation is a human conversation, not automated dismissal.

#### Phase 4: Post-fix wait

After pushing fixes, give CI a moment to start:

```bash
sleep 30
```

Then **return to Phase 1** (5-min wait → re-check).

### CI completion polling (helper)

If CI stays pending for a long time, poll for completion. Key off `bucket`
(matching Phase 2) rather than raw `state` so QUEUED / WAITING / REQUESTED /
STALE / EXPECTED — all of which Phase 2 treats as pending — are honored here
too. Mismatched filters would let this helper return early while Phase 2 still
sees pending, wasting a full 5-min cycle.

```bash
# Up to 20 minutes (every 10 seconds)
for i in $(seq 1 120); do
  PENDING=$(gh pr checks "$PR_NUMBER" --json bucket \
    --jq '[.[] | select(.bucket == "pending")] | length')
  [ "$PENDING" -eq 0 ] && break
  sleep 10
done
```

### Example timelines

#### Success path (with a hold for pending CI)

```
00:00  Watch start (initial check)
00:00  ⚠️ CI failure → fix → push → counter=0
05:00  ⏳ CI still running, no other issues → counter held at 0
10:00  ✅ All clear → counter=1
15:00  ⚠️ Review comment detected → respond + resolve → push → counter=0
20:00  ⏳ CI still running → counter held at 0
25:00  ✅ All clear → counter=1
30:00  ✅ All clear → counter=2 → 🎉 success notify
```

#### Abort path (no convergence, hits cap)

```
00:00  Watch start (initial check)
00:00  ⚠️ Persistent CI failure → fix → push → counter=0
…
2:00:00 ⛔ Reached MAX_WATCH_ITER=24 → break → notify (aborted, "needs attention")
```

#### Approval-gate path (neither red nor green — surfaced, then converges)

```
00:00  Watch start (initial check)
00:00  🔔 Workflow awaiting "Approve and run" → notify human once → hold (counter=0)
05:00  🔔 Still awaiting approval → same blocked set → no re-notify → hold
…      (human approves on GitHub)
20:00  ⏳ CI now running → hold
25:00  ✅ All clear → counter=1
30:00  ✅ All clear → counter=2 → 🎉 success notify
```

---

## Section 3: Completion notification

Run after the watch loop exits (either via success-`break` or cap-`break`).

### Determine outcome

The watch loop wrote the outcome to `$WATCH_RESULT_FILE`. Read it back and
default to `aborted` if the marker is missing — a missing marker means the
loop never ran to completion or crashed, and a "Ready to merge" notification
in that case would be a false positive that could lead someone to merge a
broken PR.

```bash
# Re-derive, never carry over: this block may run in a shell that never saw the
# Initialization block, and an unset $WATCH_RESULT_FILE would make `cat` read
# nothing and report a false "aborted" on a run that actually succeeded.
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
FORGE_STATE_DIR="$(git rev-parse --absolute-git-dir)/forge"
WATCH_RESULT_FILE="${FORGE_RESULT_FILE:-$FORGE_STATE_DIR/watch-result-$PR_NUMBER}"

WATCH_RESULT=$(cat "$WATCH_RESULT_FILE" 2>/dev/null || echo "aborted")
echo "🛰  Outcome: $WATCH_RESULT"
```

### Fetch final PR summary

```bash
PR_TITLE=$(gh pr view --json title --jq '.title')
PR_URL=$(gh pr view --json url --jq '.url')
```

### Desktop notification (macOS)

Branch on `$WATCH_RESULT`. Translate the title and body to `$LANG_CODE`.

```bash
if [ "$WATCH_RESULT" = "success" ]; then
  # Example ($LANG_CODE=en)
  osascript -e "display notification \"All CI checks and reviews passed! Ready to merge 🎉\" \
    with title \"Forge — PR #$PR_NUMBER complete\" \
    sound name \"Glass\""
else
  # Aborted: hit MAX_WATCH_ITER, or never converged. Open items remain.
  osascript -e "display notification \"Watch loop aborted before converging — open items remain. Inspect the PR.\" \
    with title \"Forge — PR #$PR_NUMBER needs attention\" \
    sound name \"Basso\""
fi
```

### Final terminal report

Two shapes, one per outcome. Translate all labels to `$LANG_CODE`; keep emoji as-is.
For the aborted shape, fill the State column by re-running the Phase 2 queries
above so the report reflects the current actual state.

#### Success shape (`$WATCH_RESULT = success`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All checks passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PR #<number>: <title>
🔗 <URL>

| Item              | Result    |
|-------------------|-----------|
| CI checks         | ✅ all pass |
| Review threads    | ✅ 0 unresolved |
| Changes Requested | ✅ none active |

🎉 Ready to merge.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Aborted shape (any other `$WATCH_RESULT`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ Watch loop aborted — open items remain
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PR #<number>: <title>
🔗 <URL>

| Item              | State |
|-------------------|-------|
| CI checks         | <list any failing / pending / awaiting-approval check names; "all pass" if none> |
| Review threads    | <N> unresolved |
| Changes Requested | <list reviewers with active CR; "none" if none> |

The abort breaks in Phase 1 (cap check) *before* Phase 2 runs that iteration, so
the loop-local `BLOCKED_COUNT` is stale or unset here. **Recompute** the blocked
set fresh by re-running Phase 2's awaiting-human detection (same queries), then,
if any remain, call it out explicitly — a PR stalled on an approval gate looks
identical to a hung CI from the cap alone:

```bash
HEAD_SHA=$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid')
# Union BOTH Phase 2 sources — the Checks API and gh pr checks raw state —
# so a check detectable only via the second source isn't dropped from the report.
BLOCKED_NOW_API=$(gh api "repos/$REPO/commits/$HEAD_SHA/check-runs" --paginate \
  --jq '.check_runs[]
        | select(.status == "waiting" or .status == "requested"
                 or .conclusion == "action_required")
        | {name, status, conclusion, link: .html_url}')
BLOCKED_NOW_CHECKS=$(gh pr checks "$PR_NUMBER" --json name,state,link \
  --jq '.[] | (.state | ascii_upcase) as $s
        | select($s == "ACTION_REQUIRED" or $s == "WAITING" or $s == "MANUAL")
        | {name, status: $s, conclusion: null, link}')
BLOCKED_NOW=$(printf '%s\n%s\n' "$BLOCKED_NOW_API" "$BLOCKED_NOW_CHECKS" \
  | jq -s 'unique_by(.name)')
[ "$(echo "$BLOCKED_NOW" | jq 'length')" -ge 1 ] && \
  echo "$BLOCKED_NOW" | jq -r '"🔔 CI checks awaiting human approval (loop cannot clear these itself):",
                               (.[] | "  • \(.name) [\(.conclusion // .status)] — \(.link)")'
```

⚠️ The auto-fix loop reached MAX_WATCH_ITER iterations (or exited abnormally)
   without converging. Do NOT merge without manual review.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Cleanup

```bash
# Same re-derive as Section 3 — an unset path would make every `rm -f` a no-op
# and leave stale streak counts for the next run on this PR to read.
PR_NUMBER=${PR_NUMBER:-$(gh pr view --json number --jq '.number')}
FORGE_STATE_DIR="$(git rev-parse --absolute-git-dir)/forge"

rm -f "${FORGE_RESULT_FILE:-$FORGE_STATE_DIR/watch-result-$PR_NUMBER}" \
      "${FORGE_STREAK_FILE:-$FORGE_STATE_DIR/pending-streak-$PR_NUMBER}" \
      "${FORGE_NOTIFIED_FILE:-$FORGE_STATE_DIR/blocked-notified-$PR_NUMBER}"
```
