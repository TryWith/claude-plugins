---
description: Prepare a pull request for its final human review. Investigate the PR, its linked issues and the first-pass AI reviews, verify everything an AI can verify (code, tests, CI, E2E, browser), and hand the human reviewer only what needs a human — a checklist, hands-on steps, questions for the author, and a review draft.
argument-hint: "<PR URL or number> [--no-env]"
---

# /forge:review-pr

Turn a pull request into a final-review package for a human reviewer. The
reviewer should end up doing only what an AI cannot do or should not decide:
judging specifications, checking things on real devices or in external
consoles, looking at the screen with their own eyes, and approving.

```
/forge:review-pr <PR URL or number> [--no-env]
```

`--no-env` skips building a local verification environment (Step 3 then uses
code, tests and CI only, and lists environment-dependent checks as pending).
The run also asks once, before building any environment, and treats a "no"
the same way.

## Why the run is shaped like this

A first-pass AI review already exists on most PRs. What the final reviewer
lacks is (a) a map from the requirements to concrete checks, (b) evidence for
each check that they can trust or spot-check, and (c) a short list of what is
genuinely theirs to do. Earlier versions of this workflow handed the reviewer
a long list of checks the AI could have run itself, missed requirements that
lived only in the linked issue, overstated "must fix" findings, and went
stale when the PR head moved during the review. Each step below exists to
prevent one of those.

## Ground rules (apply to every step)

- **Do not change the PR's code, branch or GitHub state.** Posting a review,
  a comment, or editing an issue happens only when the user explicitly asks,
  and the user decides the verdict (approve / request changes / wait).
- **Separate fact, inference and unverified.** Tag claims `事実/Fact`,
  `推測/Inference`, `未確認/Unverified` in the user's language. Back facts
  with `file:line`, a test name, a command and its output, or a URL.
- **"A test exists" is not "a test passed".** Say which one you have, and
  for a pass, where (CI run id, local command) and at which commit.
- **Pin every result to a commit.** Record the short SHA a check was done
  at. The head may move during the review; Step 5 handles that.
- **Never record a human check as done** unless the user told you they did
  it, and then attribute it to them with the date.
- **Explain terms** the reader may not know (language codes, OTP, internal
  names) the first time they appear, in one short clause.
- **Write to the user in the conversation's language.** This file is the
  English source; output is not.

## Steps

Work through the steps in order. Each step names one file under
`references/`, relative to this skill's base directory. Read that file in
full before acting on it.

1. **Investigate.** Read `references/1-investigate.md`. Resolve the PR and
   its head commit, read the repository's own rules, the linked issues'
   completion criteria, and every first-pass review.
2. **Build the checklist.** Read `references/2-checklist.md`. Map every
   requirement to one check, classify who can verify it, and grade
   findings with the repository's severity rules.
3. **Verify what an AI can verify.** Read `references/3-verify.md`. Present
   one execution plan, get one confirmation, then run the checks and answer
   the open questions you can answer from issues, code or the running app.
4. **Report.** Read `references/4-report.md`. Write the files — the
   package opens with the reviewer's complete to-do list — print the short
   summary, and stop. The user decides what happens next.
5. **Re-review when the head moves.** Read `references/5-rereview.md` when
   the PR head changed since a previous run, or before the user submits a
   review drafted by this skill.
