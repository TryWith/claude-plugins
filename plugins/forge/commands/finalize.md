---
description: Run the full post-implementation workflow — commit, push, PR, self-review loop, CI/review watch, and notify on completion.
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

Before invoking any external slash command in Steps 1–2, verify that each
required skill is loaded in the current Claude Code session. The chain
invokes these by name:

| Required slash command | Provided by | How to install |
|------------------------|-------------|----------------|
| `/commit-commands:commit-push-pr` | `commit-commands` plugin | `/plugin install commit-commands` |
| `/code-review` | Claude Code bundled skill | Built-in (only fails if the user disabled it) |

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

`/forge:watch` for Step 3 is internal to forge itself — if `/forge:finalize`
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

## Step 2: Self code-review and fix loop

Repeat the following **until there are zero actionable findings**.

### 2-1. Run the review

Invoke:

```
/code-review
```

If this fails with "skill not found" (preflight should have caught this —
backstop), instruct the user that `/code-review` is normally a Claude Code
bundled skill and may need to be re-enabled, then abort. For any other error,
report it and abort.

### 2-2. Classify findings

From the review output, bucket each finding:

| Severity | Action |
|----------|--------|
| 🔴 Critical | **Must** fix |
| 🟡 Warning | Fix by default (skip only with a clear, stated reason) |
| 🟢 Info | Fix at your discretion |

### 2-3. Apply fixes

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

### 2-4. Re-review

After fixing, **return to 2-1 and re-run `/code-review`**.
Continue until either:

- zero findings, **or**
- only 🟢 Info findings remain and you judge them unnecessary to address.

### 2-5. Loop exit conditions

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

Once findings are fully cleared, proceed to **Step 3**.

## Step 3: PR watch loop & completion notification

Invoke the slash command:

```
/forge:watch
```

`/forge:watch` runs the full watch loop (5-min interval, exits after 2
consecutive all-clear checks; watches CI / open review threads / Changes
Requested) and, on exit, emits the completion notification (macOS desktop
notification + final terminal summary). Success and aborted outcomes produce
different notifications — see `watch.md` Section 3 for details.
