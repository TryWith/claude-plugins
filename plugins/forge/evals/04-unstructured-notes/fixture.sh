#!/usr/bin/env bash
# Seeds the eval workspace: a design note outside specs/ with no `##` headings
# and none of the usual design-document sections. Its filename ends in
# -design.md, so /forge:review-design types it as a spec without asking.
# Writes only inside the current directory.
set -euo pipefail
git init -q
git config user.name fixture
git config user.email fixture@example.invalid
# The scaffold inherits the operator's global git config. A global
# `commit.gpgsign = true` makes the commit below fail under `set -e`, which
# aborts the scaffold and errors the case at $0.00 on that machine alone.
git config commit.gpgsign false
mkdir -p design

cat > design/cache-notes-design.md <<'EOF'
# Cache notes

We want to cache pricing API responses so repeated lookups are faster.
Probably keep them for a few minutes. Storage could be SQLite or something else.

- cache getPrice results
- expire old entries
- maybe add a metric later
EOF

git add -A
git commit -qm fixture
