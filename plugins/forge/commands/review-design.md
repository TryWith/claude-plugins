---
description: Review a superpowers design document (spec or plan) and judge whether it is ready for implementation.
argument-hint: "[<path>] [--fix]"
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
can still arise. It asks nothing when `<path>` is **given** and is
**self-typing** — the path has a `specs/` or `plans/` component (not both), or
its filename ends in `-design.md`, so the Document type table in Section 2
resolves without help. It asks at most one question per unresolved dimension
otherwise: when the resolved path matches none of those patterns, when `<path>`
is omitted and the search finds several candidates it cannot rank, and always
when the search had to fall through to Stage 3 or to Stage 2's `*design*` /
`*plan*` guess patterns. Those last are guesses, and Section 2 never takes a
guess silently, however well the candidate happens to type itself.

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
`spec` `plan`

`spec` and `plan` are on that list because they are `DOC_TYPE` values, and
`DOC_TYPE` reaches the output twice — the `(spec)` on the report's header line
and the `— not applicable (<type>)` rows beneath it. Translating either one
breaks the same machine-readability the verdict string is kept English for.

Perspective names (`Completeness`, `Consistency`, …) are also emitted in
English; only their descriptions are translated. So is Section 8's
`pass n/<cap>` line, for a sharper version of the same reason: it is the only
carried value with no anchor outside the transcript, so it is read back by
matching on that literal text.

### Arguments

| Argument | Meaning |
|----------|---------|
| `<path>` | The document to review. Optional — see Section 2 when omitted. |
| `--fix` | Continue past the report: resolve `Ask` items, apply changes, re-review. |

`--fix` is a flag, not a value. Strip every `--`-prefixed token from the
argument list **before** resolving `<path>`; `<path>` is the first token that
remains, and the order the two are typed in does not matter. If nothing
remains, `<path>` was omitted — take the staged search in Section 2. Never
treat `--fix` itself as a path.

Stripping is not the same as ignoring. `--fix` is the **only** flag this
command accepts, so any other `--`-prefixed token is a typo, and any second
remaining token is a second path. Both are errors: name the token and stop
rather than running on. Silently discarding `--fx` runs a report-only pass
while the user believes fixes are being applied — the one failure mode where
saying nothing is worse than refusing.

**Values do not survive between bash blocks.** Each block may run as a separate
shell, so a variable assigned in one block is gone in the next. Do not write
state files either. Instead, read each value out of the block's output and
substitute it **literally** into the next command you run. The values carried
this way are named in the sections below.

## Section 2: Target resolution

### When `<path>` is given

Use it. If it is not a readable **regular file** — missing, a directory, or
unreadable — say so and stop; do not fall through to the search. Skip to
*Document type* below.

A path given here still goes through *Document type* below, so passing a path
removes the search questions but not the type question. A path that is
self-typing — under `specs/` or `plans/`, or ending in `-design.md` — removes
that one too, and is what an unattended caller should pass.

### When `<path>` is omitted — staged search

`superpowers:brainstorming` states that "User preferences for spec location
override this default", and `superpowers:writing-plans` says the same of plan
location, so the default paths are a starting point, not a guarantee. Search in
this order and stop at the first stage that yields a candidate:

```bash
# Stage 1 — the documented default locations
find docs/superpowers/specs docs/superpowers/plans -name '*.md' -type f 2>/dev/null | sort

# Stage 2 — anywhere under docs/ that looks like a design document.
# Match on the *path*, not just the basename: superpowers names plans
# `YYYY-MM-DD-<feature-name>.md`, with no "plan" token in the filename, so a
# relocated plan is only reachable through its directory.
find docs -type f -name '*.md' \
  \( -path '*/specs/*' -o -path '*/plans/*' -o -path '*design*' -o -path '*plan*' \) \
  2>/dev/null | sort

# Stage 3 — the same shape anywhere in the repository. Stage 2 is capped at
# docs/, but the preference that overrides the default location can move the
# directory out of docs/ entirely (design/, notes/plans/). Prune dot-directories
# and node_modules: without the prune this walks .git, agent scratch
# directories and dependency trees. `-name '.?*'` rather than `-name '.*'`,
# because the start point `.` matches the latter and would prune everything;
# `.?*` requires at least one character after the dot, so `.` and `..` are
# excluded while every real dot-directory matches — at **any** depth, which
# `-path './.*'` does not: that pattern anchors to the top level and walks a
# nested `packages/x/.venv` or `docs/.cache` in full.
find . \( -type d \( -name '.?*' -o -name node_modules \) \) -prune -o \
  -type f -name '*.md' \
  \( -path '*/specs/*' -o -path '*/plans/*' -o -path '*design*' -o -path '*plan*' \) \
  -print 2>/dev/null | sort
```

