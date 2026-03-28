# Code Logic Review — TASK_2026_077

**Reviewer:** nitro-code-logic-reviewer
**Date:** 2026-03-28
**Status:** PASS WITH OBSERVATIONS

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0 |
| Serious  | 1 |
| Minor    | 4 |
| Observations | 2 |

## Findings

### SERIOUS

#### 1. Dual Active State Mechanism in Sidebar (sidebar.component.html:11-14)

**Location:** `apps/dashboard/src/app/layout/sidebar/sidebar.component.html:11-14`

```html
<a class="sidebar-item"
   [routerLink]="item.route"
   routerLinkActive="active"
   [ngClass]="{ 'active': item.isActive }">
```

**Issue:** The sidebar has two independent mechanisms for styling items as active:
1. `routerLinkActive="active"` — Angular Router applies `active` class when route matches
2. `[ngClass]="{ 'active': item.isActive }"` — Hardcoded `isActive: true` in mock data

**Business Logic Error:** When user navigates to a route other than `/dashboard`, the "e-commerce-api" project will remain visually active (due to `isActive: true` in `MOCK_SIDEBAR_SECTIONS`) while another sidebar item (e.g., Agents) will also appear active via `routerLinkActive`. This creates:
- Confusing UX with multiple active-looking items
- Incorrect visual state that doesn't reflect actual navigation

**Evidence:** In `mock-data.constants.ts:173`:
```typescript
{ label: 'e-commerce-api', dotStatus: 'active', badge: 2, isActive: true, route: '/dashboard' },
```

The `isActive` property is hardcoded and never changes, while `routerLinkActive` is dynamic.

**Recommendation:** Remove `[ngClass]="{ 'active': item.isActive }"` and rely solely on `routerLinkActive`, OR use `isActive` only for initial/default state and let router take over.

---

### MINOR

#### 2. Budget Data Duplication with Semantic Confusion (mock-data.service.ts:62-64)

**Location:** `apps/dashboard/src/app/services/mock-data.service.ts:62-64`

```typescript
public getMonthlyBudget(): { readonly used: number; readonly total: number } {
  return { used: 47.30, total: 100 };
}
```

**Issue:** This returns hardcoded values that partially duplicate `MOCK_ANALYTICS`:
- `MOCK_ANALYTICS.budgetUsed: 47` (percentage value, no decimals)
- `MOCK_ANALYTICS.budgetTotal: 100` (percentage scale)
- `getMonthlyBudget().used: 47.30` (dollar amount with decimals)

The `budgetUsed: 47` appears to be percentage while `used: 47.30` is dollars. This creates semantic confusion about what "budget" means in each context. When real data replaces mocks, this inconsistency could lead to bugs.

**Recommendation:** Either derive `getMonthlyBudget()` from `MOCK_ANALYTICS.totalCost` (which is also 47.30), or add clear documentation distinguishing percentage-based budget tracking from dollar amounts.

---

#### 3. Session Model File Name Mismatch (session.model.ts)

**Location:** `apps/dashboard/src/app/models/session.model.ts`

```typescript
export interface ActivityEntry {
  readonly timeAgo: string;
  readonly text: string;
  readonly actorBold: string;
}
```

**Issue:** The file is named `session.model.ts` but contains an `ActivityEntry` interface. This creates confusion:
- A developer looking for "session" types won't find session-related data
- A developer looking for "activity" types won't check `session.model.ts`

**Recommendation:** Rename to `activity-entry.model.ts` or add a `Session` interface to justify the filename.

---

#### 4. Mixed AI Provider Models in AgentModel Type (agent.model.ts:1)

**Location:** `apps/dashboard/src/app/models/agent.model.ts:1`

```typescript
export type AgentModel = 'opus' | 'sonnet' | 'codex';
```

**Issue:** The type mixes Claude models (`opus`, `sonnet`) with an OpenAI model (`codex`). While this might be intentional for a multi-provider system, the naming suggests these are interchangeable when they require different API integrations.

**Evidence:** In `mock-data.constants.ts:130`:
```typescript
{ name: 'BE Dev', model: 'codex', team: 'Engineering', installed: true },
```

**Recommendation:** Either:
- Add provider discrimination: `type AgentModel = { provider: 'anthropic' | 'openai'; model: string }`
- Document that this is intentional multi-provider support
- Or standardize on a single provider's naming convention

---

#### 5. Incomplete Activity Log Entry Text (mock-data.constants.ts:142)

**Location:** `apps/dashboard/src/app/services/mock-data.constants.ts:142`

```typescript
{ timeAgo: '1h', actorBold: 'team-leader.md', text: 'External change detected:' },
```

**Issue:** The text ends with a colon, suggesting incomplete content. The `actorBold` value `team-leader.md` appears to be a filename rather than an actor name (compare to other entries: `team-leader`, `code-logic-reviewer`, etc.).

**Recommendation:** Complete the text (e.g., "External change detected: config update") and fix the actor name to `team-leader`.

---

### OBSERVATIONS

#### 6. Multiple Sidebar Items Share Routes

Multiple sidebar items route to the same paths:
- `/dashboard`: e-commerce-api, my-react-app, go-microservice, Clients, Teams, Knowledge Base, Activity Log, Settings
- `/agents`: Agents, Skills, Commands, Prompts, Workflows

This is acceptable for the placeholder phase but should be tracked for future route differentiation.

---

#### 7. Unused Property in AppComponent (app.component.ts:11)

**Location:** `apps/dashboard/src/app/app.component.ts:11`

```typescript
public readonly title = 'dashboard';
```

This property is declared but never used in the template or elsewhere. It appears to be leftover from Angular scaffold generation.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| models/project.model.ts | 11 | OK |
| models/task.model.ts | 27 | OK |
| models/agent.model.ts | 10 | MINOR |
| models/session.model.ts | 6 | MINOR |
| models/analytics-summary.model.ts | 15 | OK |
| models/provider.model.ts | 14 | OK |
| models/sidebar.model.ts | 18 | OK |
| services/mock-data.constants.ts | 216 | MINOR |
| services/mock-data.service.ts | 66 | MINOR |
| layout/layout.component.ts | 44 | OK |
| layout/header/header.component.ts | 84 | OK |
| layout/sidebar/sidebar.component.ts | 26 | OK |
| layout/sidebar/sidebar.component.html | 43 | SERIOUS |
| layout/sidebar/sidebar.component.scss | 119 | OK |
| layout/status-bar/status-bar.component.ts | 20 | OK |
| layout/status-bar/status-bar.component.html | 37 | OK |
| layout/status-bar/status-bar.component.scss | 75 | OK |
| views/placeholder-view.component.ts | 40 | OK |
| app.routes.ts | 22 | OK |
| app.config.ts | 31 | OK |
| app.component.ts | 13 | OK |
| styles.scss | 47 | OK |

## Verdict

**PASS** — The implementation is logically sound for a shell/scaffold phase. The serious finding (dual active state) should be addressed before user testing to prevent navigation confusion. Minor findings are acceptable technical debt for this iteration.
