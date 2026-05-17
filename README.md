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
| [`forge`](./plugins/forge) | Post-implementation workflow orchestrator: commit → PR → CI/review watch → auto-fix until merge-ready. | `/forge:finalize`, `/forge:watch` |

### Usage

```bash
# List available plugins
/plugin list

# Install
/plugin install forge

# Use
/forge:finalize
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
| [`forge`](./plugins/forge) | 実装完了後のワークフローを一括実行: コミット → PR → CI・レビュー監視 → 自動修正でマージ可能まで。 | `/forge:finalize`, `/forge:watch` |

### 利用方法

```bash
# プラグイン一覧を確認
/plugin list

# インストール
/plugin install forge

# 使用
/forge:finalize
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
| [`forge`](./plugins/forge) | 一键执行实现后工作流：提交 → PR → CI/评审监控 → 自动修复至可合并。 | `/forge:finalize`, `/forge:watch` |

### 使用方法

```bash
# 查看可用插件
/plugin list

# 安装
/plugin install forge

# 使用
/forge:finalize
```

### 贡献

新插件请添加到 `plugins/` 目录下，并在 `.claude-plugin/marketplace.json` 中注册。