`*design*` and `*plan*` are a wide net: they match any path that merely
contains the word, this command's own file included. **Never take a candidate
that only those two patterns matched silently** — put it to the user as a
multiple-choice question even when only one came back, and do the same for every
Stage 3 candidate however it matched. Stage 1, and a Stage 2 candidate that
matched `*/specs/*` or `*/plans/*`, sit in a directory the conventions name;
everything else is a guess, and a guess is confirmed before it is reviewed.

The distinction is not cosmetic, and it is why the rule covers Stage 2 rather
than Stage 3 alone: a hand-written `docs/architecture-design.md` is a Stage 2 hit
on `*design*` and then self-types to `spec` on its filename, so a rule that
exempted Stage 2 would run the whole review against a document that is not a
design document at all, and never ask.

If every stage comes up empty, report the directories you searched, ask the user
to pass an explicit path, and stop. Do not guess.

When several candidates exist, prefer the newest date in the filename. `sort`
above orders by path, not by date, so read the dates out of the filenames
yourself — never just take the last line. A candidate whose filename carries no
date sorts last. If two or more tie for first — the same date, or no date on
any of them — present them as a multiple-choice question and let the user pick
— never pick silently. Date-less candidates tie with **each other**: having no
date is not a date they fail to share, and reading the rule that way leaves a
directory of undated candidates with no tie-break at all.

### Document type

| # | Condition | Type |
|---|-----------|------|
| 0 | The path has **both** a `specs/` and a `plans/` component | Ask the user with a multiple-choice question |
| 1 | The path has a `plans/` component | `plan` |
| 2 | The path has a `specs/` component, or the filename ends in `-design.md` | `spec` |
| 3 | None of the above | Ask the user with a multiple-choice question |

**Rows are tested top to bottom and the first match wins.**

"Component" means a whole path segment, with or without a leading separator:
`plans/foo.md`, `docs/plans/foo.md` and `./plans/foo.md` all have a `plans/`
component. Testing for the substring `/plans/` instead would miss the first of
those — a caller who passes `plans/2026-08-29-foo.md` from the repository root
gets row 3 and a question, in the run they passed an explicit path precisely to
keep unattended.

The directory is tested before the filename on purpose:
`docs/superpowers/plans/2026-08-29-foo-design.md` matches both rows 1 and 2, and
its directory is the stronger signal. Without a stated order that path resolves
to `spec` as readily as to `plan` — a plan reviewed as a spec, which is the exact
failure the paragraph below warns about, reached silently because the path still
counts as self-typing.

Row 0 is in the table for the mirror-image reason. A path carrying both
components matches row 1, so first-match-wins would resolve it to `plan` on
nothing but row order, and it has no stronger signal either way. It is a genuine
ambiguity, and it belongs in the table as a row rather than in prose that a
mechanical reading of the table skips.

The `None of the above` row is reached from both entry paths: an explicit `<path>` is
matched on its own text, never trusted for its origin. That is why an
unattended caller needs a self-typing path rather than merely any path. Do not
guess the type to avoid asking — reviewing a plan as a spec silently applies
the wrong perspective set.

### Spec cross-reference (when the target is a `plan`)

`superpowers:writing-plans` requires every plan to carry a `**Spec:** <path>`
header line. Resolve the companion spec in this order:

1. The path named on the plan's `Spec:` line
2. A spec file with the same date and topic in `docs/superpowers/specs/`
3. The same, in whatever directory the staged search above actually turns up
   specs in. The preference that overrides the default spec location overrides
   it for this lookup too; stopping at step 2 reports "no companion spec" for
   every repository that relocated its specs, and Section 4 turns that into a
   `Major` the document can never clear

```bash
# `|| true` — a plan with no Spec: line is a fall-through, not a failed block.
grep -m1 '^\*\*Spec:\*\*' "<the plan file>" || true
```

Check that the path the `Spec:` line names actually exists before accepting it.
If it does not, fall through to step 2, and failing that to the "no spec found"
branch below — a `Spec:` line pointing at a moved or deleted file is itself a
Perspective C finding.

If a spec is found, Section 3 checks requirement coverage in both directions.
If none is found, **say so at the top of the report and continue** — coverage
checking is skipped, not the whole review.

A plan cannot be checked for "does every spec requirement have a task?" on its
own. This is why `writing-plans` lists "Spec coverage" as the first item of its
own self-review.

### Format check

Read the file and check that it has `##` section headings.

If it does not, or the document clearly does not follow the superpowers shape,
set `FORMAT_OK` to `0` and **warn and continue**: state at the top of the report
that the document is not in the expected format and that some perspectives
cannot be applied, then review with the ones that can and record which ones you
had to skip — Section 5's header block has a state for them. For findings where
a `§n.n` reference is impossible, quote the offending line instead.

Both triggers set the same flag on purpose. `FORMAT_OK` is the only thing
Section 4's degradation table reads, so a document that keeps its `##` headings
while following none of the superpowers shape would otherwise warn above the
verdict line and still be free to report `READY` — the exact outcome that table
exists to prevent.

