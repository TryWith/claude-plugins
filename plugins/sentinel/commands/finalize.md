---
description: Run the full post-implementation workflow — simplify, commit, push, PR, self-review loop, CI/review watch, and notify on completion.
---

# /sentinel:finalize

Run the full post-implementation workflow. Do **not** advance to the next step until the current one fully completes.

## Step 0: Determine output language

Resolve the user's preferred output language and use it consistently for the
rest of the command. See the **Language preamble & i18n contract** section of
`watch.md` for the full priority rules (env var → Claude conversation language
→ user message language → `ja` default), translation scope, and override
options.

```bash
LANG_CODE="${SENTINEL_LANG:-ja}"
echo "🌐 Language: $LANG_CODE"
```

All subsequent user-facing output (logs, notifications, commit message bodies,
review replies, progress reports) must be translated to `$LANG_CODE` at
runtime.

## Step 1: Simplify the code

Invoke the slash command:

```
/simplify
```

Wait for it to finish. If it errors, report to the user and abort.

## Step 2: Commit, push, and open a PR

Invoke the slash command:

```
/commit-commands:commit-push-pr
```

After it completes, capture the **PR number** and **PR URL** for later steps:

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
PR_URL=$(gh pr view --json url --jq '.url')
echo "📋 PR #$PR_NUMBER: $PR_URL"
```

## Step 3: Self code-review and fix loop

Repeat the following **until there are zero actionable findings**.

### 3-1. Run the review

Invoke:

```
/code-review:code-review
```

### 3-2. Classify findings

From the review output, bucket each finding:

| Severity | Action |
|----------|--------|
| 🔴 Critical | **Must** fix |
| 🟡 Warning | Fix by default (skip only with a clear, stated reason) |
| 🟢 Info | Fix at your discretion |

### 3-3. Apply fixes

Fix **every** 🔴 Critical and 🟡 Warning finding.

```bash
# Inspect the diff
git diff

# Commit (summarize the fixes in the body)
git add .
git commit -m "fix: address self-review findings

- <fix 1>
- <fix 2>
"

# Push
git push
```

> Note: the commit subject prefix (`fix:` etc.) stays in English regardless of `$LANG_CODE` — Conventional Commits is language-neutral. Translate only the body.

### 3-4. Re-review

After fixing, **return to 3-1 and re-run `/code-review:code-review`**.
Continue until either:

- zero findings, **or**
- only 🟢 Info findings remain and you judge them unnecessary to address.

### 3-5. Loop exit conditions

```
Maximum 10 iterations.
If 🔴 Critical findings still remain after 10 iterations, report to the user and abort.
```

Track iteration count to prevent infinite loops:

```bash
REVIEW_LOOP=0
MAX_REVIEW_LOOP=10
# At the start of each iteration: REVIEW_LOOP=$((REVIEW_LOOP + 1)) and check the cap
```

Once findings are fully cleared, proceed to **Step 4**.

## Step 4: PR watch loop & completion notification

Invoke the slash command:

```
/sentinel:watch
```

`/sentinel:watch` runs the full watch loop (5-min interval, exits after 2
consecutive all-clear checks; watches CI / open review threads / Changes
Requested) and, on exit, emits the completion notification (macOS desktop
notification + final terminal summary). Success and aborted outcomes produce
different notifications — see `watch.md` Section 3 for details.
