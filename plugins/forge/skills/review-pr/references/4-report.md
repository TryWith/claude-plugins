# Step 4: Report

Goal: the reviewer opens one file and knows, within seconds, the complete
list of what they have to do — and that nothing else is hidden further down.

## 4.1 Where to write

Write two Markdown files under the repository's shared git directory:

```bash
REVIEW_DIR="$(git rev-parse --path-format=absolute --git-common-dir)/forge/review-pr/<owner>/<repo>"
```

Take `<owner>/<repo>` from the `url` that `gh pr view` returned in Step 1.1,
lower-cased — not from what the user typed — so every run spells the same
directory.

- `$REVIEW_DIR/pr<n>-review.md` — the review package (sections below)
- `$REVIEW_DIR/pr<n>-review-draft.md` — the review text to submit

This is the package's **fixed path**, and Step 1.2 and Step 5 look for the
previous package there. Anything under the git directory is invisible to
`git status` and `git add`, so the files can never be committed by accident,
and `--git-common-dir` (not `--git-dir`) makes the path the same from every
worktree of the clone and in every later session. The names carry no date;
the dates live in the header. Give the user both full paths.

Then print a short chat summary (4.5). Do not paste the whole package into
the chat.

## 4.2 Why the package is ordered this way

A reviewer who sees a to-do list and then, further down, a 40-row checklist
reasonably assumes the checklist is more work. It is not: every action is
already in the to-do list. So the package puts **the complete to-do list
first**, says plainly that it is complete, and labels everything after it
as reading material or reference. Duplication between the to-do list and
the checklist is fine; ambiguity about what remains is not.

## 4.3 The package file

Use these top-level sections, in this order, with headings that say what
the reader does with each section (translate the headings into the user's
language).

### 1. Header

PR URL; reviewed head SHA (and earlier SHAs on a re-review); closing
issues; CI state at that SHA; merge state; the verification environment and
how it was built (or "none" with the reason: `--no-env`, the user declined,
or no question tool was available); the date of this run.

### 2. Your to-do list (this is everything)

Open with one sentence: "These N tasks are all you need to do. Everything
after this section is for reading or reference." Then the tasks as a single
numbered list, grouped in this order, each task one line with the checklist
item numbers it settles (`→ No.4, 12`) and an estimate when useful:

1. **Decide** (owner B) — for each: the question, the facts, the options,
   the recommended option and why.
2. **Check by hand** (owner C, visual checks) — for each: numbered steps
   the reviewer can follow without reading code: URL or command, action,
   expected result, what to note if it differs. Put commands in fenced
   blocks, one command per block. Use the environment from Step 3 (URLs,
   test accounts, mailbox) when it exists.
3. **Spot-check the AI's evidence** — two or three high-risk A items: the
   `file:line` to open, what to read, the matching test, and an optional
   one-line hands-on confirmation.
4. **Send the questions to the author** — point to the draft file; list the
   questions in one line each.
5. **Record and decide** — the last task, always: fill the "human verdict"
   column; state that A items whose evidence the reviewer accepts after the
   spot-check may be marked OK together; then choose approve / request
   changes / wait, with the AI's recommendation and reason.

If a group is empty, keep its heading and write "none" so the reader knows
it was considered.

### 3. Summary (read)

Purpose, main changes, affected features (Step 1.5), and the Important
findings with one line each.

### 4. What the AI verified (read; no action needed)

A compact list of results with evidence and SHA, grouped by perspective.
Start the section with one sentence saying no action is needed beyond the
spot-checks already in the to-do list.

### 5. Appendix (reference only — every action above already covers it)

Start with that sentence, then:

- **A. Full checklist** in the Step 2 format, Status filled, Human verdict
  empty.
- **B. Review flow**: `Order | Who | What to do in this PR | Item Nos. |
  Done when | Progress` for the six stages (AI investigates → human
  confirms purpose/spec → AI shows key code, human reads → human judges →
  author fixes/answers and the AI re-reviews the new head → human
  decides). Mark what the AI has done and what the human has not.
- **C. Not seen**: everything not read or not run, and why.
- **D. Clean-up**: commands to remove what Step 3 created; mark the ones
  that need the human (admin rights).
- **E. Glossary**: short definitions of terms the reader may not know.

## 4.4 The review draft

Written to be posted as a GitHub review by the human:

- **Verdict line**: leave the verdict to the human. Propose one with its
  reason and the review type it maps to.
- **What was verified**, with the head SHA, CI, E2E counts, and hands-on
  results — attributing human checks to the human only if they reported
  them.
- **Requests**, split into: must fix (Important, with the reason), please
  answer (open questions), and optional suggestions (Nits). Each with
  evidence (`file:line`, reproduction).
- Follow the repository's review rules for format and, on a re-review,
  for what may be raised (for example "Important only; no new Nits").
- Mention the author by handle once. Keep internal hostnames and secrets
  out of it.

## 4.5 Chat summary

Five to ten lines: reviewed SHA; overall picture; the Important findings;
**the number of to-do items and the first one to do**; the two file paths;
and the choice the user has next. Then stop. Do not post, approve, or
comment on the PR unless the user asks.

When the user later asks to submit, re-check the head SHA first (Step 5).
If it moved, say so and do not submit the old draft.