### What to carry forward

Report these to yourself before moving on, and substitute them literally into
later commands:

| Value | Example |
|-------|---------|
| `TARGET_FILE` | `docs/superpowers/specs/2026-08-29-foo-design.md` |
| `DOC_TYPE` | `spec` |
| `SPEC_FILE` | (empty for a spec; the companion path for a plan) |
| `FIX_MODE` | `0` — set to `1` when `--fix` was passed |
| `FORMAT_OK` | `1` — set to `0` when the format check found no `##` headings, or found the document does not follow the superpowers shape |

Then continue to Section 3.

## Section 3: Review perspectives

Read the whole document, then apply all ten perspectives below **in order**, in
this single context. Do not dispatch subagents — every perspective is
answerable from this document and this repository, so there is no work to farm
out. (The command does assume the superpowers conventions in Section 2, and
Section 8 points at superpowers for execution, but it never invokes another
command.)

`◎` = primary for this document type, `○` = applies, `–` = not applicable.

| # | Perspective | What to look for | spec | plan |
|---|-------------|------------------|:----:|:----:|
| A | `Completeness` | TBD / TODO / empty sections / placeholders / vague words ("appropriately", "as needed", "etc.") | ○ | ◎ |
| B | `Consistency` | Contradictory numbers, names or ordering across sections; drifting terminology; type and signature mismatches between tasks | ◎ | ◎ |
| C | `Repo Grounding` | Do referenced files and directories exist? Are assumed dependencies declared? Does anything contradict a convention written in `CLAUDE.md`? | ◎ | ○ |
| D | `Blind Spots` | Error handling / test strategy / migration and backward compatibility / security and permissions / observability / concurrency and idempotency / rollback | ◎ | ○ |
| E | `Buildability` | Task granularity, dependency ordering, whether an implementer could follow it without getting stuck | – | ◎ |
| F | `Scope` | Too large for one plan (propose decomposition); scope boundary stated; and when a companion spec was found, coverage in both directions — every spec requirement maps to at least one task, and no task exceeds what the spec calls for | ○ | ◎ |
| G | `Assumptions` | Are unverified assumptions (traffic, external API behaviour, performance targets) stated, and is a basis given? | ◎ | ○ |
| H | `Alternatives` | Is there a record of why this approach, and what was rejected and why? | ◎ | – |
| I | `YAGNI` | Features not needed now, abstractions built for a hypothetical future, unused extension points | ◎ | ○ |
| J | `Acceptance` | Is it stated what "done" means and how it will be verified? | ◎ | ◎ |

Where two perspectives could both claim a finding — a missing test-strategy
section is both an empty section and a blind spot — file it under exactly one,
and prefer the more specific.

### Run every perspective, including the clean ones

Apply all ten even when you expect nothing. The report lists every perspective
by name, so a reader can tell "checked, nothing found" apart from "not
checked". A perspective that does not apply to this document type is reported
as not applicable, not omitted.

### Perspective C: grounding against the repository

This is the one perspective that reads outside the document. Check the claims
the document makes about the repository:

```bash
# Do the paths the document names actually exist? Check them all in one block.
# These paths come from the document, so they are *data*, never script text:
# feed them on stdin through a quoted heredoc. Quoting the delimiter
# (`<<'PATHS'`) is what makes the body literal. Double quotes are NOT enough —
# `$(...)`, backticks and `${...}` still expand inside them, and a path
# containing a `"` closes the string, so a document that names
# `$(rm -rf ~)` as a file would run it.
while IFS= read -r p; do
  [ -n "$p" ] || continue
  if [ -e "$p" ]; then echo "ok      $p"; else echo "MISSING $p"; fi
done <<'PATHS'
<path 1 named in the document>
<path 2>
PATHS

# What conventions does this repository document? Prune the trees a CLAUDE.md
# never governs, and match the local variant too. Dot-directories go for the
# same reason as in Stage 3, and one in particular: `.claude/worktrees/` holds
# whole checkouts of this repository, each with a root CLAUDE.md that governs
# that checkout and not the document under review.
find . \( -type d \( -name '.?*' -o -name node_modules \) \) -prune -o \
  -type f \( -name 'CLAUDE.md' -o -name 'CLAUDE.local.md' \) -print 2>/dev/null
