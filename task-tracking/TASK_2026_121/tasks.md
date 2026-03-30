# TASK_2026_121 — Implementation Tasks

## Batch 1: Foundation

| # | Task | Status |
|---|------|--------|
| 1 | Extend db/schema.ts with full workers table columns, types, and helpers | COMPLETE |
| 2 | Create process/spawn.ts — process launcher with GLM key resolution | COMPLETE |
| 3 | Create process/token-calculator.ts — model pricing and cost calculation | COMPLETE |
| 4 | Create process/jsonl-watcher.ts — stream-json accumulator, DB push | COMPLETE |

## Batch 2: Tools

| # | Task | Status |
|---|------|--------|
| 5 | Create tools/sessions.ts — create, get, update, list, end session | COMPLETE |
| 6 | Create tools/workers.ts — spawn, list, stats, activity, kill worker | COMPLETE |
| 7 | Create events/subscriptions.ts — FileWatcher, subscribe, get-pending-events | COMPLETE |

## Batch 3: Integration

| # | Task | Status |
|---|------|--------|
| 8 | Update index.ts — register all 12 new tools with Zod schemas | COMPLETE |
| 9 | Add chokidar to package.json dependencies | COMPLETE |
| 10 | Build and verify zero TypeScript errors | COMPLETE |
