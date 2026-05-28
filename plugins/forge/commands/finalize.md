---
description: Run the full post-implementation workflow — commit, push, PR, code-review --fix loop, conditional security-review, CI/review watch, and notify on completion.
---

# /forge:finalize

Run the full post-implementation workflow. Do **not** advance to the next step until the current one fully completes.

## Step 0: Determine output language

Resolve the user's preferred output language and use it consistently for the
rest of the command. See the **Language preamble & i18n contract** section of
`watch.md` for the full priority rules (env var → Claude conversation language
→ user message language → `ja` default), translation scope, and override
options.

```bash
LANG_CODE="${FORGE_LANG:-ja}"
echo "🌐 Language: $LANG_CODE"
```

All subsequent user-facing output (logs, notifications, commit message bodies,
review replies, progress reports) must be translated to `$LANG_CODE` at
runtime.

## Step 0.5: Pre-flight — verify required dependencies

Before invoking any external slash command in Steps 1–4, verify that each
required skill is loaded in the current Claude Code session. The chain
invokes these by name:

| Required slash command | Provided by | How to install |
|------------------------|-------------|----------------|
| `/commit-commands:commit-push-pr` | `commit-commands` plugin | `/plugin install commit-commands` |
| `/code-review` (run with `--fix`) | Claude Code bundled skill | Built-in (only fails if the user disabled it) |
| `/security-review` (Step 3, conditional) | Claude Code bundled skill | Built-in (only fails if the user disabled it) |

Consult the **available skills list** (visible in this session's
system-reminder messages, or via `/help`) to confirm each command is loaded.
If **any** of them is missing, do **not** proceed — Claude Code will reject
the invocation mid-chain with an opaque "skill not found" error after partial
work has been done. Instead, report exactly which ones are missing with the
install hints from the table above, then abort:

```
⚠️ /forge:finalize cannot run — the following required commands are missing:
  • /commit-commands:commit-push-pr   →  /plugin install commit-commands

Install/enable the missing items, run /reload-plugins, then re-invoke /forge:finalize.
```

(Translate the message above to `$LANG_CODE`; keep the slash command names
and install hints as-is — they are proper nouns.)

`/forge:watch` for Step 4 is internal to forge itself — if `/forge:finalize`
loaded, `/forge:watch` is also available, so no check needed there.

## Step 1: Commit, push, and open a PR

Invoke the slash command:

```
/commit-commands:commit-push-pr
```

If this fails with "skill not found" (preflight should have caught this —
backstop), report `/plugin install commit-commands` and abort. After it
completes, capture the **PR number** and **PR URL** for later steps:

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
PR_URL=$(gh pr view --json url --jq '.url')
echo "📋 PR #$PR_NUMBER: $PR_URL"
```

## Step 2: Code-review auto-fix loop

Run `/code-review --fix`, which finds issues **and applies the fixes to the
working tree automatically**. Repeat until a run produces no further changes.

### 2-1. Run the review with auto-fix

Invoke:

```
/code-review --fix
```

If this fails with "skill not found" (preflight should have caught this —
backstop), instruct the user that `/code-review` is normally a Claude Code
bundled skill and may need to be re-enabled, then abort. For any other error,
report it and abort.

`--fix` applies fixes directly to the working tree. It does **not** commit or
push — that's the next step.

### 2-2. Commit and push the applied fixes

Inspect what `--fix` changed:

```bash
git diff --stat
```

If the working tree is **clean** (no fixes were applied), the loop has
converged — skip to 2-4. Otherwise commit and push:

```bash
git add .
git commit -m "fix: address code-review findings