```

Read the root file, every file the `find` reported that governs a directory the
document touches — a nested one only applies to files at or below it — and
`~/.claude/CLAUDE.md` if it exists, which governs everything. If a path from
the document contains a newline or a line equal to `PATHS`, check that one with
the Read tool instead of the block above.

**A mismatch between the document and the repository is an `Ask`, not a
`Fix now`.** Deciding whether the document is wrong or the repository is wrong
is the user's call, and the answer often runs the other way — bringing the
document in line with reality rather than the reverse. Rewriting a deliberate
choice because a document disagreed with it is a real failure mode this rule
exists to prevent.

### Perspective H: why this is checkable at all

`superpowers:brainstorming` makes "Propose 2-3 approaches with trade-offs" a
required step of its architectural path. A spec with no trace of rejected
alternatives is therefore evidence that a step was skipped — a mechanically
detectable signal. Perspective I likewise corresponds to brainstorming's
"YAGNI ruthlessly - remove unnecessary features from every approach and
design".

Neither check would be writable for a general-purpose document reviewer. They
work here because the document's provenance is known.

### Direction

A–E, G and J look for what is **missing**. F and I look for what is
**excessive**. A reviewer that only looks one way makes documents grow every
time its advice is followed; both directions are required.

### Recording a finding

Every finding carries four fields. Do not collapse them:

| Field | Content |
|-------|---------|
| location | `§3.2` for a finding about specific text. `§whole` for a finding about something the document does not contain at all — including when `FORMAT_OK` is `0`, since an absent thing has no line to quote. When `FORMAT_OK` is `0` and the finding *is* about specific text, quote the offending line instead of citing a section, because the section numbers it would cite do not exist |
| perspective | The letter and English name, e.g. `A Completeness` |
| finding | What is wrong — translated to `$LANG_CODE` |
| consequence | What happens if it is implemented as written — translated to `$LANG_CODE` |

The consequence field is not decoration: Section 4 assigns severity from it.

## Section 4: Triage and verdict

Severity and disposition are **two independent axes**. A finding gets one value
on each. Assigning a severity is not a substitute for assigning a disposition.

### Severity — how much it costs

Classify by what happens if the document is implemented as written, not by how
large the defect looks on the page.

| Label | Test | If implemented |
|-------|------|----------------|
| `Blocker` | Work **stops or goes wrong** without this | Cannot start, or starts and reliably builds the wrong thing |
| `Major` | Work **comes back** without this | Something runs, but rework or a return to design is likely |
| `Minor` | Work **proceeds and does not return** | No effect on implementation; readability or maintainability |

Examples:

- `Blocker` — a section still says TBD; §2 says 3 retries and §5 says 5; a file
  named as a modification target does not exist; a spec requirement maps to no
  task in the plan
- `Major` — no test strategy; error behaviour undefined; a breaking change with
  no migration steps; no acceptance criteria
- `Minor` — terminology drift; redundant prose; odd section ordering

`Blocker` findings come mostly from A, B, C and E — the perspectives that can
be checked mechanically. That `Blocker` is objective while `Major` carries
judgement is not a coincidence.

**Typical severity by perspective.** Use this to stay consistent across runs;
it is a default, not a straitjacket, and the consequence you wrote for the
finding always wins over the table.

| Perspective | Typical severity |
|-------------|------------------|
| A `Completeness` | TBD and empty sections → `Blocker`; vague words → `Major` |
| B `Consistency` | Contradictory numbers or names → `Blocker`; terminology drift → `Minor` |
| C `Repo Grounding` | A referenced path that does not exist → `Blocker`; a convention violated → `Major` |
| D `Blind Spots` | Nearly always `Major` |
| E `Buildability` | A task that cannot be followed → `Blocker`; coarse granularity → `Major` |
| F `Scope` | Too large to plan as one unit → `Blocker`; a feature the spec does not call for → `Major` |
| G `Assumptions` | An assumption that is false → `Blocker`; one left unverified → `Major` |
| H `Alternatives` | `Minor` |
| I `YAGNI` | `Major` or `Minor` |
| J `Acceptance` | `Major` |

### Disposition — who decides

| Label | Condition | Effect |
|-------|-----------|--------|
| `Fix now` | The answer is uniquely determined | Applied automatically under `--fix` |
| `Ask` | A design decision is required. Perspective C mismatches go here by default | Put to the user as a multiple-choice question |
| `Reject` | False positive | Reported with a one-line reason |

**High severity does not imply `Ask`.** A `Major` finding whose answer is
uniquely determined is a `Fix now`.

|  | `Fix now` | `Ask` |
|---|-----------|-------|
| `Blocker` | TBD, but context fixes the answer → fill it in | Assumes Redis with no precedent in this repo → decide |
| `Major` | No test strategy section → write the standard one | Retry on error or not → policy decision |
| `Minor` | Terminology drift → unify | (rare) |

Give **every** finding exactly one disposition, in writing. Passing over a
finding in silence is not a disposition.

### Verdict

```
READY      ⟺  Blocker 0  AND  Major 0  AND  unresolved Ask 0
NOT READY  ⟺  anything else
```

A `Reject` leaves the counts alone. A finding you judged a false positive is
not a defect in the document, so it contributes to no severity total on the
verdict line and to no perspective's row in the header block — it appears in
the findings list with its one-line reason and nothing else. Counting it would
pin the document at `NOT READY` over a finding you yourself declared bogus,
with nothing to write that could ever clear it.

**A degraded review must not report `READY`.** When `FORMAT_OK` is `0`, or the
target is a `plan` whose companion spec was not found, perspectives were
*skipped*, not passed — and the verdict string is all a hook or CI job reads,
so the caveat Section 5 prints above it never reaches them. Record the
degradation as a finding so it flows through the formula above instead of
becoming a special case in it:

| Degradation | Finding to record |
|-------------|-------------------|
| `FORMAT_OK` is `0` | `Blocker`, `A Completeness`, `§whole`, disposition `Ask` |
| a `plan` with no companion spec | `Major`, `F Scope`, `§whole`, disposition `Ask` |

Both then count in the header block like any other finding, and a user who
disagrees answers the `Ask` with "keep the document as written".

A perspective that carries one of these findings is, by that fact, checked:
`A Completeness` never appears as a `— not checked (format)` row, because a
document with no `##` headings is incomplete on inspection and the finding
above says so. Only the perspectives you genuinely could not apply take that
row, and those carry no count. Otherwise the row would say "not checked" while
holding a `Blocker`, and Section 5's rule that the verdict counts equal the sum
of the per-perspective counts would have nothing to reconcile against.

