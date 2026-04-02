# Context — TASK_2026_204

## Task Type
REFACTORING

## Strategy
Architect → Team-Leader → Dev → Review Lead + Test Lead

## User Intent
Refactor the persistent SupervisorService from a singleton (one session at a time) to a multi-session architecture where each session is an independent SessionRunner with its own loop, config, and workers. This enables users to manage multiple concurrent sessions from the web dashboard, each with independently mutable configuration (model, provider, concurrency, priority).

## Current State
The auto-pilot module in `apps/dashboard-api/src/auto-pilot/` currently has:
- `supervisor.service.ts` — singleton service with one `state` object and one `loopTimer`
- `supervisor-db.service.ts` — writable DB access (session, task, worker operations)
- `worker-manager.service.ts` — spawns and monitors worker child processes
- `prompt-builder.service.ts` — constructs worker prompts
- `auto-pilot.service.ts` — facade over SupervisorService
- `auto-pilot.controller.ts` — REST endpoints
- `auto-pilot.model.ts` — API DTOs
- `auto-pilot.types.ts` — shared types
- `auto-pilot.module.ts` — NestJS module wiring

## Target State
- `session-runner.ts` (NEW) — plain class, one instance per session, owns its own loop/timer/state
- `session-manager.service.ts` (NEW) — NestJS singleton, manages Map<sessionId, SessionRunner>
- `supervisor.service.ts` (DELETED) — replaced by session-manager + session-runner
- Updated controller with session-centric REST API including PATCH /sessions/:id/config
- Updated types, DTOs, facade, module

## Constraints
- Must keep the same DB schema (sessions, workers, tasks tables)
- Must keep WorkerManagerService and SupervisorDbService as-is (shared across sessions)
- Must keep PromptBuilderService as-is
- SessionRunner is a plain class (not NestJS injectable) — instantiated per session
