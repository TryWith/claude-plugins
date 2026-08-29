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

Target resolution runs before the review, and it is the one place a question
can still arise. It asks nothing when the path it ends up with is
**self-typing** — the path sits under a `specs/` or `plans/` directory, or its
filename ends in `-design.md`, so the Document type table in Section 2 resolves
without help. It asks exactly one question otherwise: when `<path>` is omitted
and the search finds several equally recent candidates, or when the resolved
path matches none of those patterns.

**For unattended use, pass an explicit, self-typing `<path>`** — for example
`docs/superpowers/specs/2026-08-29-foo-design.md`. That is the condition under
which the whole run is non-interactive. A path outside those conventions can
still need one question about its type.

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

A path given here still goes through *Document type* below, so passing a path
removes the search questions but not the type question. A path that is
self-typing — under `specs/` or `plans/`, or ending in `-design.md` — removes
that one too, and is what an unattended caller should pass.

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

The `Neither` row is reached from both entry paths: an explicit `<path>` is
matched on its own text, never trusted for its origin. That is why an
unattended caller needs a self-typing path rather than merely any path. Do not
guess the type to avoid asking — reviewing a plan as a spec silently applies
the wrong perspective set.

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
