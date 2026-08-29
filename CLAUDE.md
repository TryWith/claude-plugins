# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A Claude Code plugin marketplace published as `TryWith/claude-plugins`. **There is no application code, build pipeline, or test suite** — every "command" is a markdown file that Claude reads and interprets at invocation time. Currently ships one plugin: `forge`.

## Repository layout

- `.claude-plugin/marketplace.json` — marketplace manifest (registers plugins)
- `plugins/<name>/.claude-plugin/plugin.json` — per-plugin manifest
- `plugins/<name>/commands/*.md` — slash command files; frontmatter `description:` exposes each one as `/<plugin>:<command>`. Each command file is self-contained — there is no shared library directory; reuse across commands happens by invoking another slash command (e.g. `/forge:finalize` invokes `/forge:watch`).

## Validation (there is no build/test)

```bash
jq -e . .claude-plugin/marketplace.json
jq -e . plugins/<name>/.claude-plugin/plugin.json
```

Local end-to-end install before pushing:

```bash
/plugin install ./plugins/forge
```

## Non-obvious conventions

### Command files are prompts, not scripts

`finalize.md`, `watch.md`, etc. are read **by Claude as instructions**. The shell snippets inside (`gh ...`, `git ...`) are templates Claude executes and may adapt — substituting variables, translating strings, etc. They are not raw bash scripts.

### i18n: English source, runtime translation

All command files are written in English as the **source language**. At execution time, Claude resolves `$LANG_CODE` per the **Language preamble & i18n contract** section at the top of `plugins/forge/commands/watch.md` (priority: `FORGE_LANG` env var → Claude conversation language → `ja` default) and translates every user-facing string before emitting it. `finalize.md` Step 0 inlines the short preamble snippet but defers to `watch.md` for the full contract.

When editing command files:
- Keep prose and template strings in English
- Do **not** hard-code Japanese / other-language strings into command files — they belong only in the trilingual README
- **Not translated** (intentionally): Conventional Commits prefixes (`fix:`, `feat:`); status emoji (🔭 ✅ ⚠️ 🎉 ⏳ ❌); verdict, severity and disposition labels (`READY`, `NOT READY`, `Blocker`, `Major`, `Minor`, `Fix now`, `Ask`, `Defer`, `Reject`); document-type keys (`spec`, `plan`); perspective names (`Completeness`, `Consistency`, …); and loop-counter lines (`pass n/<cap>`). These are shared across all languages. `watch.md`'s translation-scope table is the canonical list — extend it there and mirror the category here.
- Default user-facing output is Japanese (`ja`), since the primary audience is internal TryWith users.

### Two-level command composition

`/forge:finalize` invokes other commands by name: `/commit-commands:commit-push-pr` (external plugin — must be installed separately) and `/code-review` (Claude Code bundled skill). If a user's environment uses different namespaces, the call sites in `finalize.md` need editing.

### READMEs are trilingual

Both `README.md` files use `[English](#english) | [日本語](#日本語) | [中文](#中文)` with anchor links. When adding or modifying user-facing docs, update **all three** sections — do not let them drift out of sync.

## License

Apache-2.0 (see `LICENSE`). The `plugin.json` `license` field must match. Do not change the license — even if a design document or template suggests otherwise — without explicit user sign-off; license changes have legal implications.
