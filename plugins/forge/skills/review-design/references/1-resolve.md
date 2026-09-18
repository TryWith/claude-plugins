# Resolve the target

## Contents

- Section 1: Arguments
  - Arguments
- Section 2: Target resolution
  - When `<path>` is given
  - When `<path>` is omitted — staged search
  - Document type
  - Spec cross-reference (when the target is a `plan`)
  - Format check
  - What to carry forward

## Section 1: Arguments

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

**Quotes group.** A single- or double-quoted argument is **one** token however
many spaces it holds, so `/forge:review-design "docs/my design/foo.md" --fix`
resolves to one path; strip the quotes before using the value. Inside a
double-quoted argument, `\"` is a literal double quote and `\\` a literal
backslash. That pair is what lets **one** quoting form cover every path,
including a path holding both quote characters — without it there is a shape
Section 5 can print and this section cannot decode. Section 5's rule that the
`--fix` hint quotes the path has nothing to lean on without this, and would
print a hint this section then rejects as two paths.

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

This is the first place a caller-supplied path meets a shell, so the binding
rule in *What to carry forward* below applies to it already — do not wait until
that section to start obeying it. Bind the path through a quoted heredoc and
test the variable, never the argument text:

```bash
# Same root as every other block in this command. A relative `<path>` is taken
# as relative to the **repository root**, which is what Perspective C and
# Section 8's `git ls-files` both assume. Testing it against the caller's cwd
# instead would accept `foo-design.md` typed inside `docs/superpowers/specs/`
# here and then call that same file missing and untracked further down.
FORGE_ROOT=$(git rev-parse --show-toplevel) && cd "$FORGE_ROOT" || exit 1

IFS= read -r FORGE_TARGET <<'FORGE_TARGET_PATH'
<the path the caller passed>
FORGE_TARGET_PATH

# `ok`, `missing`, `not-a-regular-file` and `unreadable` are markers you read
# back out of this block's own output, not messages to the user — keep them
# English, and report the outcome to the user in the conversation's language
# yourself. They are four markers rather than one because the section above
# says to *say* which of the three failures it was: a typo, a directory and a
# permission problem need different things from the reader, and one `unusable`
# cannot tell them apart.
if [ ! -e "$FORGE_TARGET" ]; then
  echo "missing"
elif [ ! -f "$FORGE_TARGET" ]; then
  echo "not-a-regular-file"
elif [ ! -r "$FORGE_TARGET" ]; then
  echo "unreadable"
else
  echo "ok"
fi
```

Every bash block in this command opens with that same `FORGE_ROOT` line, so
**none of them produces any output outside a git repository** — the assignment
fails and the block exits. That is not "nothing found": when `rev-parse` fails,
say the command has to be run inside a git repository and stop. Reading the
empty output instead reports a repository with no design documents, or a
document whose every path is missing.

A path given here still goes through *Document type* below, so passing a path
removes the search questions but not the type question. A path that is
self-typing — under `specs/` or `plans/` but not both, or ending in
`-design.md` — removes that one too, and is what an unattended caller should
pass.

### When `<path>` is omitted — staged search

`superpowers:brainstorming` states that "User preferences for spec location
override this default", and `superpowers:writing-plans` says the same of plan
location, so the default paths are a starting point, not a guarantee. Search in
this order and stop at the first stage that yields a candidate:

