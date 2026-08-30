# Forge

[English](#english) | [日本語](#日本語) | [中文](#中文)

---

## English

A Claude Code plugin that reviews your design document before implementation, then orchestrates existing developer commands and takes a PR all the way from creation through CI / review monitoring to auto-fix.

### Install

```bash
/plugin marketplace add TryWith/claude-plugins
/plugin install forge
```

### Dependencies

The following commands must be available before use:

| Command | Source |
|---------|--------|
| `/commit-commands:commit-push-pr` | `commit-commands` plugin |
| `/code-review --fix` | Claude Code built-in |
| `/security-review` | Claude Code bundled skill |

> **About `/code-review`:** whether Claude is allowed to start it is a runtime
> feature gate, not a fixed property of your Claude Code version. Step 2 simply
> tries — if the session allows it the review starts on its own; if the session
> refuses it, Step 2 pauses and asks you to type `/code-review --fix` — once per
> review iteration — then resumes automatically. If the command is not available
> at all (not found or disabled), Step 2 is skipped with a warning. In every case
> nothing else in the workflow changes.

> **About `/forge:review-design`:** it needs none of the commands above — it
> only reads a markdown file, so it runs on a bare Claude Code install. The
> `superpowers` plugin is optional and only shapes the two ends of the flow: it
> produces the spec and plan the review reads, and supplies the
> `superpowers:subagent-driven-development` / `superpowers:executing-plans`
> skills a `READY` plan is handed off to.

### Usage

After finishing your implementation, run:

```bash
/forge:finalize
```

It will then:

1. `/commit-commands:commit-push-pr` — commit, push, open a PR
2. `/code-review --fix` — started automatically when the session permits it, otherwise you are asked to type it once per review iteration; the applied fixes are then committed and re-reviewed until clean. Findings the review reports but chooses **not** to fix are triaged rather than dropped: genuine defects are fixed and re-reviewed, out-of-scope ones are posted to the PR as a comment so they survive the run
3. `/security-review` — conditional: run only when the diff touches a security-relevant surface; Critical/High auto-fixed, Medium/Low deferred to you
4. PR watch loop (5 min interval, exits after 2 consecutive clears)
   - CI failure → auto-fix
   - CI awaiting approval / stuck → surface & notify (no silent waiting to the cap)
   - Review comments → auto-respond
   - Changes Requested → auto-respond
5. macOS desktop notification

### Commands

| Command | Purpose |
|---------|---------|
| `/forge:finalize` | Full workflow |
| `/forge:watch` | PR watch loop only |
| `/forge:review-design` | Review a superpowers spec or plan before implementation |

`/forge:review-design` reads a design document produced by
`superpowers:brainstorming` (a spec) or `superpowers:writing-plans` (a plan)
and reports whether it is ready to implement. It checks ten perspectives —
completeness, internal consistency, grounding against this repository, blind
spots, buildability, scope, assumptions, alternatives, YAGNI, and acceptance
criteria — and reports `READY` only when no `Blocker`, no `Major` and no
unresolved `Ask` remain.

By default it is report-only and changes nothing, which makes it safe to run
from a hook or CI — pass an explicit, self-typing path (under `specs/` or
`plans/`, or ending in `-design.md`, but not carrying both components) for a
fully unattended run, since without one it may still ask which document to
review or what type it is. Pass `--fix`
to have it put the design decisions to you as
multiple-choice questions and then apply the answers — findings with a
uniquely determined answer (`Fix now`) are applied without being asked. Under
`--fix` the document is re-reviewed after each round of changes, up to 3 rounds
(override with `FORGE_MAX_DESIGN_REVIEW_LOOP`).

```bash
# Report on the newest design document
/forge:review-design

# Review a specific file and apply fixes
/forge:review-design docs/superpowers/specs/2026-08-29-foo-design.md --fix
```

Typical flow with superpowers:

```
superpowers:brainstorming  →  /forge:review-design  →  superpowers:writing-plans
                                                    →  /forge:review-design
                                                    →  implementation
```

### Multilingual output

Output messages, notifications, commit message bodies, and review replies are translated to the user's preferred language.

#### Language resolution order

1. `FORGE_LANG` env var (e.g. `ja`, `en`, `zh-CN`, `ko`)
2. Claude Code conversation language setting
3. Default: `ja` (Japanese)

#### Usage

```bash
# Run once in English
FORGE_LANG=en /forge:finalize

# Set for the whole shell
export FORGE_LANG=en
/forge:finalize
```

#### Verified languages

| Code | Language | Status |
|------|----------|--------|
| `ja` | Japanese | ✅ Default |
| `en` | English | ✅ Source language |
| Others (BCP 47) | — | Works if Claude can translate; naturalness not guaranteed |

See the **Language preamble & i18n contract** section at the top of [`commands/watch.md`](./commands/watch.md) for the full spec.

> **Not translated:** Conventional Commits prefixes (`fix:` etc.) and all emoji
> stay shared across all languages, and so do `/forge:review-design`'s
> machine-readable keys — the `Verdict:` prefix, `READY` / `NOT READY`,
> `Blocker` / `Major` / `Minor`, `Fix now` / `Ask` / `Reject`, `spec` / `plan`,
> the ten perspective names, and the `pass n/<cap>` counter line.

### Requirements

- `gh` CLI installed and authenticated
- macOS (for the notification feature)
- A CI system such as GitHub Actions configured on the repo
- All dependency commands available

---

## 日本語

実装前の設計書レビューに加え、既存の開発系コマンドをオーケストレーションし、PR作成後のCI・レビュー監視・自動修正までを完遂する Claude Code プラグイン。

### インストール

```bash
/plugin marketplace add TryWith/claude-plugins
/plugin install forge
```

### 依存コマンド

事前に以下が利用可能であること:

| コマンド | 提供元 |
|---------|--------|
| `/commit-commands:commit-push-pr` | `commit-commands` Plugin |
| `/code-review --fix` | Claude Code 組み込み |
| `/security-review` | Claude Code 標準バンドルSkill |

> **`/code-review` について:** Claude 側から起動できるかどうかは Claude Code の
> バージョンではなく**実行時のフィーチャーゲート**で決まる。Step 2 はまず起動を
> 試み、許可されていればそのまま自動でレビューが走る。拒否された場合のみ一旦
> 停止して `/code-review --fix` の入力を促し（レビュー1周ごとに1回）、完了後は
> 自動で再開する。コマンド自体が利用できない場合（未検出・無効化）は警告を出して
> Step 2 をスキップする。いずれの場合もそれ以外の挙動は変わらない。

> **`/forge:review-design` について:** 上記の依存コマンドはいずれも不要で、
> Markdown ファイルを読むだけなので素の Claude Code でも動作する。
> `superpowers` プラグインは任意で、フローの両端にのみ関わる。レビュー対象の
> 設計書・実装計画を生成するのは `superpowers` 側であり、`READY` と判定された
> 実装計画の受け渡し先となる `superpowers:subagent-driven-development` /
> `superpowers:executing-plans` を提供するのも `superpowers` 側である。

### 使い方

実装完了後、以下を実行するだけ:

```bash
/forge:finalize
```

以下が実行される:

1. `/commit-commands:commit-push-pr` — コミット・プッシュ・PR作成
2. `/code-review --fix` — セッションが許可していれば自動起動、拒否された場合のみレビュー1周ごとに入力を依頼。適用された修正をコミットし、クリーンになるまで再レビュー。レビューが報告したが**修正しなかった**指摘は捨てずに精査し、実際の欠陥は修正して再レビュー、スコープ外のものは PR コメントとして投稿してランを跨いで残す
3. `/security-review` — 条件付き実行: diff がセキュリティ関連箇所に触れる場合のみ。重大・大は自動修正、中・低はユーザーに判断依頼
4. PR監視ループ（5分間隔・連続2回クリアで完了）
   - CI失敗 → 自動修正
   - CI承認待ち・スタック → 検知して通知（cap まで黙って待ち続けない）
   - レビューコメント → 自動対応
   - Changes Requested → 自動対応
5. macOSデスクトップ通知

### コマンド一覧

| コマンド | 用途 |
|---------|------|
| `/forge:finalize` | フルワークフロー |
| `/forge:watch` | PR監視ループのみ |
| `/forge:review-design` | 実装前に superpowers の設計書・実装計画をレビュー |

`/forge:review-design` は `superpowers:brainstorming` が生成した設計書（spec）
または `superpowers:writing-plans` が生成した実装計画（plan）を読み、実装に
進んでよいかを判定します。完全性・内部整合性・リポジトリとの整合・抜け観点・
実装可能性・スコープ・前提の根拠・代替案の痕跡・YAGNI・受け入れ条件の10観点を
確認し、`Blocker` と `Major` と未解決の `Ask` がすべて 0 のときだけ `READY` と
判定します。

既定ではレポートのみでファイルを変更しないため、フックや CI から安全に実行
できます。完全に無人で実行するには、種別が一意に定まるパス（`specs/` または
`plans/` 配下、もしくは `-design.md` で終わるファイル名。ただし両方を含むパスは
除く）を明示的に渡してください。
渡さない場合、対象文書やその種別を質問することがあります。`--fix` を付けると設計判断を選択式で質問し、回答を反映します。回答が
一意に定まる指摘（`Fix now`）は質問せずそのまま適用されます。`--fix` 時は変更の
たびに再レビューし、既定で最大3周まで繰り返します（`FORGE_MAX_DESIGN_REVIEW_LOOP`
で変更可）。

```bash
# 最新の設計書をレポート
/forge:review-design

# ファイルを指定して修正まで実行
/forge:review-design docs/superpowers/specs/2026-08-29-foo-design.md --fix
```

superpowers と組み合わせた典型的な流れ:

```
superpowers:brainstorming  →  /forge:review-design  →  superpowers:writing-plans
                                                    →  /forge:review-design
                                                    →  実装
```

### 多言語出力

出力メッセージ・通知・コミットメッセージ本文・レビューリプライは、ユーザーの言語設定に応じて翻訳されます。

#### 言語決定の優先順位

1. 環境変数 `FORGE_LANG`（例: `ja`, `en`, `zh-CN`, `ko`）
2. Claude Code の会話言語設定
3. デフォルト: `ja`（日本語）

#### 使い方

```bash
# 一時的に英語で実行
FORGE_LANG=en /forge:finalize

# シェル全体で英語に
export FORGE_LANG=en
/forge:finalize
```

#### 検証済み言語

| コード | 言語 | 状態 |
|--------|------|------|
| `ja` | 日本語 | ✅ デフォルト |
| `en` | English | ✅ ソース言語 |
| その他 (BCP 47) | — | Claude が翻訳可能なら対応（自然さは保証されない） |

詳細は [`commands/watch.md`](./commands/watch.md) 冒頭の **Language preamble & i18n contract** セクションを参照。

> **対象外:** Conventional Commits プレフィックス（`fix:` 等）とすべての絵文字は
> 全言語共通で維持されます。`/forge:review-design` の機械可読キー —
> `Verdict:` プレフィックス、`READY` / `NOT READY`、`Blocker` / `Major` / `Minor`、
> `Fix now` / `Ask` / `Reject`、`spec` / `plan`、10観点の名称、`pass n/<cap>` の
> カウンタ行 — も同様に英語のまま出力されます。

### 前提条件

- `gh` CLI がインストール・認証済み
- macOS（通知機能を利用する場合）
- リポジトリで GitHub Actions などの CI が稼働
- 上記「依存コマンド」が全て利用可能

---

## 中文

在实现前评审设计文档，并将既有开发命令编排起来，从 PR 创建到 CI / 评审监控直至自动修复一并完成的 Claude Code 插件。

### 安装

```bash
/plugin marketplace add TryWith/claude-plugins
/plugin install forge
```

### 依赖命令

使用前需确保以下命令可用:

| 命令 | 来源 |
|------|------|
| `/commit-commands:commit-push-pr` | `commit-commands` 插件 |
| `/code-review --fix` | Claude Code 内置 |
| `/security-review` | Claude Code 内置 Skill |

> **关于 `/code-review`:** Claude 能否自行启动它，取决于**运行时的功能开关**，
> 而非 Claude Code 的版本。Step 2 会先尝试启动：若当前会话允许，评审即自动运行；
> 仅当被拒绝时才暂停并提示你输入 `/code-review --fix`（每轮评审各一次），完成后
> 自动恢复流程。若该命令根本不可用（未找到或已禁用），则发出警告并跳过 Step 2。
> 上述任一情况下其余步骤均不变。

> **关于 `/forge:review-design`:** 它不需要上述任何依赖命令——只读取一个
> Markdown 文件，因此在原生 Claude Code 上即可运行。`superpowers` 插件是可选的，
> 只涉及流程的两端：它生成供本命令评审的设计文档与实现计划，并提供判定为
> `READY` 的实现计划所交接到的 `superpowers:subagent-driven-development` /
> `superpowers:executing-plans` 技能。

### 使用方法

完成实现后，运行:

```bash
/forge:finalize
```

将执行:

1. `/commit-commands:commit-push-pr` — 提交、推送、创建 PR
2. `/code-review --fix` — 会话允许时自动启动，被拒绝时才请你在每轮评审各输入一次；随后自动提交所应用的修复并重新评审直至无问题。评审报告了但**未修复**的问题不会被丢弃：确属缺陷的由 Claude 修复并重新评审，超出本次范围的则作为 PR 评论发布，从而在本次运行结束后仍然保留
3. `/security-review` — 条件执行：仅当 diff 涉及安全相关部分时运行；严重/高自动修复，中/低交由用户判断
4. PR 监控循环（每 5 分钟一次，连续 2 次全部通过即结束）
   - CI 失败 → 自动修复
   - CI 等待审批 / 卡住 → 检测并通知（不再静默等待至上限）
   - 评审评论 → 自动响应
   - Changes Requested → 自动响应
5. macOS 桌面通知

### 命令一览

| 命令 | 用途 |
|------|------|
| `/forge:finalize` | 完整工作流 |
| `/forge:watch` | 仅 PR 监控循环 |
| `/forge:review-design` | 实现前审查 superpowers 的设计文档与实现计划 |

`/forge:review-design` 读取由 `superpowers:brainstorming` 生成的设计文档
（spec）或由 `superpowers:writing-plans` 生成的实现计划（plan），判断是否
可以进入实现阶段。它检查十个方面——完整性、内部一致性、与本仓库的一致性、
遗漏视角、可实现性、范围、前提依据、备选方案记录、YAGNI、验收条件——仅当
`Blocker`、`Major` 和未解决的 `Ask` 全部为 0 时才判定为 `READY`。

默认仅输出报告、不修改文件，因此可以安全地从 hook 或 CI 调用。若要完全无人值守地运行，
请显式传入类型可自行判定的路径（位于 `specs/` 或 `plans/` 下，或文件名以
`-design.md` 结尾，但不可同时包含两者）；否则它仍可能询问要审查哪份文档、
或它属于哪种类型。加上 `--fix`
后，它会以选择题形式询问设计决策并应用你的回答；其中答案唯一确定的发现
（`Fix now`）会直接应用，无需询问。使用 `--fix` 时，每轮修改后都会重新审查，
默认最多 3 轮（可用 `FORGE_MAX_DESIGN_REVIEW_LOOP` 覆盖）。

```bash
# 报告最新的设计文档
/forge:review-design

# 指定文件并应用修复
/forge:review-design docs/superpowers/specs/2026-08-29-foo-design.md --fix
```

与 superpowers 配合的典型流程：

```
superpowers:brainstorming  →  /forge:review-design  →  superpowers:writing-plans
                                                    →  /forge:review-design
                                                    →  实现
```

### 多语言输出

输出消息、通知、提交消息正文、评审回复将根据用户的语言设置进行翻译。

#### 语言决定优先级

1. 环境变量 `FORGE_LANG`（例：`ja`, `en`, `zh-CN`, `ko`）
2. Claude Code 会话语言设置
3. 默认：`ja`（日语）

#### 使用示例

```bash
# 临时以英语运行
FORGE_LANG=en /forge:finalize

# 整个 shell 切换为英语
export FORGE_LANG=en
/forge:finalize
```

#### 已验证语言

| 代码 | 语言 | 状态 |
|------|------|------|
| `ja` | 日语 | ✅ 默认 |
| `en` | 英语 | ✅ 源语言 |
| 其他 (BCP 47) | — | 若 Claude 可翻译则支持（不保证自然度） |

详情请参阅 [`commands/watch.md`](./commands/watch.md) 顶部的 **Language preamble & i18n contract** 章节。

> **不翻译:** Conventional Commits 前缀（如 `fix:`）与所有表情符号在所有语言中
> 保持一致。`/forge:review-design` 的机器可读键——`Verdict:` 前缀、
> `READY` / `NOT READY`、`Blocker` / `Major` / `Minor`、`Fix now` / `Ask` / `Reject`、
> `spec` / `plan`、十个观察视角的名称，以及 `pass n/<cap>` 计数行——同样保持英文。

### 前提条件

- 已安装并完成认证的 `gh` CLI
- macOS（如需使用通知功能）
- 仓库中已配置 GitHub Actions 等 CI
- 上述「依赖命令」全部可用
