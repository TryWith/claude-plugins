# Language preamble

Resolve the user's preferred output language and use it consistently for the rest of the command.
Full priority rules are in `_lib/i18n.md`.

```bash
LANG_CODE="${SENTINEL_LANG:-ja}"
echo "🌐 Language: $LANG_CODE"
```

All subsequent user-facing output (logs, notifications, commit message bodies, review replies, progress reports) must be translated to `$LANG_CODE` at runtime. The English strings in command and `_lib/` files are source templates, not literal output.