Without `--fix` no `Ask` is ever put to the user, so any `Ask` at all leaves the
verdict at `NOT READY`. That is correct: "there are design decisions still
yours to make" is not a ready state.

**The verdict blocks nothing.** This command does not interrupt the superpowers
workflow. Its value is that a human sees the state at a glance, and that the
string is stable enough for a hook or CI job to read later. That is also why
`READY` and `NOT READY` are never translated.

### What to carry forward

Sections 5 to 8 consume these — Section 6 takes `ASK_ITEMS`, Section 7 takes
`FIX_ITEMS`, and `VERDICT` is what Sections 5 and 8 report. Report them to
yourself before emitting the report, and substitute them literally into later
work:

| Value | Content |
|-------|---------|
| `VERDICT` | `READY` or `NOT READY` |
| `PERSPECTIVE_STATUS` | One entry per perspective A–J: its severity counts, or `not applicable`, or `not checked (format)`. Section 5's header block is emitted from this and from nothing else — the findings list can tell you a perspective's counts, but nothing in it distinguishes a perspective that was skipped from one that came back clean |
| `ASK_ITEMS` | Every finding whose disposition is `Ask`, ordered by the document section it belongs to, with the `§whole` ones first |
| `FIX_ITEMS` | Every finding whose disposition is `Fix now` |

`ASK_ITEMS` is ordered by document section, not by severity: Section 6 walks
the document in order and puts one card to the user per section. `§whole`
items sort ahead of every section, because they belong to none and Section 6
puts them on a card of their own before the walk starts.

## Section 5: Report

Emit the report in `$LANG_CODE`, keeping every label listed in Section 1 in
English.

### Structure

```
── Review: docs/superpowers/specs/2026-08-29-foo-design.md (spec) ──
Verdict: ❌ NOT READY   Blocker 2 / Major 4 / Minor 3 / Ask 2

A Completeness   ⚠️ Blocker 1 / Minor 2
B Consistency    ⚠️ Blocker 1
C Repo Grounding ⚠️ Major 1
D Blind Spots    ⚠️ Major 2
E Buildability   — not applicable (spec)
F Scope          ✓ clean
G Assumptions    ✓ clean
H Alternatives   ⚠️ Minor 1
I YAGNI          ✓ clean
J Acceptance     ⚠️ Major 1

[Findings]

[Blocker] §3.2 Completeness
  The state storage mechanism is still TBD
  → an implementer cannot tell what to build
  Disposition: Ask (a design decision is required)

[Major] §whole Blind Spots
  No test strategy section
  → verification method sends the work back to design after implementation
  Disposition: Fix now (write the standard section)

[Minor] §6.3 Consistency
  "job" and "task" are used interchangeably
  → no effect on implementation
  Disposition: Fix now (unify terminology)

→ To apply fixes: /forge:review-design docs/superpowers/specs/2026-08-29-foo-design.md --fix
```

Rules for the header block:

- Every one of the ten perspectives appears, in order, always
- A perspective with no findings shows `✓ clean`; one that does not apply to
  this document type shows `— not applicable (<type>)`; one you could not apply
  because `FORMAT_OK` is `0` shows `— not checked (format)`. `✓ clean` means
  checked and clean and nothing else — a skipped perspective rendered as clean
  is precisely the "checked, nothing found" / "not checked" confusion this
  block exists to prevent
- The header block counts severities only. Disposition never appears here —
  the verdict line carries the `Ask` total, and each finding states its own
  disposition below
- **The three severity counts on the verdict line must equal the sum of the
  per-perspective counts.** Add them up before emitting; a header that
  disagrees with its own breakdown is exactly the defect perspective B exists
  to catch. `Ask` is a disposition, has no per-perspective row to sum against,
  and is counted straight off the findings list
