# Completion notification

> **i18n note:** all user-facing strings below are source templates.
> Translate them at runtime according to `$LANG_CODE` (per `_lib/i18n.md`).
> All emoji and the Conventional Commits prefix stay as-is.

## Fetch final PR summary

```bash
PR_TITLE=$(gh pr view --json title --jq '.title')
PR_URL=$(gh pr view --json url --jq '.url')
PR_NUMBER=$(gh pr view --json number --jq '.number')
```

## Desktop notification (macOS)

Translate the title and body to `$LANG_CODE` before emitting:

```bash
# Example ($LANG_CODE=en)
osascript -e "display notification \"All CI checks and reviews passed! Ready to merge 🎉\" \
  with title \"Sentinel — PR #$PR_NUMBER complete\" \
  sound name \"Glass\""

# Example ($LANG_CODE=ja)
# osascript -e "display notification \"CI・レビューすべてクリア！マージ可能です 🎉\" \
#   with title \"Sentinel - PR #$PR_NUMBER 完了\" \
#   sound name \"Glass\""
```

## Final terminal report

Emit in the following shape (translate all labels to `$LANG_CODE`; keep emoji as-is):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All checks passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PR #<number>: <title>
🔗 <URL>

| Item              | Result    |
|-------------------|-----------|
| CI checks         | ✅ all pass |
| Review comments   | ✅ 0       |
| Changes Requested | ✅ none    |

🎉 Ready to merge.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
