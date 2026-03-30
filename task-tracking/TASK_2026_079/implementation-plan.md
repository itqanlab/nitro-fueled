# Implementation Plan - TASK_2026_079: Analytics & Insights View

## Codebase Investigation Summary

### Libraries Discovered
- **Angular 19** standalone components with `inject()` DI pattern
- **No chart library** -- mockup uses pure CSS for all charts (horizontal bars, vertical bar charts)
- **MockDataService** (`apps/dashboard/src/app/services/mock-data.service.ts`) -- central data provider
- **StatCardComponent** (`apps/dashboard/src/app/shared/stat-card/stat-card.component.ts`) -- existing shared stat card

### Patterns Identified
- **Component structure**: standalone components with `templateUrl` + `styleUrl` for multi-file, or inline `template`/`styles` for single-file
- **Evidence**: `dashboard.component.ts:18-24` uses external template/style files; `stat-card.component.ts` uses inline
- **Data access**: Components inject `MockDataService`, assign readonly properties from service methods
- **Evidence**: `dashboard.component.ts:27-33`
- **CSS Variables**: Components use `--bg-primary`, `--bg-secondary`, `--border`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--success`, `--warning`, `--error`, etc.
- **Evidence**: `dashboard.component.scss` and `stat-card.component.ts` throughout
- **Note**: `--text-tertiary`, `--success`, `--warning`, `--error`, `--running`, `--completed`, `--success-bg`, `--warning-bg`, `--error-bg` are used by existing components but not defined in `styles.scss`. They are defined in the mockup's `:root`. The developer must add these missing variables to `styles.scss`.

### Integration Points
- **Route**: `app.routes.ts:13` -- replace `PlaceholderViewComponent` with `AnalyticsComponent` for `/analytics`
- **MockDataService**: Add new methods for analytics-specific data
- **Models**: Extend `analytics-summary.model.ts` with new interfaces

---

## Architecture Design

### Design Philosophy
**Chosen Approach**: Single parent component (`AnalyticsComponent`) with all sections inline, matching the dashboard component pattern. No sub-components for charts -- the mockup uses simple CSS-only charts that don't warrant separate components.

**Rationale**: The dashboard view (`dashboard.component.ts`) is the reference implementation. It uses a single component with external HTML/SCSS files and directly injects `MockDataService`. The analytics view follows the same pattern. CSS-only charts (horizontal bars, vertical bar charts) are simple div-based layouts that stay cleanly in one template.

**Evidence**: `dashboard.component.ts:18-24` -- standalone component, external template, inject MockDataService.

### Why NOT Sub-Components for Charts
The mockup's "charts" are simple CSS `div` bars with `width` or `height` percentages. They are 5-15 lines of HTML each. Extracting them into separate components would add file overhead without meaningful reuse or encapsulation benefit. If charts grow complex later, they can be extracted.

---

## Component Specifications

### Component 1: AnalyticsComponent (Parent View)

**Purpose**: Full-page analytics view replacing the placeholder at `/analytics`.
**Pattern**: Standalone component with external template + stylesheet (matches `DashboardComponent`).
**Evidence**: `dashboard.component.ts:18-24`

**Responsibilities**:
- Inject `MockDataService` and retrieve all analytics data
- Manage filter state (selected period, client, team, project) as local component state
- Render all 7 UI sections described below
- Compute derived values (percentages, bar heights, budget ratios)

**Sections in Template**:

1. **Page Header** -- Title "Analytics & Insights", subtitle, Export + Schedule Report buttons
2. **Filter Bar** -- Period button group (7d/30d/This month/Custom), 3 dropdown selects (Client, Team, Project)
3. **Summary Stat Cards** (5) -- Total Cost, Tasks Completed, Tokens Used, Avg Task Duration, Active Agents; each with trend arrow + percentage
4. **Chart Grid** (2-column) -- Cost by Provider (horizontal bars) + Cost by Client (bars with budget lines)
5. **Agent Performance Table** -- Full-width table with 6 columns, success rate badges
6. **Daily Cost Trend** -- 30-day vertical bar chart with Y-axis, X-axis, dashed budget line
7. **Team Breakdown** (3-column grid) -- 3 team cards with stats + budget progress bars

**Files**:
- `apps/dashboard/src/app/views/analytics/analytics.component.ts` (CREATE)
- `apps/dashboard/src/app/views/analytics/analytics.component.html` (CREATE)
- `apps/dashboard/src/app/views/analytics/analytics.component.scss` (CREATE)

---

## Data Models / Interfaces

### New Interfaces (CREATE: `apps/dashboard/src/app/models/analytics.model.ts`)

The existing `AnalyticsSummary` interface is too basic for the analytics view. Create a new dedicated model file:

```typescript
export type TrendDirection = 'up' | 'down' | 'neutral';

export interface AnalyticsTrend {
  readonly direction: TrendDirection;
  readonly percent: number;
}

export interface AnalyticsStatCard {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;        // e.g., "min" for duration
  readonly trend?: AnalyticsTrend;
  readonly sub: string;
  readonly colorVar: string;     // CSS variable name, e.g., '--warning'
}

