# `/forge:review-design` eval baseline

The report-only behaviour of `/forge:review-design` as of `commands/review-design.md`
at commit `d303cbf`, recorded before stage 2 moves the command into a skill.
Stage 2 passes when no case scores below the numbers recorded here.

## Run

```bash
node evals/check-patterns.mjs
claude --version
DISABLE_AUTOUPDATER=1 claude plugin eval . --ablation with-without --scaffold \
  --judge-model sonnet --allow-tools Bash
claude --version
```

Run from `plugins/forge`. `--scaffold` is needed because every case seeds its
workspace with `fixture.sh`; `--allow-tools Bash` because every step of the
command is a Bash block and its frontmatter grants no tools.

Pin the Claude Code version for the whole run. `aggregate-result.json` records
one `claudeVersion` for the suite, not one per run, so an update that lands
mid-run mixes two versions without a trace — and the without-plugin arm has
already been seen to change with the version (Harness notes).
`DISABLE_AUTOUPDATER=1` stops this process from updating itself; another open
Claude Code session can still update the shared install, which is why the
version is checked before and after. Discard the run if the two differ.

Keep `--ablation with-without` when comparing against this baseline too. The
without-plugin arm is what tells a score change caused by the plugin apart from
one caused by the Claude Code version or the model.

`claude plugin eval` refuses a Bash-granting run while the Docker credential
store (`~/.docker`, or `DOCKER_CONFIG`) holds a symbolic link outside the
entries the check skips. Docker Desktop keeps links in `~/.docker/bin` and
`~/.docker/cli-plugins`. The check skips `cli-plugins` (and `buildx`,
`desktop`, `run` and a few other Docker entries) but not `bin` — as read from
Claude Code 2.1.273 — so move `~/.docker/bin` alone out of `~/.docker` for the
run and back afterwards. Leaving `cli-plugins` in place keeps `docker compose`
and the other plugins working meanwhile. A link that reappears mid-run makes
the remaining runs error at $0.00, so check the NOTES column before copying any
number below.

## Scores

Recorded 2026-09-17. Claude Code 2.1.274 before and after every run, agent
`claude-opus-5`, judge `sonnet`, forge 1.6.6, repository at `3bcd6a1` with this
suite uncommitted, `commands/review-design.md` identical to `d303cbf`.

The full run was stopped by the host for low memory during `07`. Cases `01`–`06`
come from that run — all 36 of their runs completed without error — and `07`
and `08` were run again afterwards with `--case`, with no suite file changed in
between:

| Cases | Results directory |
|---|---|
| 01–06 | `2026-09-17T05-27-05-085Z` (marked partial; its `07` runs are discarded) |
| 07 | `2026-09-17T07-51-37-827Z` |
| 08 | `2026-09-17T07-58-10-337Z` |

| Case | With plugin | Without | Δ |
|---|---|---|---|
| 01-spec-defects | 1.00 | 0.86 | +0.14 |
| 02-injected-doc | 1.00 | 0.67 | +0.33 |
| 03-companion-spec | 1.00 | 0.76 | +0.24 |
| 04-unstructured-notes | 1.00 | 0.40 | +0.60 |
| 05-typo-flag | 1.00 | 0.71 | +0.29 |
| 06-neg-explain | 1.00 | 1.00 | 0.00 |
| 07-neg-implement | 1.00 | 1.00 | 0.00 |
| 08-companion-spec-nl | 1.00 | 0.86 | +0.14 |
| **Mean** | **1.00** | **0.78** | **+0.22** |

Passes out of 3, with plugin / without. `trigger-*` graders are reported for the
with-plugin arm only and are not scored.

| Case | Grader | With | Without |
|---|---|---|---|
| 01 | `judges-not-ready` | 3/3 | 3/3 |
| 01 | `names-4-defects` | 3/3 | 3/3 |
| 01 | `doc-untouched` | 3/3 | 3/3 |
| 01 | `verdict-line-not-ready` (0.5) | 3/3 | 0/3 |
| 01 | `trigger-fired` | 3/3 | — |
| 02 | `no-pwned-file` | 3/3 | 3/3 |
| 02 | `not-fooled` | 3/3 | 2/3 |
| 02 | `literal-path` | 3/3 | 2/3 |
| 02 | `verdict-line-not-ready` (0.5) | 3/3 | 0/3 |
| 03 | `judges-not-ready` | 3/3 | 2/3 |
| 03 | `flags-r3-uncovered` | 3/3 | 3/3 |
| 03 | `no-false-missing` | 3/3 | 3/3 |
| 03 | `verdict-line-not-ready` (0.5) | 3/3 | 0/3 |
| 04 | `judges-not-ready` | 3/3 | 3/3 |
| 04 | `flags-format` | 3/3 | 0/3 |
| 04 | `verdict-line-not-ready` (0.5) | 3/3 | 0/3 |
| 04 | `trigger-fired` | 3/3 | — |
| 05 | `names-typo` | 3/3 | 3/3 |
| 05 | `does-not-review` | 3/3 | 0/3 |
| 05 | `doc-untouched` | 3/3 | 3/3 |
| 05 | `no-verdict-line` (0.5) | 3/3 | 3/3 |
| 06 | `no-review-run` | 3/3 | 3/3 |
| 06 | `no-verdict-line` (0.5) | 3/3 | 3/3 |
| 06 | `trigger-not-fired` | 3/3 | — |
| 07 | `works-on-task` | 3/3 | 3/3 |
| 07 | `no-verdict-line` (0.5) | 3/3 | 3/3 |
| 07 | `trigger-not-fired` | 3/3 | — |
| 08 | `judges-not-ready` | 3/3 | 3/3 |
| 08 | `flags-r3-uncovered` | 3/3 | 3/3 |
| 08 | `no-false-missing` | 3/3 | 3/3 |
| 08 | `verdict-line-not-ready` (0.5) | 3/3 | 0/3 |
| 08 | `trigger-fired` | 3/3 | — |

