# Task: Dashboard API: Skill Usage Analytics Endpoint


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Add Dashboard API endpoint for skill usage analytics. GET /api/analytics/skill-usage?period=30d returns aggregated skill invocation data from the cortex DB. Response shape: [{ skill: string, count: number, avgDuration: number, lastUsed: string }]. The endpoint queries the skill_invocations table via cortex DB (direct SQLite read or via MCP get_skill_usage tool). Add period filtering (7d, 30d, 90d, all). Sort by count descending. This feeds the frontend bubble chart component.

## Dependencies

- TASK_2026_292

## Acceptance Criteria

- [ ] GET /api/analytics/skill-usage returns skill usage array sorted by count
- [ ] Period filtering works (7d, 30d, 90d, all)
- [ ] Response includes count, avgDuration, and lastUsed per skill
- [ ] Empty response when no invocations exist (not an error)

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/analytics/skill-usage.controller.ts (new)
- apps/dashboard-api/src/analytics/skill-usage.service.ts (new)


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_292 — depends on skill_invocations table.
