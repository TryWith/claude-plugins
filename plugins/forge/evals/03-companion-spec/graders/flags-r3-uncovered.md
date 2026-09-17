---
type: llm
focus: last_message
---
The plan under review names a companion spec whose requirements are R1 (return a cached price when a fresh entry exists), R2 (refresh entries older than five minutes) and R3 (expose a `cache_hit_ratio` metric through `src/metrics.ts`). The plan has tasks for R1 and R2 only.

PASS only if the response states that requirement R3 — the cache hit ratio metric — has no corresponding task in the plan (any wording, e.g. "R3 is not covered by any task", 「R3 に対応するタスクがない」).

FAIL if the response does not raise the missing R3 coverage, says every spec requirement is covered, or does not review the plan at all (for example it only reports an error or an unknown command).
