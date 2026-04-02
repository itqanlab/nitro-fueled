# Completion Report — TASK_2026_306

## Summary

Replaced hardcoded `MOCK_AGENT_EDITOR_LIST` in `AgentEditorStore` with real API calls.
Added `GET/POST/PUT/DELETE /api/agents` backend endpoints backed by `.nitro-fueled/agents.json`.
`AgentEditorStore.agentList` converted from static readonly array to `signal<AgentEditorData[]>`
with async loading on construction. `saveVersion()` now persists via `PUT /api/agents/:id`.

## What Was Built

- **`agents.service.ts`** — JSON-file-backed CRUD service (`.nitro-fueled/agents.json`)
- **`agents.controller.ts`** — REST controller at `/api/agents` with GET/POST/PUT/DELETE
- **`dashboard.module.ts`** — registered `AgentsService` + `AgentsController`
- **`api.service.ts`** — added `getAgents`, `getAgent`, `createAgent`, `updateAgent`, `deleteAgent`
- **`agent-editor.store.ts`** — removed mock import; signal-based list; API-backed load/save/create/delete
- **`agent-list-sidebar.component.ts`** — updated computed fns to call `agentList()` as signal

## Acceptance Criteria

- [x] Agent list loads from real API
- [x] CRUD operations persist (create, update via saveVersion, delete)
- [x] No MOCK_AGENTS or MOCK_AGENT_EDITOR_LIST used in the store

## Review Results

Skipped (user instruction: no reviewers).

## Test Results

Backend build: PASS (`nx run dashboard-api:build`).

## Files Changed

7 files (2 new, 5 modified)

## Follow-on Tasks

- None required. `MOCK_AGENTS` and `MOCK_AGENT_EDITOR_LIST` still exist in `mock-data.constants.ts` and `mock-data.service.ts` but are only used in test specs — safe to leave.