export interface ProviderCost {
  readonly name: string;
  readonly percent: number;
  readonly amount: number;
  readonly colorClass: string;   // 'blue' | 'green' | 'orange' | 'gray'
}

export interface ClientCost {
  readonly name: string;
  readonly amount: number;
  readonly budget: number;
  readonly barColorVar: string;  // CSS variable for bar fill
}

export interface AgentPerformance {
  readonly name: string;
  readonly online: boolean;
  readonly tasks: number;
  readonly avgDuration: string;
  readonly tokensPerTask: string;
  readonly costPerTask: number;
  readonly successRate: number;
}

export interface DailyCostEntry {
  readonly day: number;
  readonly amount: number;
}

export interface TeamBreakdown {
  readonly name: string;
  readonly cost: number;
  readonly tasks: number;
  readonly agents: number;
  readonly avgCost: number;
  readonly budgetUsed: number;
  readonly budgetTotal: number;
}

export type FilterPeriod = '7d' | '30d' | 'month' | 'custom';

export interface AnalyticsFilterOptions {
  readonly clients: readonly string[];
  readonly teams: readonly string[];
  readonly projects: readonly string[];
}

export interface AnalyticsData {
  readonly statCards: readonly AnalyticsStatCard[];
  readonly providerCosts: readonly ProviderCost[];
  readonly clientCosts: readonly ClientCost[];
  readonly agentPerformance: readonly AgentPerformance[];
  readonly dailyCosts: readonly DailyCostEntry[];
  readonly dailyBudgetLimit: number;
  readonly teamBreakdowns: readonly TeamBreakdown[];
  readonly filterOptions: AnalyticsFilterOptions;
}
```

**Rationale**: Separate from `AnalyticsSummary` to avoid breaking the dashboard view which depends on the existing interface. The existing `AnalyticsSummary` serves the dashboard's 5 stat cards; `AnalyticsData` serves the full analytics page with 7 distinct sections.

---

## MockDataService Extensions

### New Method (MODIFY: `apps/dashboard/src/app/services/mock-data.service.ts`)

Add one method:
```typescript
public getAnalyticsPageData(): AnalyticsData { return MOCK_ANALYTICS_PAGE_DATA; }
```

### New Mock Data Constant (MODIFY: `apps/dashboard/src/app/services/mock-data.constants.ts`)

Add `MOCK_ANALYTICS_PAGE_DATA` constant matching the mockup values:

- **statCards**: 5 cards with exact values from mockup (Total Cost $847.32 +12%, Tasks 48 +8%, Tokens 2.4M -5%, Avg Duration 4.2min -15%, Active Agents 12)
- **providerCosts**: Anthropic $523.40/62%, OpenAI $198.50/23%, Google $89.42/11%, Local/CLI $36.00/4%
- **clientCosts**: Acme Corp $412.80/$500, TechStart $287.52/$300, Internal $147.00/$300
- **agentPerformance**: 8 agents from mockup table (team-leader 48 tasks 98%, backend-developer 36 95%, frontend-developer 28 92%, software-architect 22 97%, code-logic-reviewer 41 99%, devops-engineer 15 88%, tester 38 94%, researcher 8 75%)
- **dailyCosts**: 30 entries with amounts derived from mockup bar heights (percentage * $50 max)
- **dailyBudgetLimit**: 35
- **teamBreakdowns**: Engineering $520/32 tasks/8 agents/$600 budget, Design $210/12/3/$400, Marketing $117/4/2/$200
- **filterOptions**: clients: ['All Clients', 'Acme Corp', 'TechStart', 'Internal'], teams: ['All Teams', 'Engineering', 'Design', 'Marketing'], projects: ['All Projects', 'e-commerce-api', 'my-react-app', 'go-microservice']

---

## CSS Chart Implementation Approach

All charts are **pure CSS** -- no Canvas, SVG, or external chart libraries.

### Cost by Provider (Horizontal Bar Chart)
- Each row: `flex` container with label (80px fixed), track (flex:1, bg-primary), fill (percentage width, colored), value (80px fixed)
- Fill uses `width: X%` with color classes (blue/green/orange/gray)
- **Evidence**: Mockup lines 468-520 define exact CSS

### Cost by Client (Bar Chart with Budget Lines)
- Each client: header row (name + amount), track bar (relative positioned), fill bar (percentage width), budget line (absolute positioned vertical line at 100% or calculated position)
- Budget line uses `position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--warning)`
- **Evidence**: Mockup lines 522-582

### Daily Cost Trend (Vertical Bar Chart)
- Container: `position: relative; height: 200px; padding: 0 0 24px 40px`
- Y-axis: absolute positioned left column with labels ($0-$50)
- Bar area: `flex` container with `align-items: flex-end; gap: 3px`, each bar `flex:1` with `height: X%`
- Budget line: absolute horizontal dashed line at 70% from bottom ($35/$50)
- X-axis: absolute positioned bottom row with day labels (1, 5, 10, 15, 20, 25, 30)
- Bars exceeding budget get `background: var(--warning)` instead of `var(--accent)`
- **Evidence**: Mockup lines 675-755

### Team Budget Progress Bars
- Track: `height: 6px; background: var(--bg-primary); border-radius: 3px`
- Fill: percentage width with color class (normal=accent, warn=warning, danger=error)
- **Evidence**: Mockup lines 812-839

---

## CSS Variables Gap

The following CSS variables are used by existing components and the mockup but are **not defined** in `apps/dashboard/src/styles.scss`:

| Variable | Mockup Value | Global `styles.scss` Equivalent |
|---|---|---|
| `--text-tertiary` | `#595959` | `--text-muted: #595959` (same value, different name) |
| `--success` | `#49aa19` | `--status-success: #49aa19` |
| `--success-bg` | `#162312` | not defined |
| `--warning` | `#d89614` | `--status-warning: #d89614` |
| `--warning-bg` | `#2b2111` | not defined |
| `--error` | `#d32029` | `--status-error: #d32029` |
| `--error-bg` | `#2a1215` | not defined |
| `--running` | `#177ddc` | not defined |
| `--completed` | `#49aa19` | not defined |
| `--info` | `#177ddc` | not defined |
| `--paused` | `#d89614` | not defined |
| `--failed` | `#d32029` | not defined |