- Every finding appears in the findings list, not just the ones shown in the
  example above — the example is abridged
- The header line names `TARGET_FILE` in full, and the `--fix` hint repeats it
  verbatim. A bare `/forge:review-design --fix` re-runs the staged search and
  can land on a different document than the one this report is about. Wrap the
  path in double quotes in the hint when it contains a space or any other shell
  metacharacter — Section 1 treats a second remaining token as a second path
  and stops, so an unquoted `docs/my design/foo.md` prints a hint that is an
  error when the reader runs it
- **The hint is printed only when `FIX_MODE` is `0` and the report carries at
  least one `Fix now` or `Ask`.** A run that is already applying fixes must not
  tell the reader to pass `--fix`, and neither must a report with nothing for a
  fix pass to do — on a `READY` report with no findings, `--fix` would re-read
  the document, ask nothing, write nothing and re-emit this same report

Each finding is four lines: `[Severity] location Perspective`, then the
finding, then `→` and the consequence, then the disposition with a short
reason. Do not compress them onto one line — the consequence is what justifies
the severity, and a reader needs to be able to disagree with it.

A `Reject` is the one exception. It counts toward no severity total, so heading
it `[Blocker]` would put the findings list at odds with the header block the
rule above just reconciled. Head it `[Reject] location Perspective` instead,
and give the one-line reason in place of the consequence and disposition.

If the document was not in the expected format, or a plan's companion spec
could not be found, say so **above** the verdict line.

### Where to stop

When `FIX_MODE` is `0`, the report is the whole output. **Do not modify the
target file, and do not ask the user anything** — everything from here on is
report generation, and a report that cannot alter its subject and cannot block
on an answer is what makes an unattended run possible. Target resolution back
in Section 2 is the only step that can ask, and only for a path that is not
self-typing. Print the `--fix` hint — subject to the condition in *Rules for
the header block* above, which is the only place that decides whether it is
printed at all — and stop.

When `FIX_MODE` is `1`, continue to Section 6.

One thing does still follow the report on the report-only exit: when
`DOC_TYPE` is `plan` and `VERDICT` is `READY`, emit Section 8's *Handing off to
implementation* block before stopping. Report-only is the mode a gate runs in,
so it is the mode most likely to produce the `READY` plan that block exists
for; leaving it reachable only under `--fix` hides the next step from every run
that had nothing to fix.

## Section 6: Resolving Ask items

Reached only when `FIX_MODE` is `1`.

### Order: Ask before Fix now

Resolve every `Ask` **before** applying any `Fix now`. Design decisions cascade
into the mechanical edits: deciding "SQLite, not Redis" changes every later
section that mentions Redis. Applying the mechanical fixes first means redoing
them.

### One card per section

Walk the document's sections in order. For each section that has `Ask` items,
put its questions to the user as **one multiple-choice card, at most four
questions**. Sections with no `Ask` items produce no card. If a section has
more than four, take the four highest-severity ones and put the rest on the
next card for that section.

A `§whole` finding belongs to no section, so the walk on its own would never
reach it. Put every `§whole` `Ask` on a **first card, before the walk starts**,
under the same four-question limit and the same overflow rule. This is not an
edge case: `§whole` is the location for anything the document does not contain
at all, which is where most of D, G, H, I and J land, and **both** of Section
4's degradation findings are `§whole` `Ask`s. Dropping them would leave the
two findings that exist to keep a degraded review off `READY` as the only ones
the user is never asked about, and would make Section 7's precondition —
every `Ask` answered — impossible to satisfy.

Grouping by section keeps related questions together, and most documents only
have `Ask` items in a couple of sections.

On a second or later pass, carry every answer from the earlier passes with you.
An `Ask` the user has already answered — including one answered "keep the
document as written" — is settled, and is never put to them again, even when
the re-review re-detects the finding behind it.

### Building the choices

Every question offers between two and four choices. **Keep the document as
written** — leave it alone, and say plainly that the finding stays unresolved
and the verdict stays `NOT READY` — is one of them on **every** question,
without exception.

When the finding is a Perspective C mismatch, one of the other choices must be
**Match the repository** — change the document to agree with what is actually
there. On a finding that is not a repository mismatch (a TBD, an undefined
policy) there is nothing to match, so that choice is omitted and its slot goes
to a concrete alternative instead. The example below is one of those, which is
why it has no "Match the repository" line.

Fill the remaining slots with concrete alternatives. Give every choice a
one-line consequence.

```
Q1 [§3.2] The state storage mechanism is TBD

  ○ Use the existing SQLite store
     → no new dependency; follows the pattern already in db/

  ○ Introduce Redis
     → one more dependency; operators must run Redis

  ○ Write to a file directly
     → simplest; weak under concurrent writes

  ○ Keep the document as written (leave TBD)
     → stays unresolved; verdict remains NOT READY
```

