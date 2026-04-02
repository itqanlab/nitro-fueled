# Task: Dashboard & Docs — Align Health States with MCP Cortex

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | REFACTORING                  |
| Priority              | P2-Medium                    |
| Complexity            | Simple                       |
| Preferred Tier        | light                        |
| Model                 | default                      |
| Testing               | skip                         |
| Poll Interval         | default                      |
| Health Check Interval | default                      |
| Max Retries           | default                      |

## Description

Part 2 of 2 — original request: Unify worker health status definitions and thresholds across MCP cortex, dashboard, and documentation.

The dashboard API defines its own 3-state worker health model (`healthy | warning | stuck`) in parallel with the MCP cortex 6-state model — with no explicit mapping between them. After TASK_2026_185 adds `context_overflow`, the dashboard will be unaware of it. Additionally, `log-templates.md` in the auto-pilot skill documents health states using magic numbers, with no entry for `context_overflow`.

**Changes required:**

1. **`apps/dashboard-api/src/app/dtos/enums/worker.enums.ts`** — Add `context_overflow = 'context_overflow'` to the `WorkerHealth` enum. Add a comment block documenting the explicit mapping from MCP 6-state → dashboard 3-state:
   - `healthy` → `healthy`
   - `starting` → `healthy`
   - `high_context` → `warning`
   - `context_overflow` → `warning`
   - `compacting` → `warning`
   - `stuck` → `stuck`
   - `finished` → (not applicable — worker is gone)

2. **`apps/dashboard-api/src/dashboard/dashboard.types.ts`** — Add `context_overflow` to the `WorkerHealth` type union. Add the same mapping comment so both the enum and type stay in sync.

3. **`.claude/skills/auto-pilot/references/log-templates.md`** — Add `context_overflow` log entry alongside the existing `high_context` entry:
   ```
   | Worker context overflow | `| {HH:MM:SS} | auto-pilot | HEALTH CHECK — TASK_X: context_overflow ({context_percent}%) |` |
   ```
   Replace any inline `80%` threshold references with a note pointing to `HEALTH_CONTEXT_HIGH_THRESHOLD` and `HEALTH_CONTEXT_OVERFLOW_THRESHOLD` in `packages/mcp-cortex/src/constants.ts`.

## Dependencies

- TASK_2026_185 — must be complete first (adds `context_overflow` to MCP layer)

## Acceptance Criteria

- [ ] `WorkerHealth` enum includes `context_overflow`
- [ ] `WorkerHealth` type union includes `context_overflow`
- [ ] Explicit MCP → dashboard mapping is documented in both files
- [ ] `log-templates.md` has a `context_overflow` log entry
- [ ] No magic number thresholds remain in `log-templates.md`

## References

- `apps/dashboard-api/src/app/dtos/enums/worker.enums.ts` — lines 28-32
- `apps/dashboard-api/src/dashboard/dashboard.types.ts` — line 278
- `.claude/skills/auto-pilot/references/log-templates.md` — lines 18-24
- TASK_2026_185 — defines the MCP-side constants and `context_overflow` state

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_172 — both modify type unions in the dashboard-api layer. Risk of conflicting edits to the same files.

Suggested execution wave: Wave 2, after TASK_2026_185 completes.

## File Scope

- apps/dashboard-api/src/app/dtos/enums/worker.enums.ts
- apps/dashboard-api/src/dashboard/dashboard.types.ts
- .claude/skills/auto-pilot/references/log-templates.md
