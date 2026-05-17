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

```bash
gh pr checks $PR_NUMBER --json name,state,conclusion 2>/dev/null
```

Decision:
- All `SUCCESS` → ✅
- Any `PENDING` / `IN_PROGRESS` → ⏳ (wait and re-check; no fix needed)
- Any `FAILURE` / `ERROR` → ❌ (needs fixing)

#### Open review threads

Use GitHub's review-thread state (the "Resolved" button), not raw comment counts.
A top-level review comment's `in_reply_to_id` stays `null` even after we reply, so
counting top-level comments would never reach zero and the loop would never exit.

```bash
# Count unresolved, non-outdated threads
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes { id isResolved isOutdated }
        }
      }
    }
  }' \
  -F owner="${REPO%%/*}" -F repo="${REPO#*/}" -F number="$PR_NUMBER" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]
         | select(.isResolved == false and .isOutdated == false)] | length'

# Details (thread id for resolve, REST databaseId of latest comment for reply)
gh api graphql -f query='
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
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.isResolved == false and .isOutdated == false)'
```

Decision:
- 0 → ✅
- ≥1 → ❌ (needs response)

#### Changes Requested reviews

```bash
gh pr view $PR_NUMBER --json reviews \
  --jq '.reviews | group_by(.author.login) | map(last)
        | .[] | select(.state == "CHANGES_REQUESTED")
        | {author: .author.login, body: .body}'
```

Decision:
- 0 → ✅
- ≥1 → ❌ (needs response)

### Phase 3: Decide and branch

#### ✅ All clear

```bash
CONSECUTIVE_CLEAR=$((CONSECUTIVE_CLEAR + 1))
echo "✅ Clear $CONSECUTIVE_CLEAR/2 ($(date '+%H:%M'))"
```

| Counter | Action |
|---------|--------|
| 1 | Keep looping (back to Phase 1) |
| 2 | **Exit loop** → notification |

#### ❌ Problems found

```bash
CONSECUTIVE_CLEAR=0
echo "⚠️ Problems detected — counter reset ($(date '+%H:%M'))"
```

Handle by category:

##### CI failure

Scope the run lookup to this PR's branch — without `--branch`, `gh run list`
returns runs from across all branches and the loop may analyse and "fix" an
unrelated failure:

```bash
FAILED_RUN=$(gh run list --branch "$BRANCH" --limit 5 --json databaseId,conclusion \
  --jq '.[] | select(.conclusion == "failure") | .databaseId' | head -1)
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

### Phase 4: Post-fix wait

After pushing fixes, give CI a moment to start:

```bash
sleep 30
```

Then **return to Phase 1** (5-min wait → re-check).

## CI completion polling (helper)

If CI stays pending for a long time, poll for completion:

```bash
# Up to 20 minutes (every 10 seconds)
for i in $(seq 1 120); do
  PENDING=$(gh pr checks $PR_NUMBER --json state \
    --jq '[.[] | select(.state == "PENDING" or .state == "IN_PROGRESS")] | length')
  [ "$PENDING" -eq 0 ] && break
  sleep 10
done
```

## Example timeline

```
00:00  Watch start (initial check)
00:00  ⚠️ CI failure → fix → push → counter=0
05:00  ✅ Clear 1/2 → counter=1
10:00  ⚠️ Review comment detected → respond → push → counter=0
15:00  ✅ Clear 1/2 → counter=1
20:00  ✅ Clear 2/2 → 🎉 notify
```
