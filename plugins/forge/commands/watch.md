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

# Result marker consumed by Section 3 (notification). Default to "aborted" so
# any abnormal exit (cap hit, error, killed) produces an honest notification
# rather than a false "Ready to merge".
WATCH_RESULT_FILE="${FORGE_RESULT_FILE:-/tmp/forge-watch-result-$PR_NUMBER}"
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
gh pr checks "$PR_NUMBER" --json name,state,bucket
```

Decision (based on `bucket`):
- All `pass` (or `skipping`, e.g. NEUTRAL completion) → ✅
- Any `pending` → ⏳ (wait and re-check; no fix needed)
- Any `fail` or `cancel` → ❌ (needs fixing)

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

The decision tree maps Phase 2's three CI outcomes (✅ / ⏳ / ❌) plus thread and
Changes Requested state to three Phase 3 branches:

| CI | Threads / CR | Branch |
|----|--------------|--------|
| ✅ all pass | 0 / 0 | ✅ All clear (counter +1) |
| ⏳ pending or in_progress | 0 / 0 | ⏳ Hold (counter unchanged) |
| ❌ failure, OR any threads, OR any active CR | — | ❌ Problems found (counter = 0, fix) |

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

Then **return to Phase 1**.

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
rubric is derived from `/code-review:code-review`'s 0-100 confidence scale,
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
unrelated failure. Also match the full set of non-success conclusions that
Phase 2's `cancel`/`fail` buckets cover (raw values: `failure`, `cancelled`,
`timed_out`, `action_required`, `startup_failure`) — otherwise a cancelled or
timed-out run leaves `FAILED_RUN` empty, no fix is pushed, and the loop spins
to `MAX_WATCH_ITER` resetting `CONSECUTIVE_CLEAR` on every iteration.

```bash
FAILED_RUN=$(gh run list --branch "$BRANCH" --limit 5 --json databaseId,conclusion \
  --jq '.[] | select(.conclusion == "failure"
                      or .conclusion == "cancelled"
                      or .conclusion == "timed_out"
                      or .conclusion == "action_required"
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

Post a comment on the PR (use `gh pr comment` or reply to the CR's body via
`gh api repos/$REPO/pulls/$PR_NUMBER/reviews/<REVIEW_ID>/comments` if there's
an inline anchor) asking a specific question. Do not push a commit, so the
timestamp filter does NOT supersede the CR — it will continue to surface on
each iteration. This is expected. Once the reviewer responds (re-submits or
dismisses), the loop converges naturally.

**Invalid → reply with reasoning, do NOT push or auto-dismiss:**

Post a reply explaining the disagreement, e.g. *"After review we believe
this CR may not apply because <reason>. Could you confirm whether to dismiss
or proceed?"* We intentionally never auto-dismiss other people's reviews, so
the CR will persist. On subsequent iterations the loop will continue to
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
| CI checks         | <list any failing or pending check names; "all pass" if none> |
| Review threads    | <N> unresolved |
| Changes Requested | <list reviewers with active CR; "none" if none> |

⚠️ The auto-fix loop reached MAX_WATCH_ITER iterations (or exited abnormally)
   without converging. Do NOT merge without manual review.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Cleanup

```bash
rm -f "$WATCH_RESULT_FILE"
```