**Action**: Add these missing variables to `styles.scss` `:root` block. This fixes the gap for existing components too.

**File**: `apps/dashboard/src/styles.scss` (MODIFY)

---

## Route Update

**File**: `apps/dashboard/src/app/app.routes.ts` (MODIFY)

Replace line 13:
```typescript
// FROM:
{ path: 'analytics', component: PlaceholderViewComponent, data: { title: 'Analytics' } },
// TO:
{ path: 'analytics', component: AnalyticsComponent },
```

Add import:
```typescript
import { AnalyticsComponent } from './views/analytics/analytics.component';
```

---

## File Structure Summary

```
apps/dashboard/src/
  styles.scss                                    (MODIFY - add missing CSS variables)
  app/
    app.routes.ts                                (MODIFY - swap placeholder for AnalyticsComponent)
    models/
      analytics.model.ts                         (CREATE - new interfaces)
    services/
      mock-data.service.ts                       (MODIFY - add getAnalyticsPageData())
      mock-data.constants.ts                     (MODIFY - add MOCK_ANALYTICS_PAGE_DATA)
    views/
      analytics/
        analytics.component.ts                   (CREATE - component class)
        analytics.component.html                 (CREATE - template with 7 sections)
        analytics.component.scss                 (CREATE - all styles for analytics view)
```

---

## Quality Requirements

### Functional
- All 7 UI sections render matching the mockup layout and data values
- Filter bar period buttons toggle active state (local state, no data filtering needed -- mock data is static)
- Agent table rows show correct online/offline dot colors
- Success rate badges are color-coded: >= 90% green (high), >= 80% yellow (medium), < 80% red (low)
- Daily cost bars exceeding the $35 budget line show in warning color
- Team budget progress bars use color classes: < 70% normal (accent), 70-90% warn (warning), > 90% danger (error)

### Non-Functional
- Pure CSS charts -- zero external chart dependencies
- All styles scoped to component (Angular ViewEncapsulation default)
- Readonly data properties -- no mutation
- No `any` types

### Accessibility
- All `<select>` elements have `aria-label` attributes (matching mockup)
- Table uses semantic `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`
- Filter buttons use `<button>` elements (not divs)
- Color indicators accompanied by text (success rate shows percentage number alongside color badge)

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-frontend-developer
**Rationale**: This is a pure Angular frontend task -- new component, template, styles, mock data. No backend, no IPC, no API changes.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 3-4 hours

### Files Affected Summary

**CREATE**:
- `apps/dashboard/src/app/models/analytics.model.ts`
- `apps/dashboard/src/app/views/analytics/analytics.component.ts`
- `apps/dashboard/src/app/views/analytics/analytics.component.html`
- `apps/dashboard/src/app/views/analytics/analytics.component.scss`

**MODIFY**:
- `apps/dashboard/src/styles.scss` (add missing CSS variables)
- `apps/dashboard/src/app/app.routes.ts` (swap placeholder route)
- `apps/dashboard/src/app/services/mock-data.service.ts` (add getAnalyticsPageData method)
- `apps/dashboard/src/app/services/mock-data.constants.ts` (add MOCK_ANALYTICS_PAGE_DATA constant)

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase (DashboardComponent reference)
- [x] All imports/classes verified as existing (MockDataService, StatCardComponent)
- [x] Quality requirements defined (functional, non-functional, accessibility)
- [x] Integration points documented (route, service, models)
- [x] Files affected list complete (4 create, 4 modify)
- [x] Developer type recommended (nitro-frontend-developer)
- [x] Complexity assessed (MEDIUM, 3-4 hours)
- [x] No step-by-step implementation (that's nitro-team-leader's job)
- [x] Pure CSS charts -- no external dependencies
- [x] CSS variable gap identified and remediation planned
