# Task: Dashboard Data Service

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | FEATURE    |
| Priority   | P1-High    |
| Complexity | Complex    |

## Description

Build the Data Service layer — a persistent local server that is the ONLY component that touches task-tracking MD files. It watches for file changes, parses markdown into structured JSON, maintains an in-memory state cache, and broadcasts changes to connected clients via WebSocket events and a REST API.

This is the foundation that all dashboard clients (web, desktop, TUI, mobile) will build on. The service must be designed so that any component can be replaced independently — swap Elysia for Hono, chokidar for fs.watch, gray-matter for another parser — without affecting the API contract.

### Architecture

```
packages/dashboard-service/
├── src/
│   ├── index.ts                 # Server bootstrap, CLI integration
│   ├── server/
│   │   ├── http.ts              # Elysia HTTP server setup (with @elysiajs/node adapter)
│   │   └── websocket.ts         # WebSocket server + client management
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

### Key Interfaces (contracts that make layers replaceable)

```typescript
// Parser contract — swap markdown parser without touching routes
interface FileParser<T> {
  canParse(filePath: string): boolean;
  parse(content: string, filePath: string): T;
}

// Watcher contract — swap chokidar without touching parsers
interface FileWatcher {
  watch(directory: string, onChange: (path: string, event: 'add' | 'change' | 'unlink') => void): void;
  close(): void;
}

// Event bus contract — swap EventEmitter without touching watcher or routes
interface DashboardEventBus {
  emit(event: DashboardEvent): void;
  subscribe(handler: (event: DashboardEvent) => void): () => void;
}
```

### Event Flow

```
1. File change detected by watcher (chokidar)
2. Watcher calls appropriate parser based on file path
3. Parser returns structured JSON
4. State store diffs old vs new → produces list of DashboardEvents
5. Events emitted on internal event bus
6. WebSocket server broadcasts events to all connected clients
```

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

### Tech Stack

| Component | Choice | Replaceable via |
|-----------|--------|----------------|
| HTTP Server | Elysia + @elysiajs/node | Swap `server/http.ts` |
| WebSocket | Elysia WebSocket (built-in) | Swap `server/websocket.ts` |
| File Watcher | chokidar | Implement `watcher.interface.ts` |
| MD Parser | gray-matter + unified/remark | Implement `parser.interface.ts` |
| Event Bus | mitt | Implement `event-bus.ts` |
| State Cache | Plain TypeScript Map/objects | Swap `state/store.ts` |

### CLI Integration

Add a `dashboard` command to the existing CLI:

```bash
npx nitro-fueled dashboard           # Start data service + open web UI (when 023 ships)
npx nitro-fueled dashboard --service  # Start data service only (headless, for external clients)
npx nitro-fueled dashboard --port 4200  # Custom port
```

The Supervisor changes **nothing**. The data service is a passive observer — it watches files, never writes them.

## Dependencies

- None (can be built independently of 019-021)

## Acceptance Criteria

- [ ] Data service starts and watches `task-tracking/` directory
- [ ] All MD file types are parsed into structured JSON (registry, plan, state, tasks, reviews, reports, anti-patterns, lessons)
- [ ] REST API returns correct JSON for all endpoints
- [ ] WebSocket broadcasts events when MD files change
- [ ] In-memory state cache updates incrementally (no full re-parse on every change)
- [ ] State differ produces correct event types with old/new values
- [ ] Multiple WebSocket clients can connect simultaneously
- [ ] Service handles missing files gracefully (new project with minimal tracking files)
- [ ] Parser, watcher, and event bus interfaces are defined and implementations are swappable
- [ ] `npx nitro-fueled dashboard --service` starts the headless data service
- [ ] Service auto-discovers `task-tracking/` relative to working directory
- [ ] Graceful shutdown on SIGINT/SIGTERM

## References

- Existing CLI package: `packages/cli/`
- Task tracking structure: `task-tracking/`
- Orchestrator state format: `task-tracking/orchestrator-state.md`
- Registry format: `task-tracking/registry.md`
- Plan format: `task-tracking/plan.md`
