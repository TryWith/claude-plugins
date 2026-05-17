# TryWith Claude Plugins

[English](#english) | [日本語](#日本語) | [中文](#中文)

---

## English

Official Claude Code plugin catalog from TryWith Inc.

### Install

```bash
/plugin marketplace add TryWith/claude-plugins
```

### Plugins

| Plugin | Overview | Commands |
|--------|----------|----------|
| [`sentinel`](./plugins/sentinel) | Workflow orchestrator that takes a PR from creation through CI monitoring and auto-fix. Chains `/simplify`, `/commit-commands:commit-push-pr`, `/code-review:code-review`, then watches the PR every 5 minutes and auto-fixes until two consecutive all-clear checks. Multilingual output via `SENTINEL_LANG`. | `/sentinel:finalize`, `/sentinel:watch` |

### Usage

```bash
# List available plugins
/plugin list

# Install
/plugin install sentinel

# Use
/sentinel:finalize
```

### Contributing

Add new plugins under `plugins/` and register them in `.claude-plugin/marketplace.json`.

---

## 日本語

株式会社TryWith の Claude Code 拡張プラグイン公式カタログ。

### インストール

```bash
/plugin marketplace add TryWith/claude-plugins
```

### 提供プラグイン

| プラグイン | 概要 | コマンド |
|----------|------|---------|
| [`sentinel`](./plugins/sentinel) | PR 作成から CI 監視・自動修正までを一気通貫で担うワークフローオーケストレータ。`/simplify`・`/commit-commands:commit-push-pr`・`/code-review:code-review` を順次実行後、PR を 5 分間隔で監視し連続 2 回のクリアで終了する。`SENTINEL_LANG` で多言語出力対応。 | `/sentinel:finalize`, `/sentinel:watch` |

### 利用方法

```bash
# プラグイン一覧を確認
/plugin list

# インストール
/plugin install sentinel

# 使用
/sentinel:finalize
```

### コントリビュート

新規プラグインは `plugins/` 配下に追加し、`.claude-plugin/marketplace.json` に登録する。

---

## 中文

TryWith 公司官方 Claude Code 插件目录。

### 安装

```bash
/plugin marketplace add TryWith/claude-plugins
```

### 提供插件

| 插件 | 概要 | 命令 |
|------|------|------|
| [`sentinel`](./plugins/sentinel) | 一气呵成完成从 PR 创建、CI 监控到自动修复的工作流编排器。依次执行 `/simplify`、`/commit-commands:commit-push-pr`、`/code-review:code-review`，随后每 5 分钟监控 PR，连续 2 次全部通过即结束。通过 `SENTINEL_LANG` 支持多语言输出。 | `/sentinel:finalize`, `/sentinel:watch` |

### 使用方法

```bash
# 查看可用插件
/plugin list

# 安装
/plugin install sentinel

# 使用
/sentinel:finalize
```

### 贡献

新插件请添加到 `plugins/` 目录下，并在 `.claude-plugin/marketplace.json` 中注册。
