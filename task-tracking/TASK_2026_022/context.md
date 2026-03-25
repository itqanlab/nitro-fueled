# Context - TASK_2026_022: Dashboard Data Service

## User Intent & Business Value

### Why This Feature Exists

The Nitro-Fueled orchestrator system produces valuable task-tracking data in markdown files, but this data is currently locked away in file format. Stakeholders cannot:

- See real-time progress of autonomous workers
- Monitor task states at a glance
- Get aggregate metrics (completion rates, costs, token usage)
- Receive push notifications when events occur

This data service unlocks the task-tracking data layer by:

1. **Exposing data via REST API** — Any client (web, desktop, TUI, mobile) can query structured JSON
2. **Broadcasting real-time events via WebSocket** — Clients receive instant updates without polling
3. **Maintaining an in-memory state cache** — Fast responses, no file I/O on every request
4. **Modular, replaceable architecture** — Any component can be swapped without breaking the API contract

### Business Problems Solved

| Problem | Solution |
|---------|----------|
| Task progress hidden in markdown files | REST API returns structured JSON for all task data |
| No visibility into worker activity | WebSocket events broadcast worker lifecycle events |
| Cannot track project health metrics | `/api/stats` endpoint provides aggregates |
| File-watching changes could corrupt data | Service is read-only — watches passively, never writes |
| Tight coupling between components and tech choices | Interface-based design allows swapping Hono, chokidar, gray-matter, etc. |

### Business Value Delivered

- **Stakeholder Visibility**: Product owners, tech leads, and users can monitor progress in real-time
- **Developer Experience**: Dashboard clients (web UI, TUI, desktop) build on a single source of truth
- **Future-Proof Architecture**: Replaceable components mean the service can evolve without breaking clients
- **Operational Insight**: Aggregate metrics enable data-driven decisions about worker performance, costs, and throughput

---

## Key Requirements Summary

### Core Functional Requirements

| Requirement | Description |
|-------------|-------------|
| **File Watching** | Watch `task-tracking/` directory for changes (add, change, unlink) |
| **Markdown Parsing** | Parse 8+ MD file types into structured JSON: registry, plan, state, tasks, reviews, reports, anti-patterns, lessons |
| **State Caching** | Maintain in-memory cache updated incrementally (no full re-parse on every change) |
| **REST API** | 9 endpoints returning JSON for all task data and aggregates |
| **WebSocket Events** | 12+ event types broadcast to all connected clients on state changes |
| **CLI Integration** | `npx nitro-fueled dashboard` command with `--service` and `--port` options |

### Interface Contracts (Modularity Requirements)

The service must define and implement contracts for:

1. **FileParser Interface** — Swap markdown parser implementation
2. **FileWatcher Interface** — Swap file watching implementation
3. **DashboardEventBus Interface** — Swap event bus implementation

These contracts ensure any component can be replaced independently without affecting the API contract.

### REST Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/registry` | All tasks: id, status, type, description, created, model, provider |
| `GET /api/plan` | Phases, milestones, task maps, decisions log, supervisor guidance |
| `GET /api/state` | Active workers, completed tasks, failed tasks, retry tracker, queue, session log |
| `GET /api/tasks/:id` | Full task: definition + context + plan + batches + reviews + completion report |
| `GET /api/tasks/:id/reviews` | All review findings for a task with severity |
| `GET /api/anti-patterns` | QA rules with categories and violation counts |
| `GET /api/review-lessons` | Learned patterns grouped by domain |
| `GET /api/stats` | Aggregate: total tasks, completion rate, cost breakdown, tokens by model |

### WebSocket Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `task:created` | `{ taskId, type, priority }` | New TASK_*/ folder appears |
| `task:updated` | `{ taskId, field, oldValue, newValue }` | task.md content changes |
| `task:state_changed` | `{ taskId, from, to, timestamp }` | Status change in registry.md |
| `worker:spawned` | `{ workerId, taskId, type, model, provider }` | New worker in orchestrator-state.md |
| `worker:progress` | `{ workerId, tokens, cost, lastAction }` | Worker stats update |
| `worker:completed` | `{ workerId, taskId, finalState }` | Worker moves to completed table |
| `worker:failed` | `{ workerId, taskId, reason }` | Worker moves to failed table |
| `review:written` | `{ taskId, reviewType, findingCount }` | New *-review.md file appears |
| `plan:updated` | `{ phase, change }` | plan.md content changes |
| `log:entry` | `{ timestamp, event, details }` | New row in session log table |

---

## Success Metrics

### Functional Success Criteria

