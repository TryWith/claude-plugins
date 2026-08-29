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
without help. It asks at most one question per unresolved dimension otherwise:
when `<path>` is omitted and the search finds several equally recent
candidates, or when the resolved path matches none of those patterns.

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

Use it. If it does not exist or cannot be read, say so and stop — do not fall
through to the search. Skip to *Document type* below.

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

When several candidates exist, prefer the newest date in the filename. A
candidate whose filename carries no date sorts last. If two or more share that
date, present them as a multiple-choice question and let the user pick — never
pick silently.

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
| `FIX_MODE` | `0` — set to `1` when `--fix` was passed |
| `FORMAT_OK` | `1` — set to `0` when the format check found no `##` headings |

Then continue to Section 3.

## Section 3: Review perspectives

Read the whole document, then apply all ten perspectives below **in order**, in
this single context. Do not dispatch subagents — this command has no external
dependencies.

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
# Do the paths the document names actually exist?
# Run this for each path the document references.
ls -la <path named in the document>

# What conventions does this repository document?
cat CLAUDE.md 2>/dev/null
```

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
| location | `§3.2` for a finding about specific text. `§whole` for a finding about something the document does not contain at all. When `FORMAT_OK` is `0`, quote the offending line instead of citing a section |
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
| `ASK_ITEMS` | Every finding whose disposition is `Ask`, ordered by the document section it belongs to |
| `FIX_ITEMS` | Every finding whose disposition is `Fix now` |

`ASK_ITEMS` is ordered by document section, not by severity: Section 6 walks
the document in order and puts one card to the user per section.

## Section 5: Report

Emit the report in `$LANG_CODE`, keeping every label listed in Section 1 in
English.

### Structure

```
── Review: 2026-08-29-foo-design.md (spec) ──
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

→ To apply fixes: /forge:review-design --fix
```

Rules for the header block:

- Every one of the ten perspectives appears, in order, always
- A perspective with no findings shows `✓ clean`; one that does not apply to
  this document type shows `— not applicable (<type>)`
- The header block counts severities only. Disposition never appears here —
  the verdict line carries the `Ask` total, and each finding states its own
  disposition below
- **The counts on the verdict line must equal the sum of the per-perspective
  counts.** Add them up before emitting; a header that disagrees with its own
  breakdown is exactly the defect perspective B exists to catch
- Every finding appears in the findings list, not just the ones shown in the
  example above — the example is abridged

Each finding is four lines: `[Severity] location Perspective`, then the
finding, then `→` and the consequence, then the disposition with a short
reason. Do not compress them onto one line — the consequence is what justifies
the severity, and a reader needs to be able to disagree with it.

If the document was not in the expected format, or a plan's companion spec
could not be found, say so **above** the verdict line.

### Where to stop

When `FIX_MODE` is `0`, the report is the whole output. **Do not modify the
target file, and do not ask the user anything** — everything from here on is
report generation, and a report that cannot alter its subject and cannot block
on an answer is what makes an unattended run possible. Target resolution back
in Section 2 is the only step that can ask, and only for a path that is not
self-typing. Print the `--fix` hint and stop.

When `FIX_MODE` is `1`, continue to Section 6.

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

Grouping by section keeps related questions together, and most documents only
have `Ask` items in a couple of sections.

On a second or later pass, carry every answer from the earlier passes with you.
An `Ask` the user has already answered — including one answered "keep the
document as written" — is settled, and is never put to them again, even when
the re-review re-detects the finding behind it.

### Building the choices

Every question offers between two and four choices, and **must** include both
of these:

- **Match the repository** — change the document to agree with what is
  actually there
- **Keep the document as written** — leave it alone. State plainly that the
  finding stays unresolved and the verdict stays `NOT READY`

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
leaves it exactly as the previous pass left it, and a completed write applies
every answer at once.
Either way the document on disk is complete and self-consistent — there is
never a half-edited state to recover, which is why this command keeps no state
files. (This is what makes it different from `finalize.md`, whose loop commits
and pushes on every iteration and therefore does need `.git/forge/` state.)

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
- If the write fails, **stop and report**. Never continue past a partial write.

After writing, continue to Section 8.

## Section 8: Re-review and exit

### Loop

Re-run Sections 3 and 4 against the written file and re-emit Section 5's
report, then compare what it found against what this run has already settled.
You are using those sections as a subroutine: **their own routing does not
apply here.** Section 5's closing line sends a `--fix` run to Section 6, and
Section 5's `--fix` hint is for the report-only exit — on this path, ignore
both and come back to this section.

Go back to Section 6 only for something **new** — a `Blocker` or `Major`
finding, or an `Ask` at any severity — meaning one this run has neither
resolved nor had declined. A finding whose `Ask` the user answered with "keep
the document as written" is neither: it is settled, it stays settled, and it
will be re-detected on every later pass precisely because nothing was written
for it. Settled means it will not be put to the user again. It stays
**unresolved** for the verdict — a declined `Ask` keeps the document at
`NOT READY`. Restate its recorded outcome and move on.
`finalize.md` carries the same rule for the same reason — without it the loop
ping-pongs on one contested finding until the cap fires.

Count the passes yourself. The count lives in your context alongside
`TARGET_FILE` and the other carried values, for the same reason they do: each
bash block may run as a separate shell, and this command writes no state files.
Start it at 1 the first time you reach this section, and add one each time you
return to it, and check it against the cap before going back to Section 6.

```bash
echo "Iteration cap: ${FORGE_MAX_DESIGN_REVIEW_LOOP:-3}"
```

The cap is 3 by default — lower than the review loop in `finalize.md`, which
allows 10. Code has CI as an outside judge; a design document does not. Each
extra pass is the same context re-reading prose it just wrote, and the returns
fall off quickly. **The only information entering the loop from outside is the
answers the user gave.**

On reaching the cap, report the current verdict — which will be `NOT READY` —
and exit **normally**. Hitting the cap is a result, not an error.

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

Review the changes with: git diff <target file>
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
