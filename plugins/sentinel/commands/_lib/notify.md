# Completion notification

> **i18n note:** all user-facing strings below are source templates.
> Translate them at runtime according to `$LANG_CODE` (per `_lib/lang-preamble.md`).
> All emoji and the Conventional Commits prefix stay as-is.

## Determine outcome

`_lib/watch-pr.md` writes the loop outcome to a marker file. Read it and default
to `aborted` if the marker is missing — a missing marker means the loop never
ran to completion or crashed, and a "Ready to merge" notification in that case
would be a false positive that could lead someone to merge a broken PR.

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
WATCH_RESULT_FILE="${SENTINEL_RESULT_FILE:-/tmp/sentinel-watch-result-$PR_NUMBER}"
WATCH_RESULT=$(cat "$WATCH_RESULT_FILE" 2>/dev/null || echo "aborted")
echo "🛰  Outcome: $WATCH_RESULT"
```

## Fetch final PR summary

```bash
PR_TITLE=$(gh pr view --json title --jq '.title')
PR_URL=$(gh pr view --json url --jq '.url')
```

## Desktop notification (macOS)

Branch on `$WATCH_RESULT`. Translate the title and body to `$LANG_CODE`.

```bash
if [ "$WATCH_RESULT" = "success" ]; then
  # Example ($LANG_CODE=en)
  osascript -e "display notification \"All CI checks and reviews passed! Ready to merge 🎉\" \
    with title \"Sentinel — PR #$PR_NUMBER complete\" \
    sound name \"Glass\""
else
  # Aborted: hit MAX_WATCH_ITER, or never converged. Open items remain.
  osascript -e "display notification \"Watch loop aborted before converging — open items remain. Inspect the PR.\" \
    with title \"Sentinel — PR #$PR_NUMBER needs attention\" \
    sound name \"Basso\""
fi
```

## Final terminal report

Two shapes, one per outcome. Translate all labels to `$LANG_CODE`; keep emoji as-is.
For the aborted shape, fill the State column by re-running the Phase 2 queries
from `_lib/watch-pr.md` so the report reflects the current actual state.

### Success shape (`$WATCH_RESULT = success`)

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

### Aborted shape (any other `$WATCH_RESULT`)

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

## Cleanup

```bash
rm -f "$WATCH_RESULT_FILE"
```