- <summarize the fixes --fix applied>
"
git push
```

> Note: the commit subject prefix (`fix:` etc.) stays in English regardless of `$LANG_CODE` — Conventional Commits is language-neutral. Translate only the body.

### 2-3. Re-review

After committing, **return to 2-1 and re-run `/code-review --fix`**. A run that
applies no further changes (clean working tree) is the convergence signal.

### 2-4. Loop exit conditions

```
Maximum 10 iterations.
If /code-review --fix still applies changes after 10 iterations, report to the user and abort.
```

Track iteration count to prevent infinite loops:

```bash
REVIEW_LOOP=0
MAX_REVIEW_LOOP=10
# At the start of each iteration: REVIEW_LOOP=$((REVIEW_LOOP + 1)) and check the cap
```

Once `/code-review --fix` converges (a run that changes nothing), proceed to **Step 3**.

## Step 3: Security review (conditional)

`/code-review --fix` covers correctness and cleanup but not security. Decide
whether this change set warrants a dedicated security pass, then run it if so.

### 3-1. Decide whether to run

Inspect the full diff of the PR branch against its base:

```bash
BASE_REF=$(gh pr view --json baseRefName --jq '.baseRefName')
git diff "$BASE_REF"...HEAD --stat
git diff "$BASE_REF"...HEAD
```

Run `/security-review` if the diff touches **any** security-relevant surface:

- Authentication / authorization / session / access-control logic
- Handling of external or untrusted input (HTTP params, request bodies, file
  uploads, deserialization)
- SQL / shell command / path / template construction (injection surfaces)
- Secrets, credentials, tokens, crypto, or signing
- New or bumped dependencies
- File system, network, or subprocess I/O
- CORS, CSP, cookies, or other web-security headers

If **none** of these apply (e.g. docs-only, pure refactor, test-only, or config
that touches nothing sensitive), **skip** this step, state the reason
explicitly, and proceed to Step 4:

```
🔒 Security review skipped — the diff touches no security-relevant surface (<one-line reason>).
```

(Translate the message to `$LANG_CODE`; keep the emoji and command names as-is.)

### 3-2. Run the security review

```
/security-review
```

If this fails with "skill not found" (preflight should have caught this —
backstop), report that `/security-review` is a Claude Code bundled skill that
may need re-enabling, then abort. `/security-review` is **read-only** — it
reports vulnerabilities but does not apply fixes itself.

### 3-3. Triage findings by severity

`/security-review` classifies findings by severity. Split them and act:

| Severity | Action |
|----------|--------|
| 🔴 Critical / High | **Auto-fix** — fix → commit → push → re-run `/security-review` |
| 🟡 Medium / Low | **Defer to human** — report and ask; do not auto-fix |

#### Critical / High → auto-fix loop

For each Critical or High finding, apply the fix, then commit and push:

```bash
git add .
git commit -m "fix: address security-review findings — <concrete fix>"
git push
```

Then **re-run `/security-review`** (return to 3-2) to confirm the fix and catch
any new findings. Repeat until no Critical / High findings remain.

```
Maximum 5 iterations.
If Critical / High findings still remain after 5 iterations, report to the user and abort.
```

```bash
SEC_LOOP=0
MAX_SEC_LOOP=5
# At the start of each security iteration: SEC_LOOP=$((SEC_LOOP + 1)) and check the cap
```

(Subject prefix `fix:` stays English; translate only the body to `$LANG_CODE`.)

#### Medium / Low → defer to human

Do **not** auto-fix Medium / Low findings. Surface them and let the user decide
before moving on:

```
🔒 Security review found Medium/Low findings that need your decision:

  • [<severity>] <file>:<line> — <summary>
  • …

Fix now, defer to a follow-up, or accept the risk?
(Any Critical/High findings were already auto-fixed above.)
```

(Translate to `$LANG_CODE`; keep emoji, severity labels, file paths, and command
names as-is.) Ask the user how to proceed and act on their answer. Once
Critical / High are cleared and Medium / Low have been surfaced (and handled per
the user's choice), proceed to **Step 4**.

## Step 4: PR watch loop & completion notification

Invoke the slash command:

```
/forge:watch
```

`/forge:watch` runs the full watch loop (5-min interval, exits after 2
consecutive all-clear checks; watches CI / open review threads / Changes
Requested) and, on exit, emits the completion notification (macOS desktop
notification + final terminal summary). Success and aborted outcomes produce
different notifications — see `watch.md` Section 3 for details.