| Metric | Success Definition |
|--------|--------------------|
| **Service Startup** | Data service starts and watches `task-tracking/` directory without errors |
| **MD Parsing** | All 8 MD file types parse correctly into structured JSON |
| **REST API** | All 9 endpoints return valid JSON with correct data structures |
| **WebSocket Events** | Events fire correctly when MD files change; all connected clients receive events |
| **State Caching** | Cache updates incrementally on file changes (verified via performance testing) |
| **State Differ** | Differ produces correct event types with accurate old/new values |
| **Multi-Client Support** | Multiple WebSocket clients connect and receive events simultaneously |
| **Missing File Handling** | Service runs without errors when tracking files are missing (new projects) |
| **Interface Contracts** | Parser, watcher, and event bus interfaces defined and implementations swappable |
| **CLI Integration** | `npx nitro-fueled dashboard --service` starts headless data service |
| **Auto-Discovery** | Service finds `task-tracking/` relative to working directory automatically |
| **Graceful Shutdown** | SIGINT/SIGTERM handled cleanly; no orphaned processes |

### Performance Metrics

| Metric | Target |
|--------|--------|
| REST API Response Time | < 100ms p95 (cached), < 500ms p95 (cold start) |
| WebSocket Event Latency | < 50ms from file change to client receipt |
| File Change to Cache Update | < 100ms (single file) |
| Memory Usage | < 200MB baseline, < 500MB with 1000 tasks |

### Quality Metrics

| Metric | Target |
|--------|--------|
| Type Coverage | 100% of public API and interfaces typed |
| Interface Isolation | No direct dependencies between replaceable components |
| Error Handling | All error paths return appropriate HTTP status codes or WebSocket error frames |
| CLI Exit Codes | Proper exit codes (0 = success, 1 = error) |

---

## Stakeholders

### Primary Stakeholders

| Stakeholder | Role | Needs | Success Criteria |
|-------------|------|-------|------------------|
| **Product Owner** | Business decision maker | High-level project visibility, progress tracking | Dashboard shows accurate task status, metrics are reliable |
| **Tech Lead / Architect** | Technical oversight | Worker health monitoring, bottleneck identification | Real-time worker events, stats endpoint provides actionable data |
| **Auto-Pilot Supervisor** | Orchestrator system | Read-only access to task-tracking data | Service watches files passively, never writes |
| **Dashboard Client Developers** | Frontend implementers | Stable API contract, comprehensive data coverage | REST API returns all needed data, WebSocket events cover all state changes |

### Secondary Stakeholders

| Stakeholder | Role | Needs | Success Criteria |
|-------------|------|-------|------------------|
| **Users (Devs/Users)** | Task consumers | Progress visibility for their assigned tasks | Can query `/api/tasks/:id` to see task status and details |
| **Operations Team** | Deployment/maintenance | Easy deployment, graceful shutdown | CLI command works reliably, signal handling correct |
| **Future Component Maintainers** | Maintainers | Clear architecture, replaceable components | Interface contracts well-defined, modularity enforced |

### Stakeholder Impact Matrix

| Stakeholder | Impact Level | Involvement | Success Criteria |
|------------|--------------|-------------|------------------|
| Product Owner | High | Dashboard usage | Accurate real-time progress visibility |
| Tech Lead | High | Operational monitoring | Worker health metrics enable proactive management |
| Auto-Pilot Supervisor | Medium | Data source | Service is truly passive (no file writes) |
| Dashboard Client Devs | High | API consumption | Stable contract, comprehensive data coverage |
| Operations | Medium | Deployment | Easy CLI integration, graceful shutdown |

---

## Constraints

### Technical Constraints

| Constraint | Description | Rationale |
|------------|-------------|-----------|
| **Passive File Watching** | Service watches but NEVER writes to task-tracking files | Prevents corruption, data integrity managed by orchestrator only |
| **Missing File Grace** | Service handles missing files without crashing | New projects may not have all tracking files yet |
| **Modular/Replaceable Architecture** | Parser, watcher, event bus must be swappable via interfaces | Future-proofing, allows tech stack evolution |
| **In-Memory State Cache** | State maintained in memory (not persisted) | Fast access, orchestrator owns persistence |
| **CLI Integration** | Must integrate with existing CLI via `dashboard` command | Already stubbed in `packages/cli/src/commands/dashboard.ts` |

### Operational Constraints

| Constraint | Description | Rationale |
|------------|-------------|-----------|
| **Single Source of Truth** | Task-tracking MD files are the only source of truth | Avoids synchronization complexity |
| **Auto-Discovery** | Service must find `task-tracking/` relative to working directory | Works from any project root without configuration |
| **Graceful Shutdown** | Must handle SIGINT/SIGTERM cleanly | UX requirement for CLI tools |
| **Port Configuration** | Default port 4200, configurable via `--port` | Avoid conflicts, allow multiple instances |

### Integration Constraints

| Constraint | Description | Rationale |
|------------|-------------|-----------|
| **No Orchestrator Changes** | Data service is external to orchestrator | Keeps orchestrator focused on worker management |
| **Existing CLI Entry Point** | Must build on existing `packages/cli/src/commands/dashboard.ts` | Avoids duplicate work, maintains consistency |
| **Tech Stack** | Use specified stack (Hono, ws, chokidar, gray-matter, mitt) | Proven choices, balance of performance and maintainability |

