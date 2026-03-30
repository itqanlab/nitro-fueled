# Code Style Review — TASK_2026_077

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Task:** Angular shell — layout, sidebar, routing, dark theme, mock data service
**Commit:** `d3107bf`

---

## Summary

| Severity | Count |
|----------|-------|
| Serious  | 5     |
| Minor    | 4     |
| Pass     | —     |

Overall: implementation is structurally sound with good TypeScript discipline across most files. The primary violations are the "one type/interface per model file" convention (affects 4 files), a file naming mismatch, and a prohibited type assertion.

---

## Serious Findings

### S1 — Multiple types/interfaces per model file (4 files)

**Convention:** One interface/type per file (model files).

**Affected files:**

**`task.model.ts`** (5 union types + 2 interfaces in a single file)
```
TaskStatus, TaskType, TaskPriority, PipelineStage, PipelineStageStatus
PipelineStep, Task
```
Each union type and each interface should live in its own file:
- `task-status.type.ts`, `task-type.type.ts`, `task-priority.type.ts`, `pipeline-stage.type.ts`, `pipeline-stage-status.type.ts`, `pipeline-step.model.ts`, `task.model.ts`

**`agent.model.ts`** (2 union types + 1 interface in a single file)
```
AgentModel, AgentTeam, Agent
```

**`provider.model.ts`** (1 union type + 2 interfaces in a single file)
```
ProviderStatusType, StatusIndicator, Provider
```
`StatusIndicator` and `Provider` are separate domain concepts and should be in separate files.

**`sidebar.model.ts`** (1 union type + 2 interfaces in a single file)
```
SidebarItemType, SidebarSection, SidebarItem
```

---

### S2 — File naming mismatch: `session.model.ts` / `ActivityEntry`

**File:** `apps/dashboard/src/app/models/session.model.ts`

The file is named `session.model.ts` but exports `ActivityEntry` — a completely different domain concept. Nothing in the file relates to sessions.

**Convention:** File names must match the exported type (kebab-case).

The file should be renamed to `activity-entry.model.ts` and all import paths updated accordingly.

---

### S3 — Prohibited type assertion (`as` cast)

**File:** `apps/dashboard/src/app/views/placeholder-view.component.ts:37`

```typescript
map((data) => (data['title'] as string) ?? 'Coming Soon'),
```

**Convention:** No `as` type assertions.

Angular's `ActivatedRouteSnapshot.data` is typed as `Data = { [key: string]: any }`, so `data['title']` returns `any`. The `as string` cast silences the implicit `any` without actually narrowing the type safely.

---

### S4 — Hardcoded magic values in service (pattern inconsistency)

**File:** `apps/dashboard/src/app/services/mock-data.service.ts:54–64`

```typescript
public getMcpConnectionCount(): number {
  return 5;
}

public getAutoRunEnabled(): boolean {
  return false;
}

public getMonthlyBudget(): { readonly used: number; readonly total: number } {
  return { used: 47.30, total: 100 };
}
```

All other methods delegate to named constants in `mock-data.constants.ts`. These three methods embed values inline, breaking the established pattern. The values should be exported constants from `mock-data.constants.ts` (e.g., `MOCK_MCP_COUNT`, `MOCK_AUTO_RUN_ENABLED`, `MOCK_MONTHLY_BUDGET`).

---

### S5 — `mock-data.constants.ts` exceeds file size limit and violates single responsibility

**File:** `apps/dashboard/src/app/services/mock-data.constants.ts` (215 lines)

**Convention:** Service/constants files: max 200 lines. Single responsibility.

The file contains 8 unrelated data domains:
`MOCK_PROJECTS`, `MOCK_ACTIVE_TASKS`, `MOCK_COMPLETED_TASKS`, `MOCK_AGENTS`, `MOCK_ACTIVITY`, `MOCK_ANALYTICS`, `MOCK_STATUS_INDICATORS`, `MOCK_SIDEBAR_SECTIONS`

These should be split into domain-specific constants files (e.g., `mock-projects.constants.ts`, `mock-tasks.constants.ts`, etc.) or at minimum grouped into 2–3 files by domain affinity.

---

## Minor Findings

### M1 — Missing explicit type annotation on `budget` property

**File:** `apps/dashboard/src/app/layout/status-bar/status-bar.component.ts:18`

```typescript
public readonly budget = this.mockData.getMonthlyBudget();
```

**Convention:** Explicit access modifiers on ALL class members (access modifier is present, but the type is inferred rather than declared). All other component properties in this file carry explicit type annotations. For consistency the type should be declared:

```typescript
public readonly budget: { readonly used: number; readonly total: number } = this.mockData.getMonthlyBudget();
```

---

### M2 — Hardcoded color literals in inline styles instead of CSS variables

**File:** `apps/dashboard/src/app/layout/header/header.component.ts:35, 78–79`

```scss
border-bottom: 1px solid #303030;   // should use var(--border)
background: #303030;                  // should use var(--bg-hover)
```

`#303030` is defined as both `--border` and `--bg-hover` in `styles.scss`. Using raw hex values bypasses the design token system and creates inconsistency risk if the theme changes.

---

### M3 — Inline styles length exceeds soft limit

**File:** `apps/dashboard/src/app/layout/header/header.component.ts` (inline styles: 55 lines)

**Convention (from review-context):** Inline styles are a smell when they exceed ~30 lines.

The header's inline styles block is 55 lines. At this length, the styles should be extracted to `header.component.scss`.

---

### M4 — Unused class property

**File:** `apps/dashboard/src/app/app.component.ts:11`

```typescript
public readonly title = 'dashboard';
```

The `AppComponent` template is `<router-outlet />` — it renders no content from the component class. `title` is never referenced in the template or elsewhere. This is dead code.

---

## Files with No Issues

- `apps/dashboard/src/app/models/project.model.ts` — clean
- `apps/dashboard/src/app/models/analytics-summary.model.ts` — clean
- `apps/dashboard/src/app/layout/layout.component.ts` — clean
- `apps/dashboard/src/app/layout/sidebar/sidebar.component.ts` — clean
- `apps/dashboard/src/app/layout/sidebar/sidebar.component.html` — clean
- `apps/dashboard/src/app/layout/sidebar/sidebar.component.scss` — clean
- `apps/dashboard/src/app/layout/status-bar/status-bar.component.html` — clean
- `apps/dashboard/src/app/layout/status-bar/status-bar.component.scss` — clean
- `apps/dashboard/src/app/app.routes.ts` — clean
- `apps/dashboard/src/app/app.config.ts` — clean
- `apps/dashboard/src/styles.scss` — clean
