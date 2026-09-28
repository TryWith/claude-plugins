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
are not keys: nothing reads them mechanically — a caller greps the `Verdict:`
prefix and `READY` / `NOT READY` below, never the counts beside them — so emit
them in the conversation's language. Choose one word for each and use that
same word everywhere the label appears: the verdict line, the header block and
every finding's heading. The reconciliation is done by eye, and two words for
one label make it fail.

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
| `Fix now` | The answer is uniquely determined — the finding's *proposed text* is one replacement | Put to the user as *apply / keep the document as written*; applied when they take it |
| `Ask` | A design decision is required — the *proposed text* is a set of choices. Perspective C mismatches go here by default | Put to the user as a multiple-choice question |
| `Reject` | False positive — a finding Section 3's *Challenge every finding* refuted | Reported with a one-line reason |

`Fix now`, `Ask` and `Reject` are emitted in the conversation's language the
same way, one fixed word each. Section 8 routes on the disposition and the
verdict formula counts unresolved `Ask` items, but both read the carried values
below — `ASK_ITEMS`, `FIX_ITEMS` — and not the printed word, so the
translation costs them nothing.

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

On a report-only run no `Ask` is ever put to the user, so any `Ask` at all leaves the
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

**The line starts with `V`, and nothing else.** No bold, no heading marker, no
bullet, no blockquote, no leading spaces — a caller matches it at the start of a
line, and `**Verdict: ❌ NOT READY**` does not start with `Verdict:`. Markdown
emphasis around the line is the one decoration that looks harmless and is not:
it has been observed, it moves the first character, and it costs the caller the
whole verdict. Rendering the report block as preformatted text is fine — the
fence sits on its own line and the verdict still begins its own — but nothing
may precede `Verdict:` on the verdict line itself.

A report-only run emits exactly **one** `Verdict:` line, which is the other
half of why it is the mode to gate on. An interactive run emits one per pass —
Section 8 re-emits Section 5's compact header on every re-review — plus the
one in its completion output, so the run's verdict is the **last** `^Verdict:`
line, never the first. A caller that reads the first match on an interactive
run reads the verdict from before any fix was applied.

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
| `CHALLENGE_COUNTS` | From Section 3's *Challenge every finding*: the number of findings challenged and the number rejected. Section 5 prints them under the header block |

`ASK_ITEMS` is ordered by document section, not by severity: Section 6 walks
the document in order and puts one card to the user per section. `§whole`
items sort ahead of every section, because they belong to none and Section 6
puts them on a card of their own before the walk starts.

## Section 5: Report

Emit the report in the conversation's language. The keys in it stay English:
the `Verdict:` prefix and `READY` / `NOT READY` (Section 4), the `spec` /
`plan` document type (Section 2), and each perspective's letter-and-name
identifier (Section 3). Each is called out as a key where it is defined,
alongside what reads it — there is no separate list to consult. The severity
and disposition labels are **not** keys: Section 4 has them emitted in the
conversation's language, one fixed word each, and the example below shows them
in English only because this file is written in English.

### Two shapes

Section 5 has two shapes, and `INTERACTIVE` picks one:

- `INTERACTIVE` is `0` — the **full report** under *Structure* below: header
  block, challenge line, every finding with its three lines, the hint. It is
  the whole output of a report-only run, and it is also what an interactive run
  prints when the user asks for it from Section 6's entry card or when a
  question is refused (Section 6) — in both of those cases without the hint.
- `INTERACTIVE` is `1` — the **compact header**: the same opening lines — the
  `── Review:` line, the verdict line, the header block, the challenge line —
  followed by the `Reject` entries alone, each as its heading and `Problem:`
  line, under a `[Rejected]` heading that is omitted when there are none. No
  `[Findings]` list and no hint: the findings are about to be put to the user
  one by one, and printing them first is the wall the cards replace. Section 6
  takes over from the compact header.

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

Challenged: 10 findings / rejected 1

[Rejected]
[Reject] §4 C Repo Grounding
  Problem: Flagged `src/db/sqlite.ts` as missing; it exists (`ls src/db/`).