### Exclusion Scope (What This Task Does NOT Include)

- **Web UI Implementation** — That is TASK_2026_023
- **Persistence Layer** — State cache is in-memory only (orchestrator owns persistence)
- **Authentication/Authorization** — Service runs locally, no auth needed
- **Task Management** — Service only reads, never writes or modifies tasks
- **Worker Management** — Service only observes worker state, does not control workers

---

## Architecture Notes

### Directory Structure

```
packages/dashboard-service/
├── src/
│   ├── index.ts                 # Server bootstrap, CLI integration
│   ├── server/
│   │   ├── http.ts              # Hono HTTP server setup (@hono/node-server)
│   │   └── websocket.ts         # WebSocket server (ws) + client management
│   ├── parsers/                  # MD → JSON parsers (one per file type)
│   │   ├── parser.interface.ts   # Common parser contract
│   │   ├── registry.parser.ts    # registry.md → TaskRecord[]
│   │   ├── plan.parser.ts        # plan.md → phases, milestones, decisions
│   │   ├── state.parser.ts       # orchestrator-state.md → workers, queue, log
│   │   ├── task.parser.ts        # task.md → task definition
│   │   ├── review.parser.ts      # *-review.md → findings with severity
│   │   ├── report.parser.ts      # completion-report.md → summary
│   │   ├── patterns.parser.ts    # anti-patterns.md → rules with categories
│   │   └── lessons.parser.ts     # review-lessons/*.md → domain patterns
│   ├── watcher/
│   │   ├── watcher.interface.ts  # File watcher contract (replaceable)
│   │   └── chokidar.watcher.ts   # chokidar implementation
│   ├── state/
│   │   ├── store.ts              # In-memory state cache
│   │   └── differ.ts             # Diff old vs new state → emit events
│   ├── events/
│   │   ├── event-bus.ts          # Internal pub/sub (EventEmitter or mitt)
│   │   └── event-types.ts        # All event type definitions
│   └── routes/
│       ├── registry.routes.ts    # GET /api/registry
│       ├── plan.routes.ts        # GET /api/plan
│       ├── state.routes.ts       # GET /api/state
│       ├── tasks.routes.ts       # GET /api/tasks/:id, /api/tasks/:id/reviews
│       ├── patterns.routes.ts    # GET /api/anti-patterns
│       ├── lessons.routes.ts     # GET /api/review-lessons
│       └── stats.routes.ts       # GET /api/stats (aggregates)
├── package.json
└── tsconfig.json
```

### Tech Stack

| Component | Choice | Replaceable via |
|-----------|--------|----------------|
| HTTP Server | Hono + @hono/node-server | Swap `server/http.ts` |
| WebSocket | ws (Node-native WebSocket lib) | Swap `server/websocket.ts` |
| File Watcher | chokidar | Implement `watcher.interface.ts` |
| MD Parser | gray-matter + unified/remark | Implement `parser.interface.ts` |
| Event Bus | mitt | Implement `event-bus.ts` |
| State Cache | Plain TypeScript Map/objects | Swap `state/store.ts` |

### Event Flow

```
1. File change detected by watcher (chokidar)
2. Watcher calls appropriate parser based on file path
3. Parser returns structured JSON
4. State store diffs old vs new → produces list of DashboardEvents
5. Events emitted on internal event bus
6. WebSocket server broadcasts events to all connected clients
```

---

## Dependencies

### Internal Dependencies

- **CLI Package** (`packages/cli/`) — Integration point for `dashboard` command
- **Task Tracking Directory** (`task-tracking/`) — Data source, watched passively

### External Dependencies

- **Session Orchestrator MCP Server** — Not required for this task (read-only)
- **No Orchestrator Changes** — Service is completely external to orchestrator

### Task Dependencies

- **None** — This task can be built independently of TASK_2026_019, 020, 021
- **Downstream** — TASK_2026_023 (Web UI) depends on this service

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| File watcher misses rapid changes | Low | Medium | Use chokidar with appropriate options, add debounce |
| State cache drift from files | Low | High | Re-read files on startup, validate diff accuracy |
| WebSocket connection limits | Medium | Medium | Use connection pooling, document limits |
| Parsing errors on malformed MD | Medium | Medium | Add error handling, return partial data with warnings |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API contract changes break clients | Low | High | Version API from v1, document deprecation policy |
| Performance degradation with many files | Medium | Medium | Profile with realistic data, optimize hot paths |
| Tech stack lock-in | Low | Medium | Interface-based design allows swapping |

---

## Next Steps

This context document provides the foundation for implementation. The next phase should produce:

1. **Implementation Plan** — Detailed architecture, component breakdown, task breakdown
2. **Phase Plans** — Iterative implementation phases with clear milestones
3. **Code Structure** — File-by-file implementation plan with interface definitions

**For Implementation Team**: The CLI command stub already exists at `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/dashboard.ts`. Build the `packages/dashboard-service` package to satisfy this integration point.
