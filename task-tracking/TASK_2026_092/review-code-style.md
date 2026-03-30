# Code Style Review — TASK_2026_092

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Scope:** Angular ↔ NestJS integration + CLI build pipeline update

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 7 |
| Moderate | 5 |
| Minor | 3 |
| **Total** | **15** |

---

## Critical Issues

### C1 — Component exceeds 150-line limit
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts`
**Lines:** 1–168 (168 lines)
**Rule:** Components: max 150 lines.

The component class body is 168 lines. The overrun is caused by a large block of module-scope constants (STRATEGY_CARDS, WORKFLOW_STEPS, AGENT_ROLES, COST_RANGES, KEYWORD_STRATEGY_MAP) spanning lines 16–65 that live in the same file as the component class. Moving these to a `new-task.constants.ts` file would bring the component well under the limit.

---

### C2 — `as` type assertion in adapter
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.adapters.ts`
**Line:** 22
**Rule:** No `as` type assertions — if the type system fights you, the type is wrong.

```ts
// Violation:
type: r.type === 'REFACTORING' ? 'REFACTOR' : (r.type as Task['type']),
```

The `as Task['type']` assertion bypasses the type system. The root cause is that `TaskRecord['type']` and `Task['type']` are misaligned (`'REFACTORING'` vs `'REFACTOR'`). The adapter should use an exhaustive mapping rather than asserting.

---

### C3 — Missing `public` access modifier on `events$`
**File:** `apps/dashboard/src/app/services/websocket.service.ts`
**Line:** 13
**Rule:** Explicit access modifiers on ALL class members — never bare.

```ts
// Violation — bare declaration:
readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();

// Required:
public readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();
```

All other members in the class carry explicit modifiers (`private readonly`). `events$` is the lone exception.

---

### C4 — Interfaces defined inside a component file
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.ts`
**Lines:** 19–28
**Rule:** One interface/type per file — don't define models inside component files.

`QuickAction` (lines 19–23) and `TeamGroup` (lines 24–27) are both defined inside the component file. These belong in `models/dashboard.model.ts` or their own files under `models/`.

---

### C5 — Anonymous inline types for class properties
**File:** `apps/dashboard/src/app/views/analytics/analytics.component.ts`
**Lines:** 51–71
**Rule:** One interface/type per file — don't define models inside component files.

Four public fields use complex anonymous array element types defined inline within the component:

```ts
public dailyCostBars: Array<{
  day: number; amount: number; heightPercent: number; colorClass: string;
}> = [];

public teamCardsView: Array<{
  name: string; cost: number; tasks: number; agents: number;
  avgCost: number; budgetUsed: number; budgetTotal: number;
  budgetPercent: number; budgetClass: string; avgCostFormatted: string;
}> = [];
// ... (agentRows, clientBars follow same pattern)
```

Each shape should be a named interface in `analytics.model.ts`.

---

### C6 — `AgentMetadata` interface defined inside store file
**File:** `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts`
**Lines:** 13–23
**Rule:** One interface/type per file — don't define models inside store files.

`AgentMetadata` is defined at the top of the store file. It belongs in `models/agent-editor.model.ts` alongside the existing agent-editor models.

---

### C7 — `socket.io-client` placed in `devDependencies`
**File:** `package.json`
**Line:** 19
**Rule:** Runtime dependencies belong in `dependencies`, not `devDependencies`.

```json
"devDependencies": {
  "@types/socket.io-client": "^3.0.0",
  "socket.io-client": "^4.8.1"   // ← wrong section
}
```

`socket.io-client` is imported in `websocket.service.ts` — production Angular source. It is bundled into the browser output and must be in `dependencies`. The `@types/socket.io-client` type package correctly belongs in `devDependencies`.

---

## Moderate Issues

### M1 — Duplicated inline anonymous type for `getHealth()` return
**File:** `apps/dashboard/src/app/services/api.service.ts`
**Lines:** 30–33

```ts
public getHealth(): Observable<{ status: string; service: string; timestamp: string }> {
  return this.http.get<{ status: string; service: string; timestamp: string }>(…);
}
```

The same anonymous shape is written twice. Should be a named `HealthResponse` interface (either in this file or in `dashboard.types`).

---

### M2 — Underscore prefix on private methods
**Files:**
- `apps/dashboard/src/app/views/analytics/analytics.component.ts:82` — `_recomputeDerived()`
- `apps/dashboard/src/app/layout/status-bar/status-bar.component.ts:39` — `_buildIndicators()`

The `_` prefix is a legacy JS convention for simulating private visibility. With the `private` keyword present, the prefix is redundant and inconsistent. Correct names: `recomputeDerived()`, `buildIndicators()`.

---

### M3 — `console.log` left in production handlers
**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts`
**Lines:** 161, 166

```ts
public onSaveDraft(): void {
  console.log('Save draft', { title: this.title, … });
}
public onStartTask(): void {
  console.log('Start task', { title: this.title, … });
}
```