```

The verdict line is identical in both shapes, and Section 4's rules for it
bind both: a CI job reading an interactive run's transcript finds the same
`Verdict:` line in the same place. Every rule under *Rules for the header
block* below applies to the compact header too, except the ones about the
findings list and the hint, which it does not print.

### Structure

The full report:

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

Challenged: 10 findings / rejected 1

[Findings]

[Blocker] §3.2 A Completeness — Ask
  Problem: The state storage mechanism is still TBD, so an implementer cannot tell what to build.
  Before:  The storage mechanism for cached entries is TBD.
  After:   Choose one — (a) the existing SQLite store: no new dependency; (b) Redis: one more service to run; (c) a plain file: simplest, weak under concurrent writes

[Major] §whole D Blind Spots — Fix now
  Problem: There is no test strategy section, so how the work is verified gets decided after implementation and sends it back to design.
  Before:  none
  After:   ## 7. Test strategy
           - Unit: cache hit, miss and expiry against an in-memory store
           - Integration: one round trip through the HTTP client with the cache on
           - Acceptance: the criteria in §8, run as a script

[Minor] §6.3 B Consistency — Fix now
  Problem: "job" and "task" name the same thing.
  Before:  Each job is retried; a task that fails three times is dropped.
  After:   Each task is retried; a task that fails three times is dropped.

[Reject] §4 C Repo Grounding
  Problem: Flagged `src/db/sqlite.ts` as missing; it exists (`ls src/db/`).

→ To work through these interactively: /forge:review-design "docs/superpowers/specs/2026-08-29-foo-design.md"
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
  the verdict line carries the `Ask` total, and each finding carries its own
  disposition on its heading line below
- One line under the header block gives Section 3's `CHALLENGE_COUNTS`: how
  many findings were challenged, how many rejected. On a report with no
  `[Reject]` in it, this line is the only evidence the challenge ran
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
- The header line names `TARGET_FILE` in full, and the hint repeats it
  verbatim. A bare `/forge:review-design` re-runs the staged search and
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
- **The hint is printed only when `INTERACTIVE` is `0` because `--report-only`
  was passed or the question tool is unavailable, and the report carries at
  least one `Fix now` or `Ask`.** An interactive run printing the full report
  from its entry card is already interactive and must not tell the reader to
  start one; a run that fell back because a question was refused cannot offer
  one either (Section 6); and a report with nothing to decide has nothing for
  the cards to do — on a `READY` report with no findings, an interactive run
  would re-read the document, ask nothing, write nothing and print this same
  header

Each finding is a heading line and three labelled lines under it. The heading
is `[Severity] location Perspective — Disposition`: the disposition sits on the
heading so that the body is only the three things a reader needs in order to
act. The body is:

- `Problem:` — Section 3's *finding* and *consequence*, at most two sentences,
  written for a reader who has not opened the code or the repository: what is
  wrong, then what goes wrong if the document ships as written. Drop the
  second sentence when the first makes it obvious. No call chains, no
  `file:line` trails, no method-by-method narration — the two lines below
  carry the specifics. At most one file or symbol, and only one the reader has
  to go to. A finding that rests on an inference rather than on something run
  or opened ends with the one-word tag Section 3 asked for.
- `Before:` — Section 3's *current text*: the document's own words, verbatim,
  indented under the label and never paraphrased. *none* for a `§whole`
  finding.
- `After:` — Section 3's *proposed text*. For a `Fix now`, the lines that
  replace `Before:`, in full, so a reader sees the whole change without opening
  the file and Section 7 applies exactly what was shown. For an `Ask`, the
  choices, one line each with the recommended one first — the same choices
  Section 6 puts on its card.

Do not fold the three back into a paragraph, and do not drop `Before:` /
`After:` from a finding that has them. The consequence is what justifies the
severity, and a reader needs to be able to disagree with it; the before/after
pair is what lets the fix be checked before it is applied.

A `Reject` is the one exception. It counts toward no severity total, so heading
it `[Blocker]` would put the findings list at odds with the header block the
rule above just reconciled. Head it `[Reject] location Perspective`, with no
disposition; its `Problem:` is the one-line reason from Section 3's *Challenge
every finding*; it has no `Before:` and no `After:`. Rejects come **after**
every counted finding, so a reader who stops at the last counted one has seen
everything that bears on the verdict.

If the document was not in the expected format, or a plan's companion spec
could not be found, say so **above** the verdict line.

### Where to stop

When `INTERACTIVE` is `0`, the full report is the whole output. **Do not
modify the target file, and do not ask the user anything** — everything from
here on is report generation, and a report that cannot alter its subject and
cannot block on an answer is what makes an unattended run possible. Target
resolution back in Section 2 is the only step that can ask, and only for a
path that is not self-typing. Print the hint — subject to the condition in
*Rules for the header block* above, which is the only place that decides
whether it is printed at all — and stop.

When `INTERACTIVE` is `1`, print the compact header and continue to Section 6.

One thing does still follow the report on the report-only exit: when
`DOC_TYPE` is `plan` and `VERDICT` is `READY`, emit Section 8's *Handing off to
implementation* block before stopping. Report-only is the mode a gate runs in,
so it is the mode most likely to produce the `READY` plan that block exists
for; leaving it reachable only on an interactive run hides the next step from every run
that had nothing to fix.

