# Task: Dashboard Web Client

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | FEATURE    |
| Priority   | P1-High    |
| Complexity | Complex    |

## Description

Build the first dashboard client — a React + Vite SPA that connects to the Data Service (TASK_2026_022) and provides a full visual interface for the Product Owner to monitor and understand orchestration activity.

The frontend NEVER touches MD files. It connects to the Data Service via REST (initial hydration) + WebSocket (real-time events) and renders everything from clean JSON. This means the same frontend could point to any backend that implements the same API contract.

### Package Structure

```
packages/dashboard-web/
├── src/
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Root layout + router
│   ├── api/
│   │   ├── client.ts             # REST client (fetch wrapper)
│   │   └── socket.ts             # WebSocket client + reconnection
│   ├── store/
│   │   ├── index.ts              # Zustand store root
│   │   ├── registry.store.ts     # Task registry state
│   │   ├── plan.store.ts         # Roadmap state
│   │   ├── workers.store.ts      # Active workers state
│   │   └── events.store.ts       # Event log state
│   ├── hooks/
│   │   ├── useRegistry.ts        # Registry data + subscriptions
│   │   ├── usePlan.ts            # Plan data + subscriptions
│   │   ├── useWorkers.ts         # Live worker data
│   │   ├── useTask.ts            # Single task detail
│   │   └── useStats.ts           # Aggregate stats
│   ├── views/
│   │   ├── TaskBoard.tsx         # Kanban board: CREATED → ... → COMPLETE
│   │   ├── Roadmap.tsx           # Phases, milestones, progress bars
│   │   ├── Workers.tsx           # Live workers: model, provider, health, tokens, elapsed
│   │   ├── TaskDetail.tsx        # Full task: description, plan, batches, reviews, report
│   │   ├── Queue.tsx             # Next actionable tasks, dependency graph
│   │   ├── SessionLog.tsx        # Timestamped event stream
│   │   ├── Reviews.tsx           # Review findings per task with severity
│   │   ├── CostDashboard.tsx     # Cost breakdown, token usage, provider split
│   │   ├── AntiPatterns.tsx      # QA rules with violation frequency
│   │   └── ReviewLessons.tsx     # Learned patterns by domain
│   ├── components/
│   │   ├── Layout.tsx            # Shell: sidebar nav + content area
│   │   ├── Sidebar.tsx           # Navigation between views
│   │   ├── StatusBadge.tsx       # Task state badges with colors
│   │   ├── WorkerCard.tsx        # Single worker status card
│   │   ├── TaskCard.tsx          # Task summary card for board/list
│   │   ├── EventRow.tsx          # Single event in session log
│   │   ├── ReviewFinding.tsx     # Single review finding with severity
│   │   ├── ProgressBar.tsx       # Phase/milestone progress
│   │   └── ConnectionStatus.tsx  # WebSocket connection indicator
│   └── theme/
│       └── tokens.ts             # Design tokens matching landing page aesthetic
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

### Client Protocol (how the frontend talks to the data service)

```typescript
// 1. Initial hydration (on mount)
const registry = await fetch('/api/registry').then(r => r.json());
const plan = await fetch('/api/plan').then(r => r.json());
const state = await fetch('/api/state').then(r => r.json());

// 2. Subscribe to real-time events
const ws = new WebSocket('ws://localhost:<port>/ws');
ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);
  // Apply event to Zustand store (incremental update, no re-fetch)
  switch (event.type) {
    case 'task:state_changed': updateTaskState(event); break;
    case 'worker:spawned': addWorker(event); break;
    case 'worker:completed': completeWorker(event); break;
    // ...
  }
};
```

### Dashboard Views

**Task Board** — Kanban columns: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | BLOCKED | CANCELLED. Cards show task ID, title, type badge, priority, model/provider. Drag not needed — states are controlled by the Supervisor.

**Roadmap** — Phase cards with progress bars (complete/total tasks). Milestone checklist. Decisions log table. Current focus highlight.

**Live Workers** — Cards for each active worker: worker ID, task ID, worker type (Build/Review/Cleanup), model, provider, health status (healthy/stuck/compacting), elapsed time, token count, last action. Updates in real-time via WebSocket.

**Task Detail** — Tabbed view: Definition (task.md) | Requirements (context.md) | Architecture (implementation-plan.md) | Dev Batches (tasks.md) | Reviews (style + logic + security) | Completion Report. Markdown rendered to HTML.

**Queue** — Next actionable tasks sorted by priority. Shows dependency graph (which tasks are blocked by which). Estimated worker type (Build vs Review).

**Session Log** — Scrollable event stream from orchestrator-state.md session log. Color-coded by event type. Auto-scrolls to latest.

**Reviews** — Per-task review summary. Severity breakdown (critical/warning/info). Findings list with file paths and descriptions.

**Cost Dashboard** — Charts: cost by task, cost by model, cost by provider, cumulative cost over time. Token usage: input vs output vs cache. Needs TASK_2026_019 to have real data.

**Anti-Patterns** — Rules list with category grouping. Violation count per rule (derived from review findings).

**Review Lessons** — Domain-grouped learned patterns. Backend, frontend, general sections. Growing knowledge base.

### Visual Design

Match the landing page aesthetic:
- Dark theme: `--bg: #0a0e17`, `--bg-card: #111827`
- Accent: `--accent: #f97316` (orange)
- State colors: blue (CREATED), yellow (IN_PROGRESS), purple (IMPLEMENTED), cyan (IN_REVIEW), green (COMPLETE), red (BLOCKED)
- Monospace for code/file paths: SF Mono, Fira Code
- Cards with `border-radius: 12px`, subtle borders, hover lift

### Build & Serve

The frontend builds to static files via Vite. The Data Service (Elysia) serves them:
- `vite build` → `packages/dashboard-web/dist/`
- Data Service serves `dist/` as static files at the root via Elysia static plugin
- In dev: `vite dev` proxy to data service API

Production bundle ships inside the CLI package so `npx nitro-fueled dashboard` works without any additional install.

## Dependencies

- TASK_2026_022 — Dashboard Data Service (provides the REST API + WebSocket events)

## Acceptance Criteria

- [ ] React + Vite SPA builds to static files
- [ ] Connects to Data Service REST API for initial hydration
- [ ] Connects to Data Service WebSocket for real-time events
- [ ] Zustand store updates incrementally from WebSocket events (no re-fetching)
- [ ] Task Board view shows all tasks in correct state columns
- [ ] Roadmap view shows phases with progress bars and decisions log
- [ ] Live Workers view updates in real-time (spawn, progress, completion)
- [ ] Task Detail view renders all artifacts (definition, plan, reviews, report)
- [ ] Session Log view shows timestamped events with auto-scroll
- [ ] Cost Dashboard shows charts for cost/tokens (gracefully handles zero data)
- [ ] WebSocket reconnection on disconnect with visual indicator
- [ ] Responsive layout (works on laptop and large monitor)
- [ ] Visual design matches landing page dark theme and color system
- [ ] Production build is servable as static files by the Data Service
- [ ] `npx nitro-fueled dashboard` opens the browser to the web UI

## References

- Data Service API: TASK_2026_022
- Landing page design tokens: `docs/nitro-fueled-overview.css`
- State colors and conventions: `docs/index.html` (state machine section)
- Existing CLI: `packages/cli/`
