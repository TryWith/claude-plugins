# Step 2: Build the checklist

Goal: one table that maps every requirement and every risk to a check that
can be judged on its own, with a clear owner.

## 2.1 Perspectives

Group the items under these six perspectives. Every perspective gets items
or a one-line reason why it does not apply to this PR.

1. Requirements vs implementation
2. Impact on existing features (including what the PR claims not to change)
3. Permissions and data access scope (auth, tenant/user isolation, open
   redirects, secrets, caching of personal data)
4. Double submission, concurrency, partial failure, retries, stale state
5. Test adequacy and handling of first-pass review findings
6. Release steps, detection of problems, and recovery — including the
   window where **old and new versions run together** (new client on the old
   server and the reverse, during deploy or after a rollback). Ask what
   each side does with the other's responses: a changed contract can make a
   client silently drop or overwrite data, not just show an error.

## 2.2 Item rules

- **One judgement per item.** If an item needs two answers, split it.
- **Every completion criterion of every closing issue maps to at least one
  item**, including ones that need a real device or an external console.
  Give each criterion its own row and label it with its source
  (`#n criterion k`), so the mapping can be checked at a glance. Do not
  merge several criteria into one row, even when they share evidence —
  repeat the evidence instead; a merged row hides which criterion is unmet.
  Missing these is the most common gap.
- **Close conditions vs unchecked criteria.** If the PR closes an issue
  whose criteria are not all checked, that is its own item. It is usually
  the real finding behind several "implementation differs from spec"
  observations: the issue may already list them as remaining work.
- **Claims become items.** "Does not change X", "verified on Y",
  "N tests passed" in the PR body are each something to confirm.
- **Every first-pass finding** gets an item or is folded into one, with its
  current status.

## 2.3 Owner column

Assign each item exactly one owner:

| Owner | Meaning | Who acts |
|---|---|---|
| **A** | An AI can verify it: read code, run tests, read CI logs, query issues, drive a browser, call the API | The AI, in Step 3. The human only spot-checks the evidence |
| **B** | A human must decide: accept a spec change, accept a risk, agree with a "won't fix", choose the release/rollback policy | The human |
| **C** | Only a human or the author can verify it: a real phone, a third-party console, production, a person's visual judgement, actions needing admin rights on the reviewer's machine | The human, or the author on request |

An item may be `A/B` (AI gathers the facts, a human decides) or `A/C`
(AI covers the local part, a human covers the external part). Keep A
items as A even when they are tedious: the purpose of this skill is that the
AI does them.

## 2.4 Severity

Grade every *problem* found (not every item) with the repository's own
review rules from Step 1.2. When the repository has none, use:
**Important** = must be fixed before merge (security/tenant boundary,
contract mismatch between API and its spec, data loss, production-reachable
logic error, PR closing an issue whose criteria are unmet); **Nit** =
everything else worth saying. Do not promote a general "add a test"
suggestion or a known follow-up already tracked in the PR or issue to
Important. When in doubt, state the reason for the grade so the human can
overrule it.

## 2.5 Table format

Columns, in this order:

`No. | Check | Where / how to check | OK when | Owner | Status / unverified | Human verdict`

- **Where / how**: concrete file:line, test name, API, screen URL, command.
- **OK when**: an observable condition, not "works correctly".
- **Status / unverified**: filled in Step 3 with `[short-sha]` prefixes;
  leave "not yet run" until then.
- **Human verdict**: always empty. Only the human fills it.

Number items once and keep the numbers stable across re-reviews; add new
items at the end of their perspective with new numbers rather than
renumbering.
