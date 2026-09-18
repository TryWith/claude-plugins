#!/usr/bin/env bash
# Seeds the eval workspace: a small repository whose only spec carries four
# planted defects (a TBD, a contradictory retry count, a missing file named as
# existing, and a dependency CLAUDE.md forbids). Shared verbatim by
# 01-spec-defects, 05-typo-flag and 06-neg-explain — each fixture.sh stays
# self-contained, so a change here has to be copied to the other two.
# `Shared verbatim by` is an identifier, not prose: `evals/check-patterns.mjs`
# matches that phrase in this leading comment block to find the group and
# compare the copies byte for byte. Reword it and the check stops running.
# Writes only inside the current directory.
set -euo pipefail
git init -q
git config user.name fixture
git config user.email fixture@example.invalid
# The scaffold inherits the operator's global git config. A global
# `commit.gpgsign = true` makes the commit below fail under `set -e`, which
# aborts the scaffold and errors the case at $0.00 on that machine alone.
git config commit.gpgsign false
mkdir -p src/db docs/superpowers/specs

cat > CLAUDE.md <<'EOF'
# Pricing service

- Do not add new runtime dependencies.
- Persistence uses the existing SQLite database opened by `src/db/sqlite.ts`.
EOF

cat > package.json <<'EOF'
{ "name": "pricing", "private": true, "scripts": { "test": "node --test" } }
EOF

cat > src/db/sqlite.ts <<'EOF'
export function openDatabase(path: string) {
  return { path };
}
EOF

cat > docs/superpowers/specs/2026-01-10-cache-design.md <<'EOF'
# Response Cache Design

**Date:** 2026-01-10

## 1. Goal

Cache responses from the pricing API so that repeated lookups within five minutes do not call the API again.

## 2. Retry policy

When a pricing API call fails, retry up to 3 times with a 200 ms delay before returning the error to the caller.

## 3. Storage

The storage mechanism for cached entries is TBD.

## 4. Components

- Modify the existing `src/cache/store.ts` to add `get` and `set` with a TTL.
- Introduce Redis as the cache backend, through a new `redis` client dependency.
- `src/db/sqlite.ts` stays unchanged.

## 5. Error handling

If the cache backend is unavailable, bypass the cache and call the pricing API directly, retrying up to 5 times.

## 6. Alternatives considered

- In-process memory map: rejected because entries would be lost on every deploy.
- HTTP caching headers: rejected because the pricing API does not send them.

## 7. Testing

- Unit tests for `get` and `set`, including TTL expiry.
- An integration test that a second lookup within five minutes does not call the API.

## 8. Acceptance criteria

- A repeated lookup within five minutes returns the cached value without an API call.
- All tests in section 7 pass.
EOF

git add -A
git commit -qm fixture
