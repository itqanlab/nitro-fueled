# Task: Audit Agent Editor store and fix data source


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

AgentEditorViewComponent (/agents) uses AgentEditorStore. It's unknown whether the store uses mock data or real API. MOCK_AGENTS and MOCK_AGENT_EDITOR_LIST exist in mock-data.constants.ts.

## What to do
1. Read all files in apps/dashboard/src/app/views/agent-editor/
2. Find and read AgentEditorStore — identify data sources
3. If mock: add GET /api/agents endpoint and wire store
4. Wire CRUD (create, edit, delete agent) to backend
5. Remove any MOCK_AGENTS or MOCK_AGENT_EDITOR_LIST usage

## Acceptance Criteria
- Agent list loaded from real API
- Create/edit/delete agents persist to backend
- No mock agent data used

## Dependencies

- TASK_2026_305

## Acceptance Criteria

- [ ] Agent list loads from real API
- [ ] CRUD operations persist
- [ ] No MOCK_AGENTS or MOCK_AGENT_EDITOR_LIST used

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/agent-editor/
- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard/src/app/services/api.service.ts


## Parallelism

Independent. Can run in parallel with P2 audit tasks.
