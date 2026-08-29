---
description: Review a superpowers design document (spec or plan) and judge whether it is ready for implementation.
---

# /forge:review-design

Review a superpowers design document — a spec produced by
`superpowers:brainstorming` or a plan produced by `superpowers:writing-plans` —
against ten perspectives, and report whether it is ready for implementation.

```
/forge:review-design [<path>] [--fix]
```

Without `--fix` this command is **report-only**: it never writes to the target
file, and it never puts findings to the user. That is deliberate — a report
that cannot alter its subject and cannot block on an answer is usable from CI
or a hook as a gate. `--fix` only decides whether to continue past the report;
it never changes how the verdict is computed.

One exception sits outside that guarantee: when `<path>` is omitted, target
resolution may need a single disambiguation question before the review starts
(Section 2). **For unattended use, always pass an explicit `<path>`** — that
skips every question in Section 2 and makes the whole run non-interactive.

## Section 1: Language and arguments

### Language

Resolve the user's preferred output language and use it consistently for the
rest of the command. See the **Language preamble & i18n contract** section of
`watch.md` for the full priority rules (env var → Claude conversation language
→ user message language → `ja` default), translation scope, and override
options.

```bash
LANG_CODE="${FORGE_LANG:-ja}"
echo "🌐 Language: $LANG_CODE"
```

All user-facing prose (findings, reasons, choice labels, progress messages)
is translated to `$LANG_CODE` at runtime. The following stay in English and
are **never** translated — they are machine-readable keys, not prose:

`READY` `NOT READY` `Blocker` `Major` `Minor` `Fix now` `Ask` `Reject`

Perspective names (`Completeness`, `Consistency`, …) are also emitted in
English; only their descriptions are translated.

### Arguments

| Argument | Meaning |
|----------|---------|
| `<path>` | The document to review. Optional — see Section 2 when omitted. |
| `--fix` | Continue past the report: resolve `Ask` items, apply changes, re-review. |

**Values do not survive between bash blocks.** Each block may run as a separate
shell, so a variable assigned in one block is gone in the next. Do not write
state files either. Instead, read each value out of the block's output and
substitute it **literally** into the next command you run. The values carried
this way are named in the sections below.

## Section 2: Target resolution

### When `<path>` is given

Use it. Skip to *Document type* below.

Passing a path is also what makes an unattended run safe: every question in
this section exists only for the omitted-path case.

### When `<path>` is omitted — staged search

`superpowers:brainstorming` and `superpowers:writing-plans` both state that
"User preferences for spec location override this default", so the default
paths are a starting point, not a guarantee. Search in this order and stop at
the first stage that yields a candidate:

```bash
# Stage 1 — the documented default locations
find docs/superpowers/specs docs/superpowers/plans -name '*.md' -type f 2>/dev/null | sort

# Stage 2 — anywhere under docs/ that looks like a design document
find docs -type f -name '*.md' \( -name '*design*' -o -name '*plan*' \) 2>/dev/null | sort
```

If both stages come up empty, report the directories you searched, ask the user
to pass an explicit path, and stop. Do not guess.

When several candidates exist, prefer the newest date in the filename. If two
or more share that date, present them as a multiple-choice question and let the
user pick — never pick silently.

### Document type

| Condition | Type |
|-----------|------|
| Path contains `/specs/`, or the filename ends in `-design.md` | `spec` |
| Path contains `/plans/` | `plan` |
| Neither | Ask the user with a multiple-choice question |

### Spec cross-reference (when the target is a `plan`)

`superpowers:writing-plans` requires every plan to carry a `**Spec:** <path>`
header line. Resolve the companion spec in this order:

1. The path named on the plan's `Spec:` line
2. A spec file with the same date and topic in `docs/superpowers/specs/`

```bash
grep -m1 '^\*\*Spec:\*\*' <the plan file>
```

If a spec is found, Section 3 checks requirement coverage in both directions.
If none is found, **say so at the top of the report and continue** — coverage
checking is skipped, not the whole review.

A plan cannot be checked for "does every spec requirement have a task?" on its
own. This is why `writing-plans` lists "Spec coverage" as the first item of its
own self-review.

### Format check

Read the file and check that it has `##` section headings.

If it does not, or the document clearly does not follow the superpowers shape,
**warn and continue**: state at the top of the report that the document is not
in the expected format and that some perspectives cannot be applied, then
review with the ones that can. For findings where a `§n.n` reference is
impossible, quote the offending line instead.

### What to carry forward

Report these to yourself before moving on, and substitute them literally into
later commands:

| Value | Example |
|-------|---------|
| `TARGET_FILE` | `docs/superpowers/specs/2026-08-29-foo-design.md` |
| `DOC_TYPE` | `spec` |
| `SPEC_FILE` | (empty for a spec; the companion path for a plan) |
| `FIX_MODE` | `0` |
| `FORMAT_OK` | `1` |

Then announce the resolution to the user and stop.
