# Language preamble & i18n spec

This file serves a dual purpose:

1. **Runtime preamble** — the shell snippet Claude executes at the start of
   every Sentinel command to resolve `$LANG_CODE`.
2. **i18n contract** — the canonical specification for what gets translated,
   how language is resolved, what stays in source form, and how to override.

## Runtime preamble

Resolve the user's preferred output language and use it consistently for the
rest of the command.

```bash
LANG_CODE="${SENTINEL_LANG:-ja}"
echo "🌐 Language: $LANG_CODE"
```

All subsequent user-facing output (logs, notifications, commit message bodies,
review replies, progress reports) must be translated to `$LANG_CODE` at
runtime. The English strings in command and `_lib/` files are source
templates, not literal output.

## Language resolution

The shell snippet above only handles the env var and the `ja` default
mechanically. Steps 2 and 3 below are Claude's runtime decisions (LLM
behavior), not encoded in shell. Priority order (highest first):

1. The `SENTINEL_LANG` environment variable (e.g. `ja`, `en`, `zh-CN`, `ko`,
   `fr`, `de` — BCP 47 form)
2. Claude Code's conversation language setting (CLAUDE.md / settings Language
   directive, etc.)
3. The language of the user's most recent message
4. Default: `ja` (Japanese)

## Translation scope

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
| File and command names | ❌ | `/sentinel:finalize` etc. are proper nouns |
| Placeholders in templates | ❌ | `{pr_number}`, `{repo}` are substituted, not translated |

## Translation policy

- The English strings inside each command file are **source templates**, not
  literal output.
- Claude generates the natural-language translation for `$LANG_CODE` at
  runtime.
- Within a single session, do **not** mix languages — stick with the language
  resolved at start.
- If a non-supported language is requested, fall back to `en`.

## Supported languages

Officially verified:

- `ja` — Japanese (default)
- `en` — English (source language)

Other languages (e.g. `zh-CN`, `ko`, `fr`, `de`) work whenever Claude can
translate to them, but naturalness is not guaranteed.

## How to check or override

```bash
# Inspect current setting
echo "SENTINEL_LANG: ${SENTINEL_LANG:-(unset)}"

# Force a language for a single invocation
SENTINEL_LANG=en /sentinel:finalize

# Persist for the shell session
export SENTINEL_LANG=en
/sentinel:finalize
```

## Future extension: static message catalog

The current design relies on Claude's runtime translation. If output
consistency or QA becomes a concern, a static catalog (e.g.
`_lib/messages/{lang}.json`) can be introduced later.
