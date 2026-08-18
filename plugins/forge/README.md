# Forge

[English](#english) | [日本語](#日本語) | [中文](#中文)

---

## English

A Claude Code plugin that orchestrates existing developer commands and takes a PR all the way from creation through CI / review monitoring to auto-fix.

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

### Usage

After finishing your implementation, run:

```bash
/forge:finalize
```

It will then:

1. `/commit-commands:commit-push-pr` — commit, push, open a PR
2. `/code-review --fix` — started automatically when the session permits it, otherwise you are asked to type it once per review iteration; the applied fixes are then committed and re-reviewed until clean
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

> **Not translated:** Conventional Commits prefixes (`fix:` etc.) and all emoji stay shared across all languages.

### Requirements

- `gh` CLI installed and authenticated
- macOS (for the notification feature)
- A CI system such as GitHub Actions configured on the repo
- All dependency commands available

---

## 日本語

既存の開発系コマンドをオーケストレーションし、PR作成後のCI・レビュー監視・自動修正までを完遂する Claude Code プラグイン。

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

### 使い方

実装完了後、以下を実行するだけ:

```bash
/forge:finalize
```

以下が実行される:

1. `/commit-commands:commit-push-pr` — コミット・プッシュ・PR作成
2. `/code-review --fix` — セッションが許可していれば自動起動、拒否された場合のみレビュー1周ごとに入力を依頼。適用された修正をコミットし、クリーンになるまで再レビュー
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

> **対象外:** Conventional Commits プレフィックス（`fix:` 等）とすべての絵文字は全言語共通で維持されます。

### 前提条件

- `gh` CLI がインストール・認証済み
- macOS（通知機能を利用する場合）
- リポジトリで GitHub Actions などの CI が稼働
- 上記「依存コマンド」が全て利用可能

---

## 中文

将既有开发命令编排起来，从 PR 创建到 CI / 评审监控直至自动修复一并完成的 Claude Code 插件。

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

### 使用方法

完成实现后，运行:

```bash
/forge:finalize
```

将执行:

1. `/commit-commands:commit-push-pr` — 提交、推送、创建 PR
2. `/code-review --fix` — 会话允许时自动启动，被拒绝时才请你在每轮评审各输入一次；随后自动提交所应用的修复并重新评审直至无问题
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

> **不翻译:** Conventional Commits 前缀（如 `fix:`）与所有表情符号在所有语言中保持一致。

### 前提条件

- 已安装并完成认证的 `gh` CLI
- macOS（如需使用通知功能）
- 仓库中已配置 GitHub Actions 等 CI
- 上述「依赖命令」全部可用
