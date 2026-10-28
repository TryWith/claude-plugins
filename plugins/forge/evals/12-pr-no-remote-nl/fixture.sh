#!/usr/bin/env bash
# Seeds the eval workspace for /forge:review-pr: a small repository with
# review rules and no GitHub remote, so no pull request can be resolved, plus
# one uncommitted edit that carries an off-by-one bug.
# Shared verbatim by 09-pr-no-remote, 10-pr-neg-explain, 11-pr-neg-local-diff
# and 12-pr-no-remote-nl — each fixture.sh stays self-contained, so a change
# here has to be copied to the other three. `Shared verbatim by` is an identifier, not prose:
# `evals/check-patterns.mjs` matches that phrase in this leading comment block
# to find the group and compare the copies byte for byte.
# Writes only inside the current directory.
set -euo pipefail
git init -q
git config user.name fixture
git config user.email fixture@example.invalid
# A global `commit.gpgsign = true` would fail the commit below under `set -e`.
git config commit.gpgsign false
mkdir -p src

cat > CLAUDE.md <<'EOF'
# Pricing service

- Run tests with `npm test`.
- Verified means the tests pass and the change was exercised in a browser.
EOF

cat > REVIEW.md <<'EOF'
# Review rules

- Important: security issues, data loss, API behaviour that differs from its spec.
- Nit: everything else. At most 5 per review.
- On a re-review, report Important findings only.
EOF

cat > package.json <<'EOF'
{ "name": "pricing", "private": true, "scripts": { "test": "node --test" } }
EOF

cat > src/price.ts <<'EOF'
export function lastPrice(prices: number[]): number | undefined {
  return prices[prices.length - 1];
}
EOF

git add -A
git commit -qm fixture

# Uncommitted edit with an off-by-one: the loop never reads the last element.
cat > src/price.ts <<'EOF'
export function lastPrice(prices: number[]): number | undefined {
  return prices[prices.length - 1];
}

export function maxPrice(prices: number[]): number | undefined {
  let max: number | undefined;
  for (let i = 0; i < prices.length - 1; i++) {
    if (max === undefined || prices[i] > max) max = prices[i];
  }
  return max;
}
EOF
