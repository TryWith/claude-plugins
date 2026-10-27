# Step 3: Verify what an AI can verify

Goal: close every A item with evidence, shrink B and C items to what truly
needs a human, and never ask the author something you could have looked up.

## 3.1 One execution plan, one confirmation

Before running anything that builds or changes an environment, show the
user a short plan and ask once (AskUserQuestion when available):

- what will be created (a git worktree at the PR head, containers, a
  rebuilt local database, test accounts) and where;
- what will be run (unit tests, E2E, browser checks, API calls) and roughly
  how long it takes — and, said plainly, that this **executes the PR
  author's code** (tests, build scripts, dependency install hooks) on the
  user's machine with the user's credentials. Name the author, their
  `author_association`, and whether the head comes from a fork
  (`isCrossRepository`, `headRepositoryOwner`), all from Step 1.1; for a
  fork, or an association other than `OWNER`, `MEMBER` or `COLLABORATOR`,
  recommend `--no-env` or a disposable machine;
- which setup procedure will be followed: the base branch's setup docs,
  plus — shown as a diff, because they come from the PR — any changes the
  PR makes to those docs or to the scripts they run (new env vars,
  migrations, one-time rebuild notes). The worktree runs the PR's code, so
  the PR's own setup changes are usually needed; the user's "yes" covers
  them only because they were shown;
- what it will **not** touch (the user's checkout and branches, other
  worktrees' environments, anything remote);
- anything that needs the user (admin rights, a secret, an installed tool).

The "yes" covers the head SHA the plan named and nothing else. After it, do
not ask again until the report, except for something the plan did not
cover; a new head (Step 5) needs a new "yes". On "no", on `--no-env`, or when no question tool is
available, skip environment work and mark those checks "pending (no
environment)".

Checks that need no environment and run none of the PR's code — reading
code and tests at `pr/<n>` through git, reading CI logs, querying issues,
`gh` lookups — run regardless. Running tests locally needs the worktree and
dependencies, so it is environment work.

## 3.2 Environment

Follow the procedure the 3.1 plan showed — the base branch's setup docs
plus the PR's changes to them; do not invent one, and do not run a PR
setup change the plan did not show. Typically: a detached worktree at the
head SHA, isolated names/ports/hosts as the docs describe, dependencies,
database migrate/seed or rebuild (including one-time rebuild notes the PR
adds), and any test tenant/account. Record every resource you create so
Step 4 can list how to remove it. If a step needs admin rights (for
example editing `/etc/hosts`) or a newer toolchain than the machine has,
stop that check, give the user the exact command, and continue with the
rest.

## 3.3 Run the A items

- Prefer running over reading: execute the relevant tests, re-run E2E at
  the head, and drive the real app the way the repository's "verified"
  definition requires (for example the browser through the real routing,
  not only curl). Combine: code reading explains, a run proves.
- Exercise the failure paths a reviewer would worry about: unauthenticated
  access, malicious redirect targets, wrong secrets, a stopped backend,
  disabled features, odd spellings of inputs, and mixed versions during
  deploy or rollback (trace what the old code does with the new response
  and vice versa, down to what gets saved).
- For every API contract the PR changes (accepted values, defaults,
  status codes, response shape), compare three things in **every** spec
  file that describes it (each app or audience may have its own OpenAPI):
  the parameter's schema (type, enum), its description, and the observed
  behaviour. A description that was updated while the schema still says
  `enum` is a mismatch. State which spec files you checked; never write
  "no mismatch" without that list.
- When a first-pass finding says "fixed in X", confirm X at the head. When
  it says "deferred to issue Y", open Y and check the item is there.
- When the PR body says "verified" for something you can re-run, re-run it
  and compare counts; a stale count is itself worth reporting.
- Record each result in the Status column as `[sha] what was done → what
  was observed`, with the command or test name.

## 3.4 Shrink the questions

For every question you would put to the author, first try to answer it:
read the linked issue and its comments, search issues (`gh search issues`),
read the code, or try it in the running app. Only questions that remain
open go into the report. A question that the issue already answers becomes
a statement ("confirmed: tracked in #n") instead.

## 3.5 Stop conditions

Stop a check, record why, and move on, when: it needs credentials you do
not have, it would affect a shared or remote environment, the toolchain is
missing, or it would take disproportionate time (say what it would take).
Leave the environment running at the end; the human's hands-on checks and
a later re-review use it.
