# PR watch loop

> **i18n note:** strings below (e.g. "Watching started") are source templates.
> Translate every user-facing message at runtime according to `$LANG_CODE`
> (resolved per `_lib/i18n.md`). All emoji stay as-is.

## Initialization

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
CONSECUTIVE_CLEAR=0
LANG_CODE="${SENTINEL_LANG:-${LANG_CODE:-ja}}"

# These echoes must be translated to $LANG_CODE before being emitted
echo "🔭 Watching started: PR #$PR_NUMBER ($REPO)"
echo "📋 Interval: 5 min / Exit: 2 consecutive clears"
```

## Loop body

Repeat the steps below **until two consecutive all-clear checks** have occurred.

### Phase 1: Wait

Skip on the first iteration; otherwise wait 5 minutes:

```bash
echo "⏳ Next check in 5 min ($(date '+%H:%M'))"
sleep 300
echo "🔍 Checking ($(date '+%H:%M:%S'))"
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

#### Open review comments

```bash
# Count
gh api repos/$REPO/pulls/$PR_NUMBER/comments \
  --jq '[.[] | select(.in_reply_to_id == null)] | length'

# Details
gh api repos/$REPO/pulls/$PR_NUMBER/comments \
  --jq '.[] | select(.in_reply_to_id == null) | {
    id: .id,
    path: .path,
    line: .line,
    body: .body,
    user: .user.login
  }'
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

```bash
FAILED_RUN=$(gh run list --limit 5 --json databaseId,conclusion \
  --jq '.[] | select(.conclusion == "failure") | .databaseId' | head -1)
gh run view $FAILED_RUN --log-failed
```

Analyze the log → fix the code → commit and push:

```bash
git add .
git commit -m "fix: CI failure — <concrete fix>"
git push
```

(Subject prefix `fix:` stays English; translate only the body to `$LANG_CODE`.)

##### Review comment response

Read each comment, fix the code:

```bash
git add .
git commit -m "fix: address review feedback — <summary>"
git push
```

After the fix, reply to the comment:

```bash
gh api repos/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies \
  -f body="Addressed. <what was done>"
```

(The reply body must be translated to `$LANG_CODE`.)

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
