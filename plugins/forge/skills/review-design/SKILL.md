---
description: Review a superpowers design document (spec or plan) and judge whether it is ready for implementation.
argument-hint: "[<path>] [--report-only]"
---

# /forge:review-design

Review a superpowers design document — a spec produced by
`superpowers:brainstorming` or a plan produced by `superpowers:writing-plans` —
against ten perspectives, and report whether it is ready for implementation.

```
/forge:review-design [<path>] [--report-only]
```

By default this command is **interactive**: after the review it prints the
verdict and the per-perspective counts, then puts every finding to you as a
multiple-choice card — apply this fix, or keep the document as written; for a
design decision, pick among the alternatives — and applies your answers in one
batch, re-reviewing after each round (up to three). Pass `--report-only` to
stop at the report instead: the run then never writes to the target file and
never puts a finding to the user *as a question*, and the full report is the
whole output. A run also falls back to report-only on its own when the
AskUserQuestion tool is not available in the session — a CI job, a hook, or
`claude -p` — so a gate needs no flag to be safe, though passing it says what
you mean. `--fix` is still accepted and changes nothing: the interactive run
is what it used to switch on. Section 4's verdict **formula** is the same in
both modes, but what it is fed differs: only an interactive run resolves an
`Ask`, and only an interactive run can be told where a companion spec the
lookup missed actually lives (Section 6). The same document can therefore
report `NOT READY` report-only and `READY` interactively — gate on the
report-only run, which is the one whose verdict depends on nothing but the
document.

Target resolution runs before the review, and it is the one place a question
can still arise. It asks nothing when `<path>` is **given** and is
**self-typing** — the path has a `specs/` component, or a `plans/` component,
or a filename ending in `-design.md`, and does **not** carry both a `specs/`
and a `plans/` component, so the Document type table in Section 2 resolves
without help. Carrying both is row 0, which asks however the filename ends.

It asks at most one question per unresolved dimension
otherwise: when the resolved path matches none of those patterns, when `<path>`
is omitted and the search finds several candidates it cannot rank, and always
when the search had to fall through to Stage 3 or to Stage 2's `*design*` /
`*plan*` guess patterns. Those last are guesses, and Section 2 never takes a
guess silently, however well the candidate happens to type itself.

**For unattended use, pass an explicit, self-typing `<path>` and
`--report-only`** — for example
`docs/superpowers/specs/2026-08-29-foo-design.md --report-only`. That is the
condition under which the whole run is non-interactive. A path outside those
conventions can still need one question about its type, and the default mode
asks by construction — it is the mode that puts the findings to the user.

## How this command is laid out

Work through the steps below in order. Each step names one file under
`references/`, relative to this skill's base directory. Read that file **in
full** before acting on it: every rule in it applies, and a rule you did not
read is a rule you break. The files keep this command's section numbers, so a
cross-reference such as "Section 4" or "Section 8's `pass n/3`" is found
through the table below.

1. **Resolve the target.** Read `references/1-resolve.md`.
2. **Review the document, then challenge every finding.** Read
   `references/2-review.md`. Its last subsection is not optional: no finding
   reaches step 3 unchallenged.
3. **Judge and report.** Read `references/3-verdict.md`. Its *Where to stop*
   decides whether the run ends with the full report (`INTERACTIVE` is `0`)
   or prints the compact header and continues to the cards (`INTERACTIVE`
   is `1`).
4. **Put the findings to the user, apply, re-review** — when `INTERACTIVE`
   is `1`. Read `references/4-fix.md`. A report-only run opens it for one
   thing only:
   when *Where to stop* sends a `READY` plan to Section 8's *Handing off to
   implementation* block, read that block there and print it.

| Section | File |
|---|---|
| Section 1: Arguments | `references/1-resolve.md` |
| Section 2: Target resolution | `references/1-resolve.md` |
| Section 3: Review perspectives | `references/2-review.md` |
| Section 4: Triage and verdict | `references/3-verdict.md` |
| Section 5: Report | `references/3-verdict.md` |
| Section 6: Resolving Ask items | `references/4-fix.md` |
| Section 7: Applying changes | `references/4-fix.md` |
| Section 8: Re-review and exit | `references/4-fix.md` |
