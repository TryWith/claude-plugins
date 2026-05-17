---
description: Run the full post-implementation workflow — simplify, commit, push, PR, self-review loop, CI/review watch, and notify on completion.
---

# /sentinel:finalize

Run the full post-implementation workflow. Do **not** advance to the next step until the current one fully completes.

## Step 0: Determine output language

Execute the contents of `_lib/lang-preamble.md`.

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

## Step 4: PR watch loop

Execute the contents of `_lib/watch-pr.md` (5-min interval, exits after 2 consecutive clears; watches CI / open review comments / Changes Requested).

## Step 5: Completion notification

Execute the contents of `_lib/notify.md`:
- macOS desktop notification
- Final summary in the terminal
