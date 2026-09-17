#!/usr/bin/env bash
# Seeds the eval workspace: a plan whose backticked **Spec:** line names a spec
# that exists. The plan has no task for the spec's requirement R3, and it
# creates two files that do not exist yet (`src/cache/ttl.ts`,
# `src/pricing.test.ts`) — their absence is expected, not a defect. Shared
# verbatim by 03-companion-spec, 07-neg-implement and 08-companion-spec-nl —
# each fixture.sh stays self-contained, so a change here has to be copied to
# the other two.
# Writes only inside the current directory.
set -euo pipefail
git init -q
git config user.name fixture
git config user.email fixture@example.invalid
mkdir -p src/db docs/superpowers/specs docs/superpowers/plans

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

cat > src/pricing.ts <<'EOF'
export async function getPrice(sku: string): Promise<number> {
  const res = await fetch(`https://pricing.example.invalid/${sku}`);
  return (await res.json()).priceCents;
}
EOF

cat > src/metrics.ts <<'EOF'
export const metrics = new Map<string, number>();
EOF

cat > docs/superpowers/specs/2026-01-10-cache-design.md <<'EOF'
# Response Cache Design

**Date:** 2026-01-10

## 1. Goal

Cache pricing API responses in the existing SQLite database so that repeated lookups within five minutes do not call the API again.

## 2. Requirements

- **R1:** `getPrice(sku)` in `src/pricing.ts` returns a cached price when an entry younger than five minutes exists.
- **R2:** Entries older than five minutes are treated as missing and refreshed from the API.
- **R3:** The service exposes a `cache_hit_ratio` metric through the existing `src/metrics.ts`.

## 3. Storage

A new `price_cache` table in the database opened by `src/db/sqlite.ts`, with columns `sku TEXT PRIMARY KEY`, `price_cents INTEGER` and `fetched_at INTEGER`.

## 4. Error handling

If writing to `price_cache` fails, return the API result without caching it and log a warning.

## 5. Alternatives considered

- Redis: rejected because `CLAUDE.md` forbids new runtime dependencies.
- In-process map: rejected because entries would be lost on every deploy.

## 6. Testing

Unit tests for R1 and R2 against an in-memory SQLite database, and a test that `metrics` contains `cache_hit_ratio` after a lookup.

## 7. Acceptance criteria

Every requirement in section 2 has a passing test.
EOF

cat > docs/superpowers/plans/2026-01-10-cache.md <<'EOF'
# Response Cache Implementation Plan

**Goal:** Cache pricing API responses in SQLite for five minutes.

**Spec:** `docs/superpowers/specs/2026-01-10-cache-design.md`

## Task 1: Create the price_cache table

**Files:**
- Modify: `src/db/sqlite.ts`

- [ ] Add `CREATE TABLE IF NOT EXISTS price_cache (sku TEXT PRIMARY KEY, price_cents INTEGER, fetched_at INTEGER)` to `openDatabase`.
- [ ] Run `npm test` and confirm it passes.

## Task 2: Read from the cache in getPrice (R1)

**Files:**
- Modify: `src/pricing.ts`
- Create: `src/pricing.test.ts`

- [ ] Write a test: when `price_cache` holds a row for the SKU fetched less than five minutes ago, `getPrice` returns it without calling `fetch`.
- [ ] Look the SKU up in `price_cache` at the start of `getPrice` and return the cached price when it is fresh.
- [ ] Run `npm test` and confirm the new test passes.

## Task 3: Refresh stale entries (R2)

**Files:**
- Create: `src/cache/ttl.ts`
- Modify: `src/pricing.ts`
- Modify: `src/pricing.test.ts`

- [ ] Write a test: a row older than five minutes causes a `fetch` call and the row is updated.
- [ ] Create `src/cache/ttl.ts` exporting `isFresh(fetchedAt: number, now: number): boolean`, true when the row is younger than five minutes.
- [ ] In `getPrice`, treat rows for which `isFresh` returns false as missing, and upsert the fetched price.
- [ ] Run `npm test` and confirm the test passes.
EOF

git add -A
git commit -qm fixture