```bash
# Every stage below is written relative to the repository root — Stage 3's
# comment says "anywhere in the repository", and Perspective C resolves the
# paths a document names from the root too. Move there first: invoked from a
# subdirectory these `find`s would otherwise walk that subtree alone, report
# "nothing found" for a document sitting one level up, and — through the
# *Spec cross-reference* rerun below — raise the "no companion spec" `Major`
# that step exists to prevent. Assign before `cd`: `cd "$(...)"` on one line
# succeeds on an empty substitution and silently keeps the wrong directory.
FORGE_ROOT=$(git rev-parse --show-toplevel) && cd "$FORGE_ROOT" || exit 1

# Stage 1 — the documented default locations
find docs/superpowers/specs docs/superpowers/plans -name '*.md' -type f 2>/dev/null | sort

# Stage 2 — anywhere under docs/ that looks like a design document.
# Match on the *path*, not just the basename: superpowers names plans
# `YYYY-MM-DD-<feature-name>.md`, with no "plan" token in the filename, so a
# relocated plan is only reachable through its directory.
# Prune dot-directories and node_modules for the same reason Stage 3 does:
# `docs/.cache/` and a vendored `docs/node_modules/` hold no design document,
# and a hit inside one is a false candidate this command would then ask about.
find docs \( -type d \( -name '.?*' -o -name node_modules \) \) -prune -o \
  -type f -name '*.md' \
  \( -path '*/specs/*' -o -path '*/plans/*' -o -path '*design*' -o -path '*plan*' \) \
  -print 2>/dev/null | sort

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

Those three `find`s are three **stages**, not one command: run them one at a
time, in order, and stop at the first that prints any line. Issued as a single
block they all run — including Stage 3's full-repository walk after Stage 1
already answered — and their outputs concatenate with nothing to separate them,
leaving the rule below, which turns on *which stage* a candidate came from,
nothing to read.

**Stage 3 is issued in the merged form below**, never in the plain form printed
above. Perspective C has to walk the whole repository as well, for the
`CLAUDE.md` / `CLAUDE.local.md` files it reads, and Section 3 says to issue that
walk *here* so the repository is traversed once rather than twice. The command
is written out here, at the point it is issued, rather than described: merging
it by hand is a trap. `find`'s implicit `and` binds tighter than `-o`, so
pasting `-o -name 'CLAUDE.md'` onto the end of Stage 3's expression detaches it
from the leading `-type f` **and** leaves `-print` attached to that last
alternative alone — the command then prints only the `CLAUDE.local.md` hits and
none of the `*.md` candidates, which in a repository with no `CLAUDE.local.md`
is no output at all, indistinguishable from a clean search. Both `CLAUDE.md` and
`CLAUDE.local.md` already match `-name '*.md'`, so the extra alternatives belong
**inside** the existing parenthesised group, not beside it:

```bash
# Same root as both halves it merges — Perspective C's own CLAUDE.md `find`
# inherits the `cd` at the top of that block, and the staged search does its
# own. Without it a run from a subdirectory never sees the repository-root
# CLAUDE.md, the one file that perspective is told to read first.
FORGE_ROOT=$(git rev-parse --show-toplevel) && cd "$FORGE_ROOT" || exit 1
find . \( -type d \( -name '.?*' -o -name node_modules \) \) -prune -o \
  -type f -name '*.md' \
  \( -path '*/specs/*' -o -path '*/plans/*' -o -path '*design*' -o -path '*plan*' \
     -o -name 'CLAUDE.md' -o -name 'CLAUDE.local.md' \) \
  -print 2>/dev/null | sort
