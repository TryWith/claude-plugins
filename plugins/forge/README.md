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
> only reads a markdown file (and, with `--fix`, edits that same file), so it
> runs on a bare Claude Code install. The
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
`--fix` the document is re-reviewed after each round of changes, up to 3 rounds.

```bash
# Report on the newest design document. In the standard superpowers layout a
# feature's spec and plan share a date, so this normally asks which one you mean.
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

### Output language

Messages, notifications, commit message bodies and review replies come back in
the language of your conversation. Nothing to configure — talk to Claude in
Japanese and the output is Japanese; in English and it is English.

> **Removed in 1.6:** earlier versions read a `FORGE_LANG` environment variable
> (`FORGE_LANG=en /forge:finalize`, or `export FORGE_LANG=en`). It is no longer
> read anywhere, and setting it now does nothing at all. Nothing replaces it —
> the conversation's language is the answer, and a variable that only restated
> that was a second place for the same fact. If a shell profile still carries
> `export FORGE_LANG=…`, the line can go.

> **Not translated:** a handful of strings stay English in every language,
> because something reads them mechanically rather than a person reading them —
> Conventional Commits prefixes (`fix:` etc.), all emoji, command and file
> names, and the internal keys each command reads back out of its own
> output. A CI gate greps `/forge:review-design`'s output for `Verdict:`
> and `NOT READY`; translating those would break it.
>
> This is deliberately not a list. Every such string is marked where it is
> defined in the command file, alongside what reads it — a roster kept here as
> well would be a second copy, and a copy of a fact like this drifts out of date
> the first time a key is added.

### Requirements

`/forge:review-design` needs one thing: a **git repository**. It resolves every
path from the repository root, so it has to be run inside one — nothing else on
this list applies to it.

`/forge:finalize` and `/forge:watch` additionally need:

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
> Markdown ファイルを読む（`--fix` 時はその同じファイルを書き換える）だけなので
> 素の Claude Code でも動作する。
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
たびに再レビューし、最大 3 周まで繰り返します。

```bash
# 最新の設計書をレポート。superpowers の標準構成では同じ機能の spec と plan が
# 同じ日付になるため、通常はどちらを見るか質問されます。
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

### 出力言語

メッセージ・通知・コミットメッセージ本文・レビューリプライは、**会話している
言語で返ります。**設定は不要です。日本語で話しかければ日本語、英語なら英語です。

> **1.6 で撤去:** 以前のバージョンは `FORGE_LANG` 環境変数を読んでいました
> （`FORGE_LANG=en /forge:finalize`、または `export FORGE_LANG=en`）。現在は
> どこからも読まれず、設定しても何も起きません。代替はありません — 会話の言語
> がその答えであり、それを言い直すだけの変数は同じ事実の 2 つ目の置き場でした。
> シェルの profile に `export FORGE_LANG=…` が残っていれば、その行は削除して
> 構いません。

> **翻訳されないもの:** 人ではなく機械が読む文字列は、どの言語でも英語のまま
> です。Conventional Commits の接頭辞（`fix:` など）、すべての絵文字、コマンド名
> とファイル名、そして各コマンドが自身の出力から読み戻す内部キーが該当します。
> CI のゲートは `/forge:review-design` の出力を `Verdict:` や `NOT READY` で
> grep するため、これらを翻訳すると壊れます。
>
> ここに一覧は置きません。該当する文字列はすべて、コマンドファイル内の定義箇所
> に「何がそれを読むのか」と併せて明記してあります。ここにも一覧を置くとそれは
> 二つ目の複製になり、キーが増えた最初の一回で古くなります。

### 前提条件

`/forge:review-design` に必要なのは **git リポジトリ** だけです。全てのパスを
リポジトリルート基準で解決するため、リポジトリ内で実行してください。以下の
項目はいずれもこのコマンドには不要です。

`/forge:finalize` と `/forge:watch` には加えて以下が必要です:

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
> Markdown 文件（使用 `--fix` 时改写同一个文件），因此在原生 Claude Code 上
> 即可运行。`superpowers` 插件是可选的，
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
最多 3 轮。

```bash
# 报告最新的设计文档。在 superpowers 的标准布局中，同一功能的 spec 与 plan
# 日期相同，因此通常会询问你指的是哪一个。
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

### 输出语言

消息、通知、提交消息正文、评审回复都会以**你对话所用的语言**返回。无需配置：
用日语交流就输出日语，用英语就输出英语。

> **1.6 中已移除：** 早期版本会读取 `FORGE_LANG` 环境变量
> （`FORGE_LANG=en /forge:finalize` 或 `export FORGE_LANG=en`）。现在任何地方
> 都不再读取它，设置了也不会有任何效果。没有替代项——对话所用的语言就是答案，
> 而只是重述这一点的变量，不过是同一事实的第二个存放处。若 shell profile 中
> 仍有 `export FORGE_LANG=…`，可以删掉那一行。

> **不翻译的内容：** 由程序而非人读取的字符串，在任何语言下都保持英文：
> Conventional Commits 前缀（如 `fix:`）、所有表情符号、命令名与文件名，以及
> 各命令从自身输出中读回的内部键。CI 门禁会在 `/forge:review-design` 的输出中
> grep `Verdict:` 和 `NOT READY`，翻译后就会失效。
>
> 这里刻意不列清单。每个这样的字符串都在命令文件的定义处标注，并注明是什么在
> 读取它；在这里再列一份就成了第二个副本，而这类副本在新增一个键时就会过时。

### 前提条件

`/forge:review-design` 只需要一件事：一个 **git 仓库**。它从仓库根目录解析
所有路径，因此必须在仓库内运行；下面列出的其余项均与它无关。

`/forge:finalize` 与 `/forge:watch` 则额外需要：

- 已安装并完成认证的 `gh` CLI
- macOS（如需使用通知功能）
- 仓库中已配置 GitHub Actions 等 CI
- 上述「依赖命令」全部可用
