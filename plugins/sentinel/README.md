# Sentinel

[English](#english) | [日本語](#日本語) | [中文](#中文)

---

## English

A Claude Code plugin that orchestrates existing developer commands and takes a PR all the way from creation through CI / review monitoring to auto-fix.

### Install

```bash
/plugin marketplace add TryWith/claude-plugins
/plugin install sentinel
```

### Dependencies

The following commands must be available before use:

| Command | Source |
|---------|--------|
| `/simplify` | Claude Code bundled skill |
| `/commit-commands:commit-push-pr` | `commit-commands` plugin |
| `/code-review:code-review` | `code-review` plugin |

### Usage

After finishing your implementation, run:

```bash
/sentinel:finalize
```

It will automatically:

1. `/simplify` — simplify the code
2. `/commit-commands:commit-push-pr` — commit, push, open a PR
3. `/code-review:code-review` — self-review and fix loop
4. PR watch loop (5 min interval, exits after 2 consecutive clears)
   - CI failure → auto-fix
   - Review comments → auto-respond
   - Changes Requested → auto-respond
5. macOS desktop notification

### Commands

| Command | Purpose |
|---------|---------|
| `/sentinel:finalize` | Full workflow |
| `/sentinel:watch` | PR watch loop only |

### Multilingual output

Output messages, notifications, commit message bodies, and review replies are translated to the user's preferred language.

#### Language resolution order

1. `SENTINEL_LANG` env var (e.g. `ja`, `en`, `zh-CN`, `ko`)
2. Claude Code conversation language setting
3. Default: `ja` (Japanese)

#### Usage

```bash
# Run once in English
SENTINEL_LANG=en /sentinel:finalize

# Set for the whole shell
export SENTINEL_LANG=en
/sentinel:finalize
```

#### Verified languages

| Code | Language | Status |
|------|----------|--------|
| `ja` | Japanese | ✅ Default |
| `en` | English | ✅ Source language |
| Others (BCP 47) | — | Works if Claude can translate; naturalness not guaranteed |

See [`commands/_lib/lang-preamble.md`](./commands/_lib/lang-preamble.md) for the full spec.

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
/plugin install sentinel
```

### 依存コマンド

事前に以下が利用可能であること:

| コマンド | 提供元 |
|---------|--------|
| `/simplify` | Claude Code 標準バンドルSkill |
| `/commit-commands:commit-push-pr` | `commit-commands` Plugin |
| `/code-review:code-review` | `code-review` Plugin |

### 使い方

実装完了後、以下を実行するだけ:

```bash
/sentinel:finalize
```

以下が自動で実行される:

1. `/simplify` — コード簡素化
2. `/commit-commands:commit-push-pr` — コミット・プッシュ・PR作成
3. `/code-review:code-review` — 自己レビュー＆修正
4. PR監視ループ（5分間隔・連続2回クリアで完了）
   - CI失敗 → 自動修正
   - レビューコメント → 自動対応
   - Changes Requested → 自動対応
5. macOSデスクトップ通知

### コマンド一覧

| コマンド | 用途 |
|---------|------|
| `/sentinel:finalize` | フルワークフロー |
| `/sentinel:watch` | PR監視ループのみ |

### 多言語出力

出力メッセージ・通知・コミットメッセージ本文・レビューリプライは、ユーザーの言語設定に応じて翻訳されます。

#### 言語決定の優先順位

1. 環境変数 `SENTINEL_LANG`（例: `ja`, `en`, `zh-CN`, `ko`）
2. Claude Code の会話言語設定
3. デフォルト: `ja`（日本語）

#### 使い方

```bash
# 一時的に英語で実行
SENTINEL_LANG=en /sentinel:finalize

# シェル全体で英語に
export SENTINEL_LANG=en
/sentinel:finalize
```

#### 検証済み言語

| コード | 言語 | 状態 |
|--------|------|------|
| `ja` | 日本語 | ✅ デフォルト |
| `en` | English | ✅ ソース言語 |
| その他 (BCP 47) | — | Claude が翻訳可能なら対応（自然さは保証されない） |

詳細は [`commands/_lib/lang-preamble.md`](./commands/_lib/lang-preamble.md) を参照。

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
/plugin install sentinel
```

### 依赖命令

使用前需确保以下命令可用:

| 命令 | 来源 |
|------|------|
| `/simplify` | Claude Code 内置 Skill |
| `/commit-commands:commit-push-pr` | `commit-commands` 插件 |
| `/code-review:code-review` | `code-review` 插件 |

### 使用方法

完成实现后，运行:

```bash
/sentinel:finalize
```

将自动执行:

1. `/simplify` — 简化代码
2. `/commit-commands:commit-push-pr` — 提交、推送、创建 PR
3. `/code-review:code-review` — 自我评审与修复循环
4. PR 监控循环（每 5 分钟一次，连续 2 次全部通过即结束）
   - CI 失败 → 自动修复
   - 评审评论 → 自动响应
   - Changes Requested → 自动响应
5. macOS 桌面通知

### 命令一览

| 命令 | 用途 |
|------|------|
| `/sentinel:finalize` | 完整工作流 |
| `/sentinel:watch` | 仅 PR 监控循环 |

### 多语言输出

输出消息、通知、提交消息正文、评审回复将根据用户的语言设置进行翻译。

#### 语言决定优先级

1. 环境变量 `SENTINEL_LANG`（例：`ja`, `en`, `zh-CN`, `ko`）
2. Claude Code 会话语言设置
3. 默认：`ja`（日语）

#### 使用示例

```bash
# 临时以英语运行
SENTINEL_LANG=en /sentinel:finalize

# 整个 shell 切换为英语
export SENTINEL_LANG=en
/sentinel:finalize
```

#### 已验证语言

| 代码 | 语言 | 状态 |
|------|------|------|
| `ja` | 日语 | ✅ 默认 |
| `en` | 英语 | ✅ 源语言 |
| 其他 (BCP 47) | — | 若 Claude 可翻译则支持（不保证自然度） |

详情请参阅 [`commands/_lib/lang-preamble.md`](./commands/_lib/lang-preamble.md)。

> **不翻译:** Conventional Commits 前缀（如 `fix:`）与所有表情符号在所有语言中保持一致。

### 前提条件

- 已安装并完成认证的 `gh` CLI
- macOS（如需使用通知功能）
- 仓库中已配置 GitHub Actions 等 CI
- 上述「依赖命令」全部可用