"Keep the document as written" is not filler. Without it the reviewer's
proposals become one-sided and the user has no supported way to stand by what
they wrote. If the user answers with free text instead, take it as given.

Record each answer against its finding. Do not apply anything yet.

## Section 7: Applying changes

Once **every** `Ask` in the document has an answer, apply the answers together
with every `Fix now` in a **single pass** over the file.

Writing exactly once per pass is deliberate. The file is only ever changed as
one batch of targeted edits: a session interrupted anywhere in Sections 3-6
leaves it exactly as the previous pass left it, and a completed batch applies
every answer at once. That is why this command keeps no state files. (It is
also what makes it different from `finalize.md`, whose loop commits and pushes
on every iteration and therefore does need `.git/forge/` state.)

The batch itself is **not** atomic — it is several targeted edits, and one can
fail part way through. The write-failure rule below is what covers that case;
do not read "one batch" as a guarantee that no half-edited state can exist.

If there is nothing to apply — no `Ask` was answered with a change and
`FIX_ITEMS` is empty — **write nothing** and go straight to Section 8. A clean
document is the expected happy path, and rewriting it to change nothing is not
a no-op: it risks paraphrasing prose no finding asked you to touch.

Rules:

- An `Ask` answered with "keep the document as written" produces **no edit**.
  The finding stays open.
- A `Reject` produces no edit.
- Preserve the document's existing heading structure and style. Do not reformat
  sections you are not changing.
- If any edit in the batch fails, **stop and report**: name the edits that
  landed and the ones that did not, so the user can finish or revert by hand.
  Never continue to Section 8 on top of a partial write.

After writing, continue to Section 8.

## Section 8: Re-review and exit

### Loop

If Section 7 wrote nothing, there is nothing to re-review: the file is byte for
byte what Section 3 already read, so another pass can only reproduce the report
you just emitted. Skip straight to *Completion output* below, carrying the
verdict you already have.

Otherwise, re-run Sections 3 and 4 against the written file and re-emit
Section 5's report, then compare what it found against what this run has
already settled. Perspective C's two blocks are the exception: the
path-existence check and the CLAUDE.md `find` read the *repository*, and only
the document changed since the last pass. Re-use the results you already have,
and re-run a path check only for a path the batch you just wrote added or
altered.
You are using those sections as a subroutine: **their own routing does not
apply here.** Section 5's closing line sends a `--fix` run to Section 6 —
ignore it and come back to this section instead. (Section 5's `--fix` hint
needs no such exemption: its own condition already requires `FIX_MODE` to be
`0`, and it never is on this path.)

Go back to Section 6 only for a **new `Ask`, at any severity** — meaning one
this run has neither resolved nor had declined. Disposition routes here;
severity does not. A new `Blocker` is a question only when its disposition is
`Ask`, and a new `Minor` `Ask` is a question just the same — routing on severity
instead would send a new `Blocker` whose answer is uniquely determined to
Section 6 with nothing to ask about. A finding whose `Ask` the user has already
answered is neither: it is settled, it stays settled, and settled means it is
not put to them again. Restate its recorded outcome and move on.

Settled covers both answers, and they part on the verdict:

- Answered with **"keep the document as written"** — nothing was written for
  it, so it is re-detected on every later pass, and it stays **unresolved**: a
  declined `Ask` keeps the document at `NOT READY`.
- Answered with a **change** — it is **resolved** and holds the verdict at
  nothing. Normally the change removes it and the re-review does not see it
  again. If the re-review still detects it, the edit did not land what was
  asked: say so in the completion output, as an applied change that did not
  take, rather than reopening a question that is settled or holding the
  verdict hostage to it.

Without the split, the one case the rules do not name — an answered-with-a-
change finding the re-review still sees — is as readable as `READY` over an
open `Ask` as it is as `NOT READY` forever.
`finalize.md` carries the same rule for the same reason — without it the loop
ping-pongs on one contested finding until the cap fires.

A **new `Fix now`, at any severity**, needs no question, so it does not go back
to Section 6 — it goes back to **Section 7** and is applied in the next batch.
Both return paths cost a pass and are counted below. Section 4 promises that
every `Fix now` is applied automatically under `--fix`; routing only
`Blocker`/`Major`/`Ask` back would break that promise for a `Minor` `Fix now`
the re-review turned up, and drop it without a word. If the cap fires with
`Fix now` items still unapplied, **list them in the completion output** rather
than dropping them.

Count the passes yourself. The count lives in your context alongside
`TARGET_FILE` and the other carried values, for the same reason they do: each
bash block may run as a separate shell, and this command writes no state files.
Start it at 1 the first time you reach this section, and add one each time you
return to it. Before going back to Section 6 or 7, stop when the count is
**greater than or equal to** the cap — the same `-ge` test `finalize.md` uses,
so the default cap of 3 allows three passes and no fourth.