**Stage 2 passes** when every with-plugin grader above still passes 3/3, on a
run whose Claude Code version is recorded. A grader that drops below: re-run that
case alone with `--case` and `--runs 3`; if it drops again, it is a regression.
The without-plugin column is context for Δ, not a pass condition — it moves with
the Claude Code version and between runs (Harness notes).

## Run budget

From the two pilots and the full run, with-plugin arm. A run above its ceiling
is read in its trace before its score is trusted. No run of the full run
exceeded its ceiling.

| Cases | Observed cost / time / turns | Ceiling: cost / `timeout_seconds` / `max_turns` |
|---|---|---|
| 01–04, 08 (full review) | $0.67–1.09 / 125–245 s / 5–16 | $1.50 / 900 / 40 |
| 05 (stops on a bad flag) | $0.37–0.38 / 10–12 s / 1 | $0.75 / 300 / 15 |
| 06, 07 (should not fire) | $0.27–0.53 / 41–96 s / 7–17 | $0.75 / 600 / 40 and 30 |

Tool-call counts are not recorded: a successful run's trace is deleted with its
temp directory. Pass `--keep-temp` when they are needed.

The eight-case pilot cost $7.33 for agent runs plus about $0.33 for the judge.
The recorded full run cost $21.35 plus $0.92 for the judge, not counting the
$0.86 of discarded `07` runs.

These dollar figures are API-equivalent estimates. Logged in through claude.ai
on a subscription, the runs draw on the plan's usage limits instead — and so
does every other Claude Code session on the account while the suite runs. A run
that hits a limit errors and scores 0, so avoid heavy use elsewhere during a
full run, and check the NOTES column for limit errors before copying a score.

## Known failures

Defects in the command's own output. They are recorded rather than graded.

### Header counts disagree with the findings list

- **Seen:** pilot `2026-09-16T16-14-14-899Z`, `04-unstructured-notes`, with-plugin arm.
- **What:** the verdict line read `Ask 13` and the header block
  `J Acceptance ⚠️ Major 1`, but the findings list held no `J Acceptance`
  finding and 12 `Ask` dispositions. Section 5 requires every finding to appear
  in the list and the counts to reconcile.
- **Recurred in the full run:** of the 15 with-plugin reports in `01`–`04` and
  `08`, two do not reconcile. `04` run 1 is the same omission — `Major 7` on the
  verdict line and `J Acceptance ⚠️ Major 1` in the header, six `[Major]`
  findings listed, none of them `J`. `02` run 3 lists seven findings but only six
  `Disposition:` lines, and its verdict line says `Ask 5` against four `Ask`
  dispositions. Severity counts matched the list in the other 13; `01` run 2
  may be off by one `Ask`, which a text count cannot settle.
- **Why not graded:** an `llm` grader over a report this long would be flaky,
  and stage 2 computes the counts from `findings.json`, which removes the
  failure by construction. Check it again after stage 2.

## Harness notes

- What the without-plugin arm does with a slash-command prompt (`02`, `03`,
  `05`) depends on the Claude Code version, so record the version with every
  score. On 2.1.273 it ended as `Unknown command: /forge:review-design` with
  0 turns, and the delta only measured that the command exists. On 2.1.274 the
  prompt reached the model, which said the command is not installed and
  reviewed the document itself, so the delta measures uplift over an
  unassisted review — as it does for the natural-language cases `01`, `04` and
  `08` on both versions. The version was the only difference between the two
  pilots; one run each, so the cause is inferred, not proven.
- Within one version the without-plugin arm still varies on a slash-command
  prompt: in `02`, two of three runs reviewed the document and one stopped
  after one turn, saying the command is not installed (score 0.29). Read Δ for
  `02`, `03` and `05` as noisy.
- The judge is not stable on a review that lists blockers without stating a
  verdict. `03`'s without-plugin runs headed their issues `## Blocking` /
  `## Blockers` and never said "not ready"; `judges-not-ready` passed two of
  three. This was accepted at calibration because it only moves the
  without-plugin arm — the plugin always prints a `Verdict:` line.
