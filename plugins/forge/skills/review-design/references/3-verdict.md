# Judge and report

## Contents

- Section 4: Triage and verdict
  - Severity — how much it costs
  - Disposition — who decides
  - Verdict
  - What to carry forward
- Section 5: Report
  - Structure
  - Where to stop

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

`Blocker`, `Major` and `Minor` are the words the header block and the verdict
line are summed on, and Section 5 requires those two totals to reconcile. They
are keys: emit them in English however the finding text beside them is written.

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
| C `Repo Grounding` | A path the document treats as **already present** that does not exist → `Blocker`; a convention violated → `Major`. A path the document says it will **create** is not a finding at all — see Perspective C |
| D `Blind Spots` | Nearly always `Major` |
| E `Buildability` | A task that cannot be followed → `Blocker`; coarse granularity → `Major` |
| F `Scope` | Too large to plan as one unit, or a spec requirement that maps to no task → `Blocker`; a feature the spec does not call for → `Major` |
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

`Fix now`, `Ask` and `Reject` are read back the same way — Section 8 routes on
the disposition word, and the verdict formula counts unresolved `Ask` items —
so they stay English too.

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

Both then count in the header block like any other finding. A user who
disagrees answers the `Ask` with "keep the document as written" — which records
the disagreement but, like every declined `Ask`, leaves the finding unresolved
and the verdict at `NOT READY`. That is deliberate for `FORMAT_OK`, and it is
the intended answer for a plan that genuinely has no spec: say so in one line
above the verdict so the reader knows the `NOT READY` is the missing spec and
not something in the document, and do not invent a way to clear it. The one
exception is Section 6's *The spec is at this path* choice, which clears it by
producing the spec the lookup missed — that is not inventing a way to clear the
finding, it is discovering the finding was wrong.

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
`READY` and `NOT READY` are the literal tokens a caller matches on — they
are part of the anchor, not prose that varies with the reader.

`READY` is a substring of `NOT READY`, so a reader that greps for the bare word
matches both and reads every failure as a pass. Emit the verdict on its own
line, opening with the fixed prefix `Verdict: <emoji> <READY|NOT READY>`. What
is fixed is the *prefix*: Section 5's template appends the severity counts to
the same line, so a caller must match the prefix and not the whole line. Tell
any caller to test for `NOT READY` **first**, and to read `READY` only from a
line that failed that test. Word-boundary matching is not an alternative:
`NOT READY` contains `READY` as a whole word, so `grep -w READY` matches a
failing verdict just as `grep READY` does. The order of the two tests is the
whole mechanism.

A report-only run emits exactly **one** `Verdict:` line, which is the other
half of why it is the mode to gate on. A `--fix` run emits one per pass —
Section 8 re-emits Section 5's report on every re-review — plus the one in its
completion output, so the run's verdict is the **last** `^Verdict:` line, never
the first. A caller that reads the first match on a `--fix` run reads the
verdict from before any fix was applied.

### What to carry forward

Sections 5 to 8 consume these — Section 6 takes `ASK_ITEMS`, Section 7 takes
`FIX_ITEMS`, and `VERDICT` is what Sections 5 and 8 report. Report them to
yourself before emitting the report, and substitute them literally into later
work:

| Value | Content |
|-------|---------|
| `VERDICT` | `READY` or `NOT READY` |
| `PERSPECTIVE_STATUS` | One entry per perspective A–J: its severity counts, or `not applicable`, or `not checked (format)`. Section 5's header block is emitted from this and from nothing else — the findings list can tell you a perspective's counts, but nothing in it distinguishes a perspective that was skipped from one that came back clean |
| `ASK_ITEMS` | Every finding whose disposition is `Ask`, ordered by the document section it belongs to, with the `§whole` ones first. When `FORMAT_OK` is `0` a finding about specific text is located by a quoted line rather than a `§n.n`, so there is no section to order it by: order those by the line's position in the file, after the `§whole` ones |
| `FIX_ITEMS` | Every finding whose disposition is `Fix now` |

`ASK_ITEMS` is ordered by document section, not by severity: Section 6 walks
the document in order and puts one card to the user per section. `§whole`
items sort ahead of every section, because they belong to none and Section 6
puts them on a card of their own before the walk starts.

## Section 5: Report

Emit the report in the conversation's language. The keys in it stay English:
the `Verdict:` prefix and `READY` / `NOT READY` (Section 4), the severity and
disposition labels (Section 4), the `spec` / `plan` document type (Section 2),
and each perspective's letter-and-name identifier (Section 3). Each is called
out as a key where it is defined, alongside what reads it — there is no
separate list to consult.

### Structure

```
── Review: docs/superpowers/specs/2026-08-29-foo-design.md (spec) ──
Verdict: ❌ NOT READY   Blocker 2 / Major 4 / Minor 3 / Ask 2

A Completeness   ⚠️ Blocker 1 / Minor 1
B Consistency    ⚠️ Blocker 1 / Minor 1
C Repo Grounding ⚠️ Major 1
D Blind Spots    ⚠️ Major 2
E Buildability   — not applicable (spec)
F Scope          ✓ clean
G Assumptions    ✓ clean
H Alternatives   ⚠️ Minor 1
I YAGNI          ✓ clean
J Acceptance     ⚠️ Major 1

[Findings]

[Blocker] §3.2 A Completeness
  The state storage mechanism is still TBD
  → an implementer cannot tell what to build
  Disposition: Ask (a design decision is required)

[Major] §whole D Blind Spots
  No test strategy section
  → verification method sends the work back to design after implementation
  Disposition: Fix now (write the standard section)

[Minor] §6.3 B Consistency
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
  and is counted straight off the findings list — the **unresolved** `Ask`
  items only, the same set Section 4's verdict formula reads. An `Ask` answered
  *keep the document as written* is unresolved and counts; one answered with a
  change is resolved and does not, even on a re-emitted report where the
  re-review detected the finding again (Section 8 reports that as an applied
  change that did not take). Counting the total instead prints `READY` beside a
  non-zero `Ask`, a verdict line that contradicts itself for the one reader the
  English string exists for
- Every finding appears in the findings list, not just the ones shown in the
  example above — the example is abridged
- The header line names `TARGET_FILE` in full, and the `--fix` hint repeats it
  verbatim. A bare `/forge:review-design --fix` re-runs the staged search and
  can land on a different document than the one this report is about. Wrap the
  path in **double quotes**, escaping any `"` in it as `\"` and any `\` as
  `\\` — Section 1 decodes exactly that, so one form covers every path with no
  carve-out left to reach. An unquoted `docs/my design/foo.md` is two tokens,
  and Section 1 treats a second remaining token as a second path and stops, so
  the hint would be an error the moment the reader runs it.

  Do **not** borrow Section 8's `'\''` escaping for this line. That is POSIX
  shell syntax, correct for the `git diff` pointer because a reader pastes that
  into a **shell**; Section 1's parser has no rule for it, so a hint escaped
  that way does not survive being typed back in. The two lines go to different
  readers, so they take different quoting — matching their shapes to each other
  is what breaks one of them
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

