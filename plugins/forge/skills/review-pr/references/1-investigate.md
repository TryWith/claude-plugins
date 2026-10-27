# Step 1: Investigate

Goal: know exactly what is being reviewed, against which rules, and what the
first-pass reviewers already said — before forming any opinion.

## 1.1 Resolve the PR and pin the head

- Accept a full URL or a number. Use `gh pr view <pr> --repo <owner/repo>`
  with `--json number,title,body,state,isDraft,mergeable,baseRefName,headRefName,headRefOid,commits,files,closingIssuesReferences,statusCheckRollup,url`.
- Record the **head SHA**. Every later result is pinned to it.
- Fetch the head locally without touching the user's branches:
  `git fetch origin pull/<n>/head:refs/remotes/pr/<n>`. Diff against the
  merge base with `git diff $(git merge-base origin/<base> pr/<n>) pr/<n>`.
  Note whether the base branch has moved since the merge base and whether
  the PR still merges cleanly (`git merge-tree`).
- If the PR is a stack of squashed sub-PRs, list them (commit headlines
  usually carry their numbers). Later sub-PRs often reverse earlier ones;
  review the final state, not the history.

## 1.2 Read the repository's own rules

The target repository decides severity, verification and conventions. Read,
when present: `CLAUDE.md` (and any files it imports), `REVIEW.md` or other
review instructions, contribution / PR guidelines, the setup and command
docs that say how to run the app and its tests, and any architecture or
security rules. Note in particular:

- what the repository counts as **Important** (must fix before merge), what
  is a Nit, and what it says **not** to report (for example "suggestions to
  add tests" or "items the PR body already lists as known follow-ups");
- what it requires for "動作確認 / verified" (for example: the full stack,
  real browser via the real routing, not only tests or curl);
- how to build an isolated environment for a branch (worktrees, per-worktree
  env files, database rebuilds, required secrets);
- whether this run is a **re-review**: the repository's rules often treat
  a PR that already has a human or AI review differently (for example
  "report Important only, no new Nits"). A run is a re-review when the PR
  already has a review from the same reviewer or a previous package exists.

These rules override this skill's defaults wherever they conflict.

## 1.3 Requirements: PR body and linked issues

- Read the PR body: purpose, scope, verification table, "not verified"
  list, follow-ups, and the **Close conditions** (`Closes #n`, a close
  table, "close after merge" exceptions).
- For every linked or closing issue (`gh issue view <n> --json title,state,body,comments`),
  extract the **completion criteria** checklist item by item, keeping
  whether each box is checked and what evidence the issue claims. Also read
  scope / out-of-scope and any "decided" sections; issues are often edited
  after the PR was opened, so read the current text.
- Note every requirement that only an external environment can show (a
  real phone app, a messaging app's in-app browser, a payment sandbox, a
  production CDN, an admin console of a third-party service).

## 1.4 First-pass reviews

Collect all three sources, including resolved and outdated ones:

- review bodies: `gh api repos/<o>/<r>/pulls/<n>/reviews --paginate`
- conversation comments: `gh api repos/<o>/<r>/issues/<n>/comments --paginate`
- inline comments with their replies: `gh api repos/<o>/<r>/pulls/<n>/comments --paginate`

For each finding record: reviewer, date, the commit it was made on, severity,
the author's reply (fix / won't fix / deferred to where), and — to be
checked in Step 3 — whether the current code matches the reply. Note findings
that never got a reply. A reviewer that says it read only part of the diff
(shallow clone, limited files) leaves the rest unreviewed; record that.

## 1.5 Summarise for the reader

Prepare three short paragraphs for the report: **purpose**, **main
changes** (grouped by area), **affected features** (including anything the
PR claims it does *not* change — that claim becomes a check).
