# Put the findings to the user, apply, re-review

## Contents

- Section 6: Putting findings to the user
  - Entry card
  - Order: Ask before Fix now
  - One card per section
  - Building the choices
  - When a question is refused
  - What to carry forward
- Section 7: Applying changes
- Section 8: Re-review and exit
  - Loop
  - What to carry forward
  - Completion output
  - Handing off to implementation

## Section 6: Putting findings to the user

Reached only when `INTERACTIVE` is `1`, from Section 5's compact header. Every
finding that survived Section 3's challenge — `Ask` and `Fix now` alike — is
put to the user here as a question on a card; a `Reject` never is, since
there is nothing to choose about it and the compact header already showed it.

### Entry card

Before any finding is put to the user, one card with one question and three
choices, the recommended one first:

| Choice | What happens |
|--------|--------------|
| **Go through the findings one by one** (recommended) | Continue to the cards below |
| **Show the full report and stop** | Print Section 5's full report — the shape with the `[Findings]` list — without its hint line, write nothing, and stop |
| **Stop at the verdict** | Print nothing more, write nothing, and stop |

Skip the entry card when no finding survived the challenge — there is nothing
to choose — whether or not `Reject` entries were printed. The compact header
is then the whole output, and a `READY` plan still gets Section 8's *Handing
off to implementation* block. The card exists so that a reader who wants the
wall can have it, and so that a run started out of habit can be left without a
write.

### Order: Ask before Fix now

On each card, put the section's `Ask` questions before its `Fix now`
questions, and collect every answer before applying anything. Design decisions
cascade into the mechanical edits: deciding "SQLite, not Redis" changes every
later section that mentions Redis. Applying the mechanical fixes first means
redoing them — which is why Section 7 applies the whole batch at once, after
the last card.

### One card per section

Walk the document's sections in order. For each section that has findings —
`Ask` and `Fix now` alike — put its questions to the user as **one
multiple-choice card, at most four questions**. Sections with no findings
produce no card. If a section has
more than four, take the four highest-severity ones and put the rest on the
next card for that section.

A `§whole` finding belongs to no section, so the walk on its own would never
reach it. Put every `§whole` finding on a **first card, before the walk starts**,
under the same four-question limit and the same overflow rule. This is not an
edge case: `§whole` is the location for anything the document does not contain
at all, which is where most of D, G, H, I and J land, and **both** of Section
4's degradation findings are `§whole` `Ask`s. Dropping them would leave the
two findings that exist to keep a degraded review off `READY` as the only ones
the user is never asked about, and would make Section 7's precondition —
every question answered — impossible to satisfy.

