# Handoff — TASK_2026_335

## Files Changed
- packages/mcp-cortex/src/supervisor/resolver.ts (new, 105 lines)
- packages/mcp-cortex/src/supervisor/resolver.spec.ts (new, 214 lines)

## Commits
- (see implementation commit)

## Decisions
- Used iterative DFS (not recursive) for cycle detection to avoid stack overflow on large graphs
- `parseDeps` returns [] on malformed JSON rather than throwing — keeps the resolver safe against bad DB data
- `buildAdjacencyList` filters out dependency IDs not present in the task set, so unknown deps don't cause errors
- Priority sort uses a numeric lookup table rather than string comparison for correctness

## Known Risks
- Self-loop detection relies on the adjacency list filtering only deps present in the task set; external-only self-refs (GHOST deps) are ignored silently — intentional per spec
- No memoization of cycle detection; on very large task graphs (1000+) this runs O(V+E) per call — acceptable for current scale