The count is the **one** carried value with no anchor outside your context:
`TARGET_FILE` is on disk, the answers were typed by the user, but the count is
only remembered. So print it — literally `pass n/<cap>`, in English, for the
same reason the labels in Section 1 stay English: this line is read back
mechanically, and a translated one cannot be. Print it every time you arrive
here and it survives in the transcript: the highest `pass n/<cap>` line already
emitted is the count, recoverable by reading back. Count **those** lines, not
the *Re-review after fixes* headers — that header belongs to *Completion
output* below and is emitted once, on the way out, so counting it would read
every pass as the first.

**No `pass n/<cap>` line yet means this is the first arrival and the count is
1** — that is the expected state, not a failure to establish it. "Cannot
establish" means the lines are there but unreadable or mutually inconsistent.
**In that case treat the count as at the cap and exit**, the same fail-closed
rule the guard below applies to the cap itself. Reading an empty transcript as
"cannot establish" would fail the loop closed on its very first pass and apply
nothing at all.

```bash
# Override with FORGE_MAX_DESIGN_REVIEW_LOOP. A missing, non-numeric or
# zero-valued setting must fail *closed* — fall back to the default rather than
# looping unbounded or never looping at all. `finalize.md` applies the same
# fail-closed rule when it reads its counter back from disk.
MAX_DESIGN_REVIEW_LOOP="${FORGE_MAX_DESIGN_REVIEW_LOOP:-3}"
# `case` rejects the non-numeric values. `:-` above already turned an unset or
# empty setting into 3, so the `''` pattern is belt and braces, not the thing
# that catches those. The `-gt 0` test then rejects the zero-valued ones `case`
# cannot enumerate — `0` is one pattern, but `00` and `000` are numeric, pass
# the pattern, and compare equal to zero, which would put the very first pass
# at the cap and stop the loop before it ran.
case "$MAX_DESIGN_REVIEW_LOOP" in ''|*[!0-9]*) MAX_DESIGN_REVIEW_LOOP=3 ;; esac
[ "$MAX_DESIGN_REVIEW_LOOP" -gt 0 ] 2>/dev/null || MAX_DESIGN_REVIEW_LOOP=3
echo "Iteration cap: $MAX_DESIGN_REVIEW_LOOP"
```

The cap is 3 by default (override with `FORGE_MAX_DESIGN_REVIEW_LOOP`) — lower
than the review loop in `finalize.md`, which allows 10. Code has CI as an
outside judge; a design document does not. Each extra pass is the same context
re-reading prose it just wrote, and the returns fall off quickly. **The only
information entering the loop from outside is the answers the user gave.**

On reaching the cap, report the current verdict and exit **normally**. Hitting
the cap is a result, not an error.

It is usually `NOT READY` — the cap only fires while something is still routing
back — but do not assume it. A cap that fires with nothing outstanding but a
`Minor` `Fix now` leaves `Blocker 0 / Major 0 / Ask 0`, which is `READY` by the
formula in Section 4. Report whatever the formula gives, list the unapplied
`Fix now` items beside it, and when that verdict is `READY` say in one line
that it was reached with fixes still unapplied — including above the *Handing
off to implementation* block, which a `READY` plan reaches on this path too.

### Completion output

Emit three things:

1. The verdict from the final re-review
2. A bulleted summary of what changed
3. A pointer to `git diff` for the details

```
── Re-review after fixes ──
Verdict: ✅ READY   Blocker 0 / Major 0 / Minor 1 / Ask 0

Applied:
  • §3.2  state storage: TBD → SQLite (your answer)
  • §3    retry count: unified on 3 (§2 was authoritative)
  • §7    added a test strategy section
  • §6.3  unified "job" / "task" terminology

Review the changes with: git diff -- <target file>
```

When Section 7 wrote nothing, items 2 and 3 have no subject: emit the verdict,
say in one line that no change was needed, and print no `Applied:` list and no
`git diff` pointer. An empty bullet list under `Applied:` and a diff pointer at
an unchanged file both read as "something happened here" when nothing did.

`git diff` reports tracked files only. Design documents often sit in an ignored
or untracked directory — this repository ignores `docs/superpowers/`, for one —
and there `git diff` prints nothing at all. Check before you print the pointer,
and emit whichever line actually shows the change:

```bash
git ls-files --error-unmatch -- "<target file>" >/dev/null 2>&1 \
  && echo "Review the changes with: git diff -- <target file>" \
  || echo "<target file> is not tracked by git — open it to review the changes"
```

### Handing off to implementation

When — and only when — the target was a `plan` **and** the final verdict is
`READY`, offer the two ways to execute it:

```
To implement this plan:
  1. superpowers:subagent-driven-development (recommended)
     — a fresh subagent per task, reviewed between tasks
  2. superpowers:executing-plans
     — run the tasks in this session with checkpoints
```

Do not offer this on `NOT READY`. The document still needs work, and offering
the next step anyway undercuts the point of having a verdict.