Debug `console.log` should not appear in committed production code. Stub methods may have an empty body with a comment, but not debug output.

---

### M4 — Repeated identical comments on consecutive fields
**File:** `apps/dashboard/src/app/views/analytics/analytics.component.ts`
**Lines:** 40–47

The comment `// Filter state — visual toggle only; data filtering requires real data integration` is repeated verbatim four times, once before each of the four `selectedXxx` fields. A single block comment above the group is sufficient.

---

### M5 — `FIXING` status absent from the project canonical state set
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.adapters.ts`
**Line:** 9
**Rule:** String literal unions for status/type fields — use the canonical set.

```ts
export const ACTIVE_STATUSES = [
  'IN_PROGRESS', 'CREATED', 'IMPLEMENTED', 'IN_REVIEW',
  'FIXING',     // ← not in CLAUDE.md canonical list
] as const;
```

The project-canonical states (CLAUDE.md) are: `CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED`. `FIXING` is not defined. If it is a valid extension, add it to the canonical list; otherwise remove it.

---

## Minor Issues

### N1 — Falsy check against intentionally empty string
**File:** `apps/dashboard/src/app/services/websocket.service.ts`
**Line:** 16
**Rule:** Falsy checks skip zero values — prefer explicit checks at system boundaries.

```ts
// Current:
const wsUrl = environment.wsUrl || window.location.origin;

// Preferred (explicit intent):
const wsUrl = environment.wsUrl !== '' ? environment.wsUrl : window.location.origin;
```

`environment.prod.ts` sets `wsUrl: ''` as the trigger for this fallback. The `||` form also triggers on `null`/`undefined`/`0`; the explicit empty-string check documents the intent precisely.

---

### N2 — `sidebar.component.ts` and `mcp-integrations.component.ts` still import `MOCK_` constants
**Files:**
- `apps/dashboard/src/app/layout/sidebar/sidebar.component.ts:4`
- `apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts:3–7`

Both files are marked in the task as "MODIFIED — inlined constants" but still import from `mock-data.constants` under the `MOCK_` prefix. If inlining means direct import rather than service injection, the constants should be renamed to drop the `MOCK_` prefix (e.g., `SIDEBAR_SECTIONS`, `MCP_SERVERS`). The `MOCK_` prefix signals temporary/test data and is misleading for constants that serve as the intended static data source.

---

### N3 — `readonly never[]` type on `activity` field
**File:** `apps/dashboard/src/app/views/dashboard/dashboard.component.ts`
**Line:** 95

```ts
public readonly activity: readonly never[] = [];
```

`never[]` means the array can logically never contain a value. This is a type-system dead end — any future assignment will fail. Should be typed with the actual domain type (or `readonly unknown[]` with a TODO) until the real type is wired.

---

## Files With No Issues

| File | Notes |
|------|-------|
| `apps/dashboard/src/environments/environment.ts` | Clean |
| `apps/dashboard/src/environments/environment.prod.ts` | Clean |
| `apps/dashboard/src/app/app.config.ts` | Clean |
| `apps/dashboard/project.json` | Clean |
| `apps/cli/package.json` | Script path correctly updated |
| `apps/dashboard/src/app/views/analytics/analytics.adapters.ts` | Clean |
| `apps/dashboard/src/app/views/models/model-assignments.component.ts` | Clean |
| `apps/dashboard/src/app/views/providers/provider-hub.component.ts` | Clean |

---

## Issue Index

| ID | File | Line | Severity | Rule |
|----|------|------|----------|------|
| C1 | new-task.component.ts | 1–168 | Critical | Component max 150 lines |
| C2 | dashboard.adapters.ts | 22 | Critical | No `as` assertions |
| C3 | websocket.service.ts | 13 | Critical | Explicit access modifiers |
| C4 | dashboard.component.ts | 19–28 | Critical | No inline interfaces |
| C5 | analytics.component.ts | 51–71 | Critical | No inline anonymous types |
| C6 | agent-editor.store.ts | 13–23 | Critical | No inline interfaces |
| C7 | package.json | 19 | Critical | socket.io-client dependency classification |
| M1 | api.service.ts | 30–33 | Moderate | Duplicated anonymous type |
| M2 | analytics.component.ts, status-bar.component.ts | 82, 39 | Moderate | No `_` prefix on private methods |
| M3 | new-task.component.ts | 161, 166 | Moderate | No console.log in production |
| M4 | analytics.component.ts | 40–47 | Moderate | Repeated identical comments |
| M5 | dashboard.adapters.ts | 9 | Moderate | Canonical status set |
| N1 | websocket.service.ts | 16 | Minor | Explicit empty-string check |
| N2 | sidebar.component.ts, mcp-integrations.component.ts | 4, 3–7 | Minor | MOCK_ prefix on static constants |
| N3 | dashboard.component.ts | 95 | Minor | `never[]` typing |