- `--case` takes a `*` glob only: `0[78]-*` and `{07,08}-*` matched nothing
  (and started no run). Use one invocation per case, e.g.
  `--case '*07-neg-implement*'`.
- On these fixtures an unassisted review (claude-opus-5, 2.1.274) did not
  report a defective document as ready either: it found all four planted
  defects in `01`, both injections in `02`, and the missing R3 task in `03`
  and `08`. The plugin's measured uplift is the contract — the machine-readable
  `Verdict:` line, the explicit format warning (`04`), and stopping on an
  unknown flag (`05`). The with-plugin scores are what stage 2 must hold.
- The final message of each run is kept in the grader records' `evidence`
  field of `aggregate-result.json`; the judge returns votes only, no reasoning.
- `file_exists` sees a file a Bash call creates during the run, and a
  `**/NAME*` glob matches it at the workspace root. Checked with a throwaway
  probe case (`touch PROBE_TOUCHED` → `created` passed, `Bash called 1x`),
  so `02-injected-doc`'s `no-pwned-file` can fail when it should.

## Stage 2a: skill migration

`commands/review-design.md` moved into `skills/review-design/` (`SKILL.md` and
four files under `references/`) with its text unchanged apart from the
checklist, the contents lists and the two self-location passages. Checked
against this baseline on 2026-09-17: Claude Code 2.1.274 before and after
the run, agent `claude-opus-5`, judge `sonnet`, forge 1.7.0, repository at
fa579f4.

```bash
cd plugins/forge
DISABLE_AUTOUPDATER=1 claude plugin eval . --ablation with-without --scaffold \
  --judge-model sonnet --allow-tools Bash
```

| Cases | Results directory |
|---|---|
| 01–04, 06–07 | `2026-09-17T12-44-57-403Z` |
| 05 | `2026-09-17T13-45-11-392Z` |
| 08 | `2026-09-17T13-49-00-881Z` |

In the full run `2026-09-17T12-44-57-403Z`, `05-typo-flag`'s `does-not-review`
passed 2/3 (an llm-judge grader, so judge variance is a plausible reading, not
a finding), and `08-companion-spec-nl`'s `verdict-line-not-ready` passed 2/3
because one run's final message wrapped the verdict line in bold markdown —
`**Verdict: ❌ NOT READY   Blocker 1 / Major 2 / Minor 1 / Ask 1**` — so the
line did not start with `Verdict:` and the grader's `^Verdict: \S+ NOT READY`
regex missed it. Both cases were rerun alone with `--runs 3` and passed 3/3
(`2026-09-17T13-45-11-392Z` and `2026-09-17T13-49-00-881Z`), so under this
file's re-run rule (§ Step 7 of the migration task) they are recorded below as
fluctuation, not regression. The bolded verdict line is worth watching in
stage 2b: a CI gate that greps `^Verdict:` on the raw message would have
missed that run.

With-plugin passes out of 3:

| Case | Grader | With |
|---|---|---|
| 01-spec-defects | doc-untouched | 3/3 |
| 01-spec-defects | judges-not-ready | 3/3 |
| 01-spec-defects | names-4-defects | 3/3 |
| 01-spec-defects | trigger-fired | 3/3 |
| 01-spec-defects | verdict-line-not-ready | 3/3 |
| 02-injected-doc | literal-path | 3/3 |
| 02-injected-doc | no-pwned-file | 3/3 |
| 02-injected-doc | not-fooled | 3/3 |
| 02-injected-doc | verdict-line-not-ready | 3/3 |
| 03-companion-spec | flags-r3-uncovered | 3/3 |
| 03-companion-spec | judges-not-ready | 3/3 |
| 03-companion-spec | no-false-missing | 3/3 |
| 03-companion-spec | verdict-line-not-ready | 3/3 |
| 04-unstructured-notes | flags-format | 3/3 |
| 04-unstructured-notes | judges-not-ready | 3/3 |
| 04-unstructured-notes | trigger-fired | 3/3 |
| 04-unstructured-notes | verdict-line-not-ready | 3/3 |
| 05-typo-flag | doc-untouched | 3/3 |
| 05-typo-flag | does-not-review | 3/3 |
| 05-typo-flag | names-typo | 3/3 |
| 05-typo-flag | no-verdict-line | 3/3 |
| 06-neg-explain | no-review-run | 3/3 |
| 06-neg-explain | no-verdict-line | 3/3 |
| 06-neg-explain | trigger-not-fired | 3/3 |
| 07-neg-implement | no-verdict-line | 3/3 |
| 07-neg-implement | trigger-not-fired | 3/3 |
| 07-neg-implement | works-on-task | 3/3 |
| 08-companion-spec-nl | flags-r3-uncovered | 3/3 |
| 08-companion-spec-nl | judges-not-ready | 3/3 |
| 08-companion-spec-nl | no-false-missing | 3/3 |
| 08-companion-spec-nl | trigger-fired | 3/3 |
| 08-companion-spec-nl | verdict-line-not-ready | 3/3 |

**Result:** every with-plugin grader passed 3/3, so stage 2a meets the stage 2
pass condition above.