```

Carry both sets of hits forward: Perspective C re-uses this output instead of
running its own walk.

Because Stage 3 is issued that way, its output also carries the `CLAUDE.md` /
`CLAUDE.local.md` hits that the other half of the merge is for. **Those are
never design-document candidates.** Separate them out by filename before
applying any rule below, and keep them for Perspective C. Without this, a
repository that has a root `CLAUDE.md` and no design documents at all gets
`./CLAUDE.md` as its only Stage 3 line, *stop at the first stage that prints
any line* takes it as the candidate, and the "every stage came up empty"
branch below — the one that tells the user to pass an explicit path — never
fires. The user is offered their conventions file as the document to review.

**The same trap has a second door, and this repository falls through it.**
`*design*` matches every file of this command: `SKILL.md` and each file under
`references/` in `plugins/forge/skills/review-design/`, since all of them sit
below a directory named `review-design`. With `docs/superpowers/` in
`.gitignore`, which is how this repository keeps design documents out of git,
a fresh clone has no design documents at all: Stages 1 and 2 print nothing and
those files are Stage 3's **only** lines. So **exclude the files of the plugin
this command ships in — its `commands/` files and every file under its
`skills/` directory**, on the same terms as the `CLAUDE.md` hits and for a
sharper reason: a file that *describes* this reviewer is not a document *for*
it, and offering it puts a question to the user whose only honest answer ends
the run with nowhere to go.

When removing both groups leaves nothing, that **is** the empty case — take the
"every stage came up empty" branch rather than asking about whatever survived.

`*design*` and `*plan*` are a wide net: they match any path that merely
contains the word, this command's own files included. **Never take a candidate
that only those two patterns matched silently** — put it to the user as a
multiple-choice question even when only one came back, and do the same for every
Stage 3 candidate however it matched. Stage 1, and a Stage 2 candidate that
matched `*/specs/*` or `*/plans/*`, sit in a directory the conventions name;
everything else is a guess, and a guess is confirmed before it is reviewed.

`find` prints paths, not the pattern each one matched, and `*plan*` matches
everything `*/plans/*` does — so the output alone cannot tell a named directory
from a guess. Re-test each returned path yourself for a `specs/` or `plans/`
component, the same component test the *Document type* table uses; a path that
has neither matched only `*design*` or `*plan*` and is a guess.

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

`spec` and `plan` are the two `DOC_TYPE` values, and `DOC_TYPE` reaches the
output verbatim twice — the `(spec)` on Section 5's header line, and the
`— not applicable (<type>)` rows beneath it, which a reader reconciling the
report against this table matches on. They are identifiers, not prose: emit
them in English whatever language the rest of the report is written in.

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
3. The same, in whatever directory this repository actually keeps its specs.
   Re-use what the staged search turned up **only when it reached Stage 3**.
   Stage 1 looks no further than `docs/superpowers/` and Stage 2 no further
   than `docs/`, so a search that stopped at either never looked where a
   relocated spec lives, and re-using its hits reports "no companion spec" for
   exactly the repository this step exists to cover. When `<path>` was given
   the search did **not** run at all — and an explicit path is the recommended
   unattended form, so that is the common route, not the rare one. In every
   case but a search that already reached Stage 3, run
   Stage 3's `find` yourself and read **every** hit it returns before concluding
   there is no companion spec — not only the `*/specs/*` ones. **Every hit**
   means every *design-document candidate*: the two groups the staged search
   separates out above — the `CLAUDE.md` / `CLAUDE.local.md` hits the merged
   form carries, and the files of the plugin this command ships in — are not
   candidates here either. A plan with no companion spec is exactly the case
   that reaches this step, and it is the case where a conventions file or one of
   this command's own `references/` files would otherwise be the best-ranked hit
   left. This step exists
   for the repository that does **not** keep its specs in a directory named
   `specs/`; filtering the hits down to that name asks the question the step was
   written to stop asking, and Stage 2's own rationale below already grants that
   a spec can sit at `docs/architecture-design.md` with no `specs/` component at
   all. Rank the hits by date-and-topic match against the plan's filename and
   take the best; if two or more tie, or the best match is only a guess, ask
   rather than pick — **but only when `FIX_MODE` is `1`.** A report-only run
   never asks anything a self-typing `<path>` did not already settle, and this
   step is reached with such a path on the recommended unattended route. When
   `FIX_MODE` is `0`, take no spec: record the "no companion spec" degradation
   below, name the tied or guessed candidates in it so the reader can pass one
   explicitly, and continue. Stage 3 alone: it is rooted at `.` and Stage 2
   at `docs/`, so it already returns everything Stage 2 would, and running both
   walks the repository twice for one set of hits. The preference that overrides
   the default spec location overrides it for this lookup too; stopping at step
   2 reports "no companion spec" for every repository that relocated its specs,
   and Section 4 turns that into a `Major` the document can never clear

```bash
# TARGET_FILE reaches a shell here, so it gets the same treatment Perspective C
# gives document-named paths: bound through a quoted heredoc, never substituted
# into the command text. Double quotes are NOT enough — `$(...)`, backticks and
# `${...}` expand inside them, and a `"` in the path closes the string. A plan
# committed as `2099-12-31-$(sh payload).md` would otherwise run `sh payload`
# before `grep` ever started, and the `|| true` below would swallow the error.
# TARGET_FILE is repository-root-relative, so this block moves there like every
# other one. Without it a run started from a subdirectory resolves the path
# against the wrong cwd, `grep` finds nothing, and the plan is recorded as
# having no `Spec:` line — a `Major` the document can never clear.
FORGE_ROOT=$(git rev-parse --show-toplevel) && cd "$FORGE_ROOT" || exit 1

IFS= read -r FORGE_TARGET <<'FORGE_TARGET_PATH'
<the plan file>
FORGE_TARGET_PATH

# `|| true` — a plan with no Spec: line is a fall-through, not a failed block.
grep -m1 '^\*\*Spec:\*\*' -- "$FORGE_TARGET" || true
```

**Normalise the value before treating it as a path.** The `Spec:` line is
markdown, so what follows the prefix carries decoration: strip `**Spec:** `,
then surrounding backticks, and unwrap a markdown link — `[text](path)` yields
`path`. `writing-plans` fixes no single form, and the backticked one is
ordinary: this repository's own plan reads ``**Spec:** `docs/superpowers/specs/…-design.md` ``,
and a check that keeps the backticks reports it missing. Skipping this step
turns a well-formed plan into the "no companion spec" `Major` — which a
report-only run can never clear, so the plan is pinned at `NOT READY` with
nothing it could say to fix it.

The normalised path is resolved **relative to the repository root**, like every
other path here. A `Spec:` line written relative to the plan's own directory
(`../specs/foo.md`) therefore will not resolve: treat that as the step-1 miss it
is, fall through, and record a Perspective C finding quoting the form that was
found — the line is not wrong, it is written against a different base than this
command reads.

Check that the path the `Spec:` line names actually exists before accepting it.
That path came out of the document, so it is untrusted: bind it with the same
quoted heredoc this block uses for `$FORGE_TARGET` and test `[ -e "$FORGE_SPEC" ]`
— never substitute it into the command text. If it does not exist, fall through
to step 2, and failing that to the "no spec found" branch below — a `Spec:` line
pointing at a moved or deleted file is itself a Perspective C finding.

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

**`TARGET_FILE` and `SPEC_FILE` never go into a shell command as text.** Both
are chosen by something outside this command — a caller's argument, a filename
sitting in the repository, a line inside the document — so both are untrusted.
Bind them through a quoted heredoc the way Perspective C binds document-named
paths, and reference the shell variable. That binding is what makes `$`, a
backtick, `"` and `\` safe — inside a quoted heredoc they are literal, so a path
carrying them is bound and used like any other, and refusing it here would
reject an ordinary filename the mechanism already neutralised. The one thing
the binding cannot carry is a **newline**, or a line equal to the heredoc
delimiter: `read` stops at the first line. For those, do not put the path in a
shell command at all — read it with the Read tool and report the path as
suspicious rather than reviewing it silently.

Then continue to Section 3.

