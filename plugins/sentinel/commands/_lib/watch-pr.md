# PR watch loop

> **i18n note:** strings below (e.g. "Watching started") are source templates.
> Translate every user-facing message at runtime according to `$LANG_CODE`
> (resolved per `_lib/i18n.md`). All emoji stay as-is.

## Initialization

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName')
CONSECUTIVE_CLEAR=0
WATCH_ITER=0
MAX_WATCH_ITER="${SENTINEL_MAX_WATCH_ITER:-24}"   # ~2 h at 5-min interval; override via env
LANG_CODE="${SENTINEL_LANG:-${LANG_CODE:-ja}}"

# Result marker consumed by _lib/notify.md. Default to "aborted" so any abnormal
# exit (cap hit, error, killed) produces an honest notification rather than a
# false "Ready to merge".
WATCH_RESULT_FILE="${SENTINEL_RESULT_FILE:-/tmp/sentinel-watch-result-$PR_NUMBER}"
echo "aborted" > "$WATCH_RESULT_FILE"

# These echoes must be translated to $LANG_CODE before being emitted
echo "🔭 Watching started: PR #$PR_NUMBER ($REPO) on branch $BRANCH"
echo "📋 Interval: 5 min / Exit: 2 consecutive clears / Cap: $MAX_WATCH_ITER iterations"
```

## Loop body

Repeat the steps below **until two consecutive all-clear checks** have occurred.

### Phase 1: Wait and check iteration cap

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

### Phase 2: Gather status

#### CI checks

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

#### Open review threads

Use GitHub's review-thread state (the "Resolved" button), not raw comment counts.
A top-level review comment's `in_reply_to_id` stays `null` even after we reply, so
counting top-level comments would never reach zero and the loop would never exit.

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

#### Changes Requested reviews

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
gh pr view "$PR_NUMBER" --json reviews \
  | jq --arg last "$LAST_COMMIT_AT" '
      .reviews | group_by(.author.login) | map(last)
      | .[] | select(.state == "CHANGES_REQUESTED" and .submittedAt > $last)
      | {author: .author.login, body: .body, submittedAt: .submittedAt}'
```

Decision:
- 0 → ✅ (no active CR — either none, or all superseded by a newer commit)
- ≥1 → ❌ (needs response)

### Phase 3: Decide and branch

The decision tree maps Phase 2's three CI outcomes (✅ / ⏳ / ❌) plus thread and
Changes Requested state to three Phase 3 branches:

| CI | Threads / CR | Branch |
|----|--------------|--------|
| ✅ all pass | 0 / 0 | ✅ All clear (counter +1) |
| ⏳ pending or in_progress | 0 / 0 | ⏳ Hold (counter unchanged) |
| ❌ failure, OR any threads, OR any active CR | — | ❌ Problems found (counter = 0, fix) |

#### ✅ All clear

```bash
CONSECUTIVE_CLEAR=$((CONSECUTIVE_CLEAR + 1))
echo "✅ Clear $CONSECUTIVE_CLEAR/2 ($(date '+%H:%M'))"

if [ "$CONSECUTIVE_CLEAR" -ge 2 ]; then
  echo "success" > "$WATCH_RESULT_FILE"   # consumed by _lib/notify.md
  break                                    # mirror Phase 1's cap-check break
fi
```

| Counter | Action |
|---------|--------|
| 1 | Keep looping (back to Phase 1) |
| 2 | **Exit loop** (`break`) → notification (success) |

#### ⏳ CI pending and no other issues

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

#### ❌ Problems found

```bash
CONSECUTIVE_CLEAR=0
echo "⚠️ Problems detected — counter reset ($(date '+%H:%M'))"
```

Handle by category:

##### CI failure

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

##### Review comment response

Read each unresolved thread, fix the code:

```bash
git add .
git commit -m "fix: address review feedback — <summary>"
git push
```

For each addressed thread, reply to the latest comment AND mark the thread resolved.
Resolving is what flips `isResolved` to `true`, ending the loop's detection of it:

```bash
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

(The reply body must be translated to `$LANG_CODE`; the mutation is language-neutral.)

##### Changes Requested response

```bash
gh pr view $PR_NUMBER --comments
```

Read the requested changes → fix the code → commit and push.
Do **not** automatically `re-request-review`; leave that to the human.

Once a fix commit is pushed, the CR is considered superseded by the timestamp
filter above and will not be re-detected on the next iteration. If the reviewer
submits a fresh CR after our fix, it will surface again (correctly).

### Phase 4: Post-fix wait

After pushing fixes, give CI a moment to start:

```bash
sleep 30
```

Then **return to Phase 1** (5-min wait → re-check).

## CI completion polling (helper)

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

## Example timelines

### Success path (with a hold for pending CI)

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

### Abort path (no convergence, hits cap)

```
00:00  Watch start (initial check)
00:00  ⚠️ Persistent CI failure → fix → push → counter=0
…
2:00:00 ⛔ Reached MAX_WATCH_ITER=24 → break → notify (aborted, "needs attention")
```