When `FORMAT_OK` is `0` there are no sections to walk at all. Every finding is
then located either by `§whole` or by a quoted line, so there is nothing for
the walk to visit: put them all on cards in `ASK_ITEMS` order — the same
ordering applied to `FIX_ITEMS`, the two interleaved by location — under the same
four-question limit — the `§whole` ones on the first card as above, then the
line-located ones in file order. Without this the walk reaches none of them in
a formatless document, and Section 7's precondition — every question
answered — could never be met, on the one document that always carries at least one
`Ask` (Section 4's `FORMAT_OK` degradation).

Grouping by section keeps related questions together, and most documents only
have findings in a couple of sections.

On a second or later pass, carry every answer from the earlier passes with you.
A finding the user has already answered — an `Ask` with a choice, a `Fix now`
applied or kept, including either answered "keep the document as written" —
is settled, and is never put to them again, even when the re-review re-detects
the finding behind it.

### Building the choices

Every question shows the finding as the report would: its heading line, then
`Problem:`, `Before:` and `After:` — the reader decides from the same three
lines Section 5 prints, never from a summary of them, and under the same
labels in the conversation's language that Section 5 chose.

A `Fix now` question has two choices: **Apply** (recommended) — write the
`After:` text in place of the `Before:` text — and **Keep the document as
written**. An `Ask` question has the finding's alternatives from its *proposed
text*, the recommended one first, then **Keep the document as written**; the
four-choice limit leaves room for three alternatives, so when the *proposed
text* holds more, offer the three strongest and say in the question that
another can be typed as free text. Free text is an answer on either kind of
question — the harness always offers it.

Every question offers between two and four choices. **Keep the document as
written** — leave it alone, and say plainly that the finding stays unresolved
and counted, and that a `Blocker`, a `Major` or an `Ask` kept this way holds
the verdict at `NOT READY` (a kept `Minor` `Fix now` alone does not: Section
4's formula never counted it) — is one of them on **every** question, without
exception.

When the finding is a Perspective C mismatch, one of the other choices must be
**Match the repository** — change the document to agree with what is actually
there. On a finding that is not a repository mismatch (a TBD, an undefined
policy) there is nothing to match, so that choice is omitted and its slot goes
to a concrete alternative instead. The example below is one of those, which is
why it has no "Match the repository" line.

Fill the remaining slots with concrete alternatives. Give every choice a
one-line consequence.

Section 4's two degradation findings are the one case where the alternative is
not an edit to this document, and the two-choice minimum would otherwise have
nothing to meet it with. `FORMAT_OK` takes **Restructure the document into the
superpowers shape** — a real edit, which clears it. A plan with no companion
spec takes **Write the companion spec first and re-run**, which changes nothing
here: record it as a decline, not as a change, so the finding stays unresolved
and Section 8 does not report it as an applied change that did not take. That is
the whole of Section 4's "do not invent a way to clear it" — the choice may be
offered, but taking it does not clear the finding in this run.

That question takes a third choice, **The spec is at this path — use it**: the
lookup can fail on a spec that exists, and a user who knows where it is has no
way to say so otherwise. Take the path as free text and run *Spec
cross-reference*'s existence check against **that** path — not step 1, which
re-reads the plan's own `Spec:` line and is what already failed. If it
resolves, set `SPEC_FILE`,
drop the degradation finding, and run Perspective F's coverage check for real —
this is the one answer that clears this finding by supplying what was missing
rather than by editing the document. If the path does not resolve either, say so
and leave the finding unresolved.

The choices on a card are the ones the finding's *proposed text* listed — what
the report's `After:` line showed — each with its one-line trade-off, plus
*Keep the document as written*. A card that offers a choice the report did not
is a report that failed to preview the question.

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

### What to carry forward

| Value | Content |
|-------|---------|
| `ANSWERS` | One entry per finding put to the user — `Ask` and `Fix now` alike: the finding it belongs to, and the answer — a choice, *apply*, free text, or "keep the document as written" |

`ANSWERS` is the only carried value the user produced, and Section 8 reads it
on every later pass to tell a settled `Ask` from a new one. Carry it the way
Section 1 says to carry everything: in your context, restated as you go. It
accumulates across passes and is never reset.

### When a question is refused

A call to the question tool can be refused after Section 1 found the tool
listed — a permission setting, a harness that lists it but denies it. Treat a
refusal at the entry card or at any card after it the same way: set
`INTERACTIVE` to `0`, say in one line that the run fell back because a
question could not be put, print Section 5's full report without its hint
line, and stop **without writing** — including the answers already collected
on earlier cards. Section 7 writes once per pass and only after every
question is answered; a batch built from half the answers is neither. The
user re-runs in a session that can answer, or with `--report-only` to say the
report was all they wanted.

## Section 7: Applying changes

Once **every** question — `Ask` and `Fix now` alike — has an answer, apply the
answers in a **single pass** over the file.

Writing exactly once per pass is deliberate. The file is only ever changed as
one batch of targeted edits: a session interrupted anywhere in Sections 3-6
leaves it exactly as the previous pass left it, and a completed batch applies
every answer at once. That is why this command keeps no state files. (It is
also what makes it different from `finalize.md`, whose loop commits and pushes
on every iteration and therefore does need `.git/forge/` state.)

The batch itself is **not** atomic — it is several targeted edits, and one can
fail part way through. The write-failure rule below is what covers that case;
do not read "one batch" as a guarantee that no half-edited state can exist.

If there is nothing to apply — no `Ask` was answered with a change and no
`Fix now` was answered *Apply* — **write nothing** and go straight to Section
8. A clean
document is the expected happy path, and rewriting it to change nothing is not
a no-op: it risks paraphrasing prose no finding asked you to touch.

Rules:

- An `Ask` answered with "keep the document as written" produces **no edit**.
  The finding stays open.
- A `Reject` produces no edit.
- A `Fix now` answered **Keep the document as written** produces no edit
  either. It stays open and counted at its severity — a kept `Blocker` or
  `Major` holds the verdict at `NOT READY`, a kept `Minor` alone leaves
  Section 4's formula where it was — and is listed under *Kept as written* in
  the completion output.
- A `Fix now` is applied as the finding's *proposed text* — the lines the
  report's `After:` showed, in place of its `Before:`. The report is the
  preview of this pass; an edit that differs from it is one the user never saw.
- Preserve the document's existing heading structure and style. Do not reformat
  sections you are not changing. The one exception is an `Ask` answered
  **Restructure the document into the superpowers shape** — Section 6's choice
  for the `FORMAT_OK` degradation. That answer *is* a request to change the
  heading structure, and it is the only choice that can clear that finding, so
  apply it. Refusing it here would pin the document's `Blocker` at unresolved
  no matter what the user answered.
- If any edit in the batch fails, **stop and report**: name the edits that
  landed and the ones that did not, so the user can finish or revert by hand.
  Never continue to Section 8 on top of a partial write. Emit a
  `Verdict: ❌ NOT READY` line as the last line of that report, with the counts
  from the report you already have. Without it the last `^Verdict:` line in the
  run is the one from *before* any edit — a verdict describing a file that has
  since been half-rewritten, and exactly the stale read Section 4 warns an
  interactive run's caller about. A partial write is never `READY`, whatever the counts
  said beforehand.

After writing, continue to Section 8.

## Section 8: Re-review and exit

### Loop

If Section 7 wrote nothing, there is normally nothing to re-review: the file is
byte for byte what Section 3 already read, so another pass can only reproduce
the report you just emitted. Print this arrival's `pass n/3` line the same as any
other arrival, then — unless the exception in the next paragraph applies, which
you read before acting on this one — skip straight to *Completion output*
below, carrying the verdict you already have.

**Unless the run itself learned something the last report did not have.** That
justification is about the *file*, and one answer changes the review without
changing the file: Section 6's *The spec is at this path* sets `SPEC_FILE` for a
plan whose companion spec the lookup missed, and Perspective F's coverage check
then runs for real against a spec Section 3 never saw. Its findings — coverage
gaps that are routinely `Blocker`s — are not in the report you just emitted, and
taking the shortcut would drop them and the verdict they change. When
`SPEC_FILE` was set this pass and Section 7 wrote nothing, re-run Sections 3 and
4 anyway and re-emit Section 5's compact header; only the document is unchanged, so
re-use Perspective C's results exactly as the *Otherwise* branch below does.

Otherwise, re-run Sections 3 and 4 against the written file and re-emit
Section 5's compact header, then compare what it found against what this run has
already settled. Re-run Section 2's *Format check* as well, and its *Spec
cross-reference* when the batch touched a plan's `Spec:` line. `FORMAT_OK` and
`SPEC_FILE` are Section 2 values and Section 4's degradation table reads both,
so carrying a stale `FORMAT_OK` of `0` into a pass whose batch added the
missing `##` headings re-records a degradation the edit already cleared, leaves
`— not checked (format)` rows on perspectives that are now checkable, and
reports a change that landed as one that did not take. Perspective C's two
blocks are the exception: the
path-existence check and the CLAUDE.md `find` read the *repository*, and only
the document changed since the last pass. Re-use the results you already have,
and re-run a path check only for a path the batch you just wrote added or
altered. Re-using the `find` **output** is not the same as re-using the set of
CLAUDE.md files you read from it: which of them govern the document is decided
by the directories the document touches, so a batch that added a path under a
directory with its own CLAUDE.md means reading that file now, off the listing
you already have.
You are using those sections as a subroutine: **their own routing does not
apply here.** Section 5's closing line sends an interactive run to Section 6 —
ignore it and come back to this section instead. (Section 5's hint needs no
such exemption: its own condition already requires `INTERACTIVE` to be `0`,
and it never is on this path.)

Go back to Section 6 for every **new finding, at any severity and either
disposition** — meaning one this run has neither resolved, applied, nor had
declined. A new `Blocker` and a new `Minor` are questions just the same: the
cards are how every counted finding reaches the user, and severity only
orders them on the card. A finding the user has already answered — an `Ask`
with a choice, a `Fix now` applied or kept — is neither: it is settled, it
stays settled, and settled means it is not put to them again. Restate its
recorded outcome and move on.

**A finding this run dispositioned `Reject` is settled on the same terms.** It
produces no edit, so the re-review detects it again on every later pass, exactly
as a declined `Ask` does — and a `Reject` you re-dispositioned as an `Ask` would
be "new" by the rule above and go back to Section 6, putting a question to the
user about a finding this run already called a false positive, pass after pass
until the cap fires. Carry the rejections forward the way `ANSWERS` is carried,
restate the one-line reason, and keep them out of the counts: Section 4 says a
`Reject` contributes to no severity total, and that holds on a re-emitted report
too.

Settled covers both answers, and they part on the verdict:

- Answered with **"keep the document as written"** — nothing was written for
  it, so it is re-detected on every later pass, and it stays **unresolved**: a
  declined `Ask` keeps the document at `NOT READY`.
- Answered with a **change** — it is **resolved**, and drops out of the `Ask`
  total. Normally the change removes it and the re-review does not see it
  again. If the re-review still detects it, the edit did not land what was
  asked: say so in the completion output, as an applied change that did not
  take, rather than reopening a question that is settled.

**"Resolved" scopes to the `Ask` axis and to nothing else.** A re-detected
finding still carries its severity, still appears in the findings list, and
still counts in the header block and on the verdict line — so a `Blocker` whose
fix did not land holds the document at `NOT READY`, as it must. Dropping the
severity too would print `READY` over a defect this run just failed to remove,
which is the one thing the verdict exists to prevent. What "settled" buys is
that the *question* is not asked again, not that the *defect* stops counting.

Without the split, the one case the rules do not name — an answered-with-a-
change finding the re-review still sees — is as readable as `READY` over an
open `Ask` as it is as `NOT READY` forever.
`finalize.md` carries the same rule for the same reason — without it the loop
ping-pongs on one contested finding until the cap fires.

A **new `Fix now`** goes back to Section 6 like a new `Ask`: it is put on a
card, and applied in the next batch only if the user takes it. When one
re-review turns up both a new `Ask` and a new `Fix now`, that is still a
single pass, not two: Section 6's *Ask before Fix now* order holds on the
card, and Section 7 applies both answers in the same batch. The return path
costs a pass and is counted below.

When the re-review turns up **neither** — no new `Ask` and no new `Fix now` —
the loop has converged: do not go back, and continue to *Completion output*
below with the verdict this re-review produced. Falling through is the exit.
Nothing else has to fire for the loop to end, and the cap is the other exit,
not the only one.

"New" means on this axis what it means on the `Ask` axis: one this run has
neither applied nor had declined. A `Fix now` this run *did* apply and the re-review still
detects is **not** new — the edit did not land what it was for. Do not send it
round again to be re-applied blind; report it in the completion output exactly
as a re-detected answered `Ask` is reported, as an applied change that did not
take. Either way it keeps its severity and its place in the counts, so a
`Blocker` whose fix did not land still holds the document at `NOT READY`.

Section 4 promises that every counted finding reaches the user; routing only
`Blocker`/`Major`/`Ask` back would break that promise for a `Minor` `Fix now`
the re-review turned up, and drop it without a word. If the cap fires with
findings that were never put on a card, **list them in the completion
output** rather than dropping them.

Count the passes yourself. The count lives in your context alongside
`TARGET_FILE` and the other carried values, for the same reason they do: each
bash block may run as a separate shell, and this command writes no state files.
Start it at 1 the first time you reach this section, and add one each time you
return to it. Before going back to Section 6 or 7, stop when the count is
**greater than or equal to** the cap — the same `-ge` test `finalize.md` uses,
so the default cap of 3 allows three passes and no fourth.

The count is the **one** carried value with no anchor outside your context:
`TARGET_FILE` is on disk, the answers were typed by the user, but the count is
only remembered. So print it — literally `pass n/3`, in English, for the
same reason every other key in this command stays English: this line is read
back mechanically, and a translated one cannot be. Print it every time you arrive
here and it survives in the transcript. To recover the count on arrival, read
back every `pass n/3` line emitted **before** this arrival, take the
highest `n`, and **add one** — that sum is this arrival's count, and it is what
you print. Do not read the highest `n` as the count itself: it is the
*previous* arrival's number, so taking it verbatim pins the counter where it
already stands and lets the loop run past the cap forever. Read only those
lines, not the *Re-review after fixes* headers — that header belongs to
*Completion output* below and is emitted once, on the way out, so counting it
would read every pass as the first. Count only the lines **you** emitted on
arriving here, never one inside quoted document text: when `FORMAT_OK` is `0` a
finding quotes the offending line verbatim, and a target that documents this
command — every file under `skills/review-design/` is itself a hit on Stage 3's
`*design*` net — carries `pass n/3` in its own prose. Reading a quoted line as an arrival
inflates the count and ends the loop early.

**No `pass n/3` line yet means this is the first arrival and the count is
1** — the highest `n` is 0 and the rule above adds one, so the two rules agree.
That is the expected state, not a failure to establish it. "Cannot
establish" means the lines are there but unreadable or mutually inconsistent.
**In that case treat the count as at the cap and exit** — fail closed, because
a count you cannot read is a count that may already be past 3. Reading an empty
transcript as "cannot establish" would fail the loop closed on its very first
pass and apply nothing at all.

The cap is **3, fixed** — lower than the review loop in `finalize.md`, which
allows 10. Code has CI as an outside judge; a design document does not. Each extra pass is the same context
re-reading prose it just wrote, and the returns fall off quickly. **The only
information entering the loop from outside is the answers the user gave.**

That sentence is also why this cap takes **no environment override**, where the
caps in `finalize.md` and `watch.md` do. What those two bound is **waiting on
something external** — a code-review agent, a CI run — whose speed only the
operator knows, so an override there has a setting worth typing. This cap bounds
this context re-reading its own prose. Raising it cannot add information the
loop does not have, and lowering it saves nothing, because a converged loop
exits on its own without reaching the cap. A knob with no useful position is not
a feature: making the number settable is what creates the unset, non-numeric,
zero and disagreeing-between-passes cases, and every one of them was then a rule
this section had to carry.

On reaching the cap, report the current verdict and exit **normally**. Hitting
the cap is a result, not an error.

It is usually `NOT READY` — the cap only fires while something is still routing
back — but do not assume it. A cap that fires with nothing outstanding but a
`Minor` `Fix now` leaves `Blocker 0 / Major 0 / Ask 0`, which is `READY` by the
formula in Section 4. Report whatever the formula gives, list the unapplied
`Fix now` items beside it, and when that verdict is `READY` say in one line
that it was reached with fixes still unapplied — including above the *Handing
off to implementation* block, which a `READY` plan reaches on this path too.

### What to carry forward

| Value | Content |
|-------|---------|
| `PASS_COUNT` | This arrival's pass number. Carried the way Section 1 says to carry everything, and printed as `pass n/3` on every arrival so it survives in the transcript — it is the only carried value with no anchor on disk or in the user's answers |

### Completion output

Emit four things:

1. The verdict from the final re-review
2. A bulleted summary of what changed
3. A bulleted list of what the user kept as written — every finding answered
   *Keep the document as written*, `Ask` or `Fix now`, with its disposition —
   omitted when empty. When the verdict is `READY` and this list is not, say
   in one line above the list that `READY` was reached with findings kept as
   written — the same line the cap path prints — including above the
   *Handing off to implementation* block
4. A pointer to `git diff` for the details

```
── Re-review after fixes ──
Verdict: ❌ NOT READY   Blocker 0 / Major 1 / Minor 1 / Ask 1

Applied:
  • §3.2  state storage: TBD → SQLite (your answer)
  • §3    retry count: unified on 3 (§2 was authoritative)
  • §7    added a test strategy section
  • §6.3  unified "job" / "task" terminology

Kept as written:
  • §5    error handling left undefined (Ask, kept)
  • §whole  no hit/miss counter (Fix now, kept)

Review the changes with: git diff -- '<target file>'
```

The pointer line is shown with the path already single-quoted, which is the
shape the block below emits. **That block is authoritative** — it also escapes
any `'` inside the path, which no fixed example can show. Never copy an
unquoted pointer into a real report.

The example continues the abridged report in Section 5, so its `Applied:` list
is abridged the same way — it shows four of the changes, not all of them, which
is why four bullets do not account for every count that report carried.

When Section 7 wrote nothing, the header is wrong too: no fixes were applied,
so title that block `── No changes applied ──` rather than
`── Re-review after fixes ──`. Items 2 and 4 also have no subject: emit
the verdict, say in one line **why** nothing was written, and print no
`Applied:` list and no `git diff` pointer. The *Kept as written* list (item
3) is printed whenever it has entries — on this path it usually holds every
finding the user declined, and that list is the record of why nothing was
written. An empty bullet list under
`Applied:` and a diff pointer at an unchanged file both read as "something
happened here" when nothing did.
The three reasons are not interchangeable: *no change was needed* when there was
nothing to apply; *every proposed change was declined* when the file is
unchanged because every card was answered "keep the document as written"; and
*the companion spec was supplied and the plan re-reviewed against it* on the one
path where Section 7 writes nothing and the *Loop* above re-reviews anyway —
Section 6's *The spec is at this path* set `SPEC_FILE`. Reporting the second as
the first leaves the `NOT READY` beside it unexplained. The third is the reason
this block does not say "and no re-review ran": on that path one did, its
Perspective F coverage findings are the reason the verdict moved, and the
re-emitted Section 5 report above carries them — say which of the three it was
rather than letting an unchanged file imply the run learned nothing.

`git diff` reports tracked files only. Design documents often sit in an ignored
or untracked directory — a repository that keeps `docs/superpowers/` out of git
is a common case — and there `git diff` prints nothing at all. Check before you
print the pointer, and emit whichever line actually shows the change:

```bash
# Same rule as the Spec: lookup above — bind the path, never inline it. And the
# same root as the staged search and Perspective C: `TARGET_FILE` is relative to
# the repository root, so from a subdirectory `git ls-files` would miss it and
# call a tracked document untracked.
FORGE_ROOT=$(git rev-parse --show-toplevel) && cd "$FORGE_ROOT" || exit 1

IFS= read -r FORGE_TARGET <<'FORGE_TARGET_PATH'
<target file>
FORGE_TARGET_PATH

if git ls-files --error-unmatch -- "$FORGE_TARGET" >/dev/null 2>&1; then
  # Both `printf` lines below are user-facing — translate the sentence around
  # the path to the conversation's language. `git diff --` is a command the
  # reader pastes: keep it, and the path, byte for byte.
  #
  # Single-quote the path: this line is a command the reader copies and runs,
  # and the same rule Section 5 puts on the hint applies here — an
  # unquoted `docs/my design/foo.md` pastes as two pathspecs and diffs neither.
  # Escape each `'` in the path as `'\''` first, so one rule covers every path.
  # There is no un-quotable path, and printing one bare is not a safe fallback:
  # a filename may legally contain `'`, `$`, `(` and `)` — only `/` and NUL are
  # illegal — so a planted `2099-12-31-a'b'$(...)-design.md` printed bare puts
  # the substitution back in unquoted context and runs it the moment the reader
  # pastes the line. Telling them to "quote it by hand" does not help either:
  # double quotes still expand `$(...)`.
  FORGE_Q=$(printf '%s' "$FORGE_TARGET" | sed "s/'/'\\\\''/g")
  printf "Review the changes with: git diff -- '%s'\n" "$FORGE_Q"
else
  printf '%s is not tracked by git — open it to review the changes\n' "$FORGE_TARGET"
fi
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
