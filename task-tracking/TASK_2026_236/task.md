# Task: Auto-Routing Engine — Intelligent Launcher/Model Selection

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P2-Medium   |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | required    |
| Worker Mode           | single      |

## Description

Build the auto-routing engine that uses compatibility data to select the best launcher/model combination for each task. The supervisor calls this before spawning a worker.

**Routing logic:**

1. Input: task type, workflow phase, project stack, user preferences
2. Query compatibility table for matching historical outcomes
3. Score each launcher/model combo:
   - Success rate (weight: 40%)
   - Review first-pass rate (weight: 25%)
   - Cost efficiency (weight: 20%)
   - Speed (weight: 15%)
4. Apply user preference overrides (from TASK_2026_234)
5. Output: recommended launcher + model, with confidence score

**Edge cases:**
- **No data yet** — fall back to user preferences or system defaults (Claude Code + default model)
- **Low confidence** (< 5 data points for this combo) — use default but flag as "exploring"
- **Conflicting signals** (fast but unreliable) — prefer reliability over speed

**Routing recommendations surface in:**
- Dashboard intelligence tab ("You could save 40% by using Codex for BUGFIX tasks")
- API response (`GET /api/reports/routing-recommendations`)
- Supervisor logs when routing decision is made

## Dependencies

- TASK_2026_235 — Compatibility tracking (data source)
- TASK_2026_224 — Supervisor service (consumer of routing decisions)

## Acceptance Criteria

- [ ] Routing engine queries compatibility data and scores combos
- [ ] Supervisor uses routing engine before spawning workers
- [ ] Fallback to defaults when insufficient data
- [ ] Routing recommendations exposed via API
- [ ] Confidence score indicates data quality behind the recommendation

## References

- Compatibility data: TASK_2026_235
- Supervisor service: TASK_2026_224
- Current model routing: `.claude/skills/auto-pilot/SKILL.md` (search "tier")

## File Scope

- `apps/dashboard-api/src/supervisor/routing-engine.ts` (new)
- `apps/dashboard-api/src/supervisor/routing-engine.spec.ts` (new)
- `apps/dashboard-api/src/reports/reports.controller.ts` (modified — add recommendations endpoint)

## Parallelism

Can run in parallel — mostly new files. Minor overlap with TASK_2026_231 on reports controller — run after 231.
