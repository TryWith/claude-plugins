---
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, Bash]
model: claude-opus-5
runs: 3
---
/forge:review-design docs/superpowers/specs/2026-01-10-cache-design.md --fx
