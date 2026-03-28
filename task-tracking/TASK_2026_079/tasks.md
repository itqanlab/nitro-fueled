# Development Tasks - TASK_2026_079

**Total Tasks**: 8 | **Batches**: 1 | **Status**: 1/1 COMPLETE

---

## Plan Validation Summary

**Validation Status**: PASSED

### Path Validation

- context.md referenced `apps/renderer/src/app/features/analytics/` — this is stale (old app). The correct path `apps/dashboard/src/app/views/analytics/` is confirmed real via `app.routes.ts` and `apps/dashboard/` directory.
- `app.routes.ts:14` — placeholder route exists exactly as plan describes, ready for swap.
- `mock-data.service.ts` — follows exact pattern shown in plan (inject-based, readonly returns). No existing `getAnalyticsPageData` method, safe to add.
- `styles.scss` — missing variables confirmed: `--text-tertiary`, `--success`, `--warning`, `--error`, `--success-bg`, `--warning-bg`, `--error-bg`, `--running`, `--completed`, `--info`, `--paused`, `--failed` are absent. Plan remediation is correct.
- `mock-data.constants.ts` — imports and export pattern confirmed, safe to extend.

### Assumptions Verified

- Dashboard app lives at `apps/dashboard/` not `apps/renderer/`: VERIFIED
- Angular 19 standalone component with inject() DI: VERIFIED (dashboard.component.ts:26)
- External template + styleUrl pattern: VERIFIED (dashboard.component.ts:22-23)
- MockDataService uses simple readonly return pattern: VERIFIED (mock-data.service.ts:26-81)
- No chart library in use: VERIFIED (no ngx-charts or chart.js imports found)
- `PlaceholderViewComponent` route for analytics at line 14: VERIFIED (app.routes.ts:14)

### Risks Identified

| Risk | Severity | Mitigation |
|---|---|---|
| `PlaceholderViewComponent` import may become unused after route swap — build warning | LOW | Remove unused import in app.routes.ts only if no other routes still reference it; 3 other routes use it so leave it |
| `mock-data.constants.ts` already imports from `analytics-summary.model` — new model file must not conflict | LOW | New `analytics.model.ts` uses different export names; no conflict |

---

## Batch 1: Analytics & Insights View COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 8 | **Dependencies**: None (all files independent except component depends on model + service)
**Commit**: 51a4b60

**Internal task order**:
1. Model file first (Task 1.1) — no dependencies
2. CSS variables (Task 1.2) — no dependencies
3. Mock data constant (Task 1.3) — depends on model (Task 1.1)
4. Service method (Task 1.4) — depends on model (Task 1.1) and constant (Task 1.3)
5. Component TS (Task 1.5) — depends on model + service
6. Component HTML (Task 1.6) — depends on component TS
7. Component SCSS (Task 1.7) — depends on component HTML (shared knowledge)
8. Route update (Task 1.8) — depends on component existing

---

### Task 1.1: Create analytics.model.ts COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/models/analytics.model.ts`
**Action**: CREATE
**Spec Reference**: implementation-plan.md lines 74-152

**Quality Requirements**:
- All interfaces use `readonly` on every property
- No `any` types
- `TrendDirection`, `FilterPeriod` as string literal union types
- All interfaces exported

**Implementation Details**:
- Exports: `TrendDirection`, `AnalyticsTrend`, `AnalyticsStatCard`, `ProviderCost`, `ClientCost`, `AgentPerformance`, `DailyCostEntry`, `TeamBreakdown`, `FilterPeriod`, `AnalyticsFilterOptions`, `AnalyticsData`
- `AnalyticsStatCard.colorVar` holds a CSS variable name string (e.g. `'--warning'`)
- `ProviderCost.colorClass` is `'blue' | 'green' | 'orange' | 'gray'`
- `ClientCost.barColorVar` is a CSS variable name string
- `AnalyticsData` aggregates all other interfaces as readonly arrays

---

### Task 1.2: Add missing CSS variables to styles.scss COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/styles.scss`
**Action**: MODIFY — append to the existing `:root` block

**Quality Requirements**:
- Add all 12 missing variables inside the existing `:root {}` block (do NOT create a second `:root`)
- Group with a comment `// Semantic aliases & status backgrounds`
- Values must match implementation-plan.md lines 217-230 exactly

**Implementation Details**:
- `--text-tertiary: #595959` (alias for --text-muted)
- `--success: #49aa19`
- `--success-bg: #162312`
- `--warning: #d89614`
- `--warning-bg: #2b2111`
- `--error: #d32029`
- `--error-bg: #2a1215`
- `--running: #177ddc`
- `--completed: #49aa19`
- `--info: #177ddc`
- `--paused: #d89614`
- `--failed: #d32029`

---

### Task 1.3: Add MOCK_ANALYTICS_PAGE_DATA to mock-data.constants.ts COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/mock-data.constants.ts`
**Action**: MODIFY — add import + constant at end of file

**Quality Requirements**:
- Import `AnalyticsData` from `'../models/analytics.model'` at top of file
- Constant typed as `AnalyticsData` (not inferred)
- All 8 top-level fields populated: `statCards`, `providerCosts`, `clientCosts`, `agentPerformance`, `dailyCosts`, `dailyBudgetLimit`, `teamBreakdowns`, `filterOptions`
- `as const` assertion on the constant

**Implementation Details (exact values from plan)**:
- `statCards`: 5 entries — Total Cost $847.32 +12% (--warning), Tasks Completed 48 +8% (--success), Tokens Used 2.4M -5% (--accent), Avg Task Duration 4.2 min -15% (--text-secondary), Active Agents 12 (--accent)
- `providerCosts`: Anthropic 62% $523.40 blue, OpenAI 23% $198.50 green, Google 11% $89.42 orange, Local/CLI 4% $36.00 gray
- `clientCosts`: Acme Corp $412.80/$500 (--accent), TechStart $287.52/$300 (--warning), Internal $147.00/$300 (--success)
- `agentPerformance`: 8 agents — team-leader (online, 48, 3.2min, 18.4K, $6.82, 98%), backend-developer (online, 36, 5.1min, 28.6K, $8.21, 95%), frontend-developer (online, 28, 4.8min, 24.1K, $7.95, 92%), software-architect (online, 22, 8.3min, 42.8K, $12.40, 97%), code-logic-reviewer (online, 41, 2.1min, 12.4K, $4.20, 99%), devops-engineer (offline, 15, 6.2min, 31.2K, $9.80, 88%), tester (online, 38, 3.8min, 19.7K, $6.40, 94%), researcher (offline, 8, 12.4min, 58.3K, $18.20, 75%)
- `dailyCosts`: 30 entries with day 1-30, amounts representing bar heights as percentages of $50 max. Use varied values: [22,18,31,28,35,42,38,29,33,27,41,45,38,32,29,36,44,39,28,35,48,43,37,31,42,38,44,29,33,38]
- `dailyBudgetLimit`: 35
- `teamBreakdowns`: Engineering $520/32 tasks/8 agents/$16.25 avg/$600 budget (87%), Design $210/12 tasks/3 agents/$17.50 avg/$400 budget (53%), Marketing $117/4 tasks/2 agents/$29.25 avg/$200 budget (59%)
- `filterOptions.clients`: ['All Clients', 'Acme Corp', 'TechStart', 'Internal']
- `filterOptions.teams`: ['All Teams', 'Engineering', 'Design', 'Marketing']
- `filterOptions.projects`: ['All Projects', 'e-commerce-api', 'my-react-app', 'go-microservice']

---

### Task 1.4: Add getAnalyticsPageData() to MockDataService COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/mock-data.service.ts`
**Action**: MODIFY — add import + one method

**Quality Requirements**:
- Import `AnalyticsData` from `'../models/analytics.model'`
- Import `MOCK_ANALYTICS_PAGE_DATA` from `'./mock-data.constants'`
- Method signature: `public getAnalyticsPageData(): AnalyticsData`
- Method body: `return MOCK_ANALYTICS_PAGE_DATA;`
- Follow exact style of existing methods (one-liner return)

---

### Task 1.5: Create analytics.component.ts COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/analytics/analytics.component.ts`
**Action**: CREATE
**Pattern to Follow**: `apps/dashboard/src/app/views/dashboard/dashboard.component.ts`

**Quality Requirements**:
- Standalone component with `selector: 'app-analytics'`
- `templateUrl: './analytics.component.html'`
- `styleUrl: './analytics.component.scss'`
- Use `inject(MockDataService)` pattern (not constructor injection)
- All data properties `public readonly`
- No `any` types
- Must use `NgFor`, `NgIf` from `@angular/common` in imports array (or `CommonModule`)

**Implementation Details**:
- `private readonly mockData = inject(MockDataService)`
- `public readonly data = this.mockData.getAnalyticsPageData()`
- `public selectedPeriod: FilterPeriod = '30d'` (mutable — filter state)
- `public selectedClient = 'All Clients'` (mutable)
- `public selectedTeam = 'All Teams'` (mutable)
- `public selectedProject = 'All Projects'` (mutable)
- Method `selectPeriod(period: FilterPeriod): void` to update `selectedPeriod`
- Method `getSuccessRateClass(rate: number): string` — returns `'badge-high'` (>=90), `'badge-medium'` (>=80), `'badge-low'` (<80)
- Method `getBudgetClass(percent: number): string` — returns `'bar-normal'` (<70), `'bar-warn'` (70-90), `'bar-danger'` (>90)
- Method `getBarColor(amount: number, limit: number): string` — returns `'bar-over-budget'` if amount > limit, else `'bar-normal'`
- Computed property `public readonly maxDailyCost`: max value from `data.dailyCosts` for normalizing bar heights

---

### Task 1.6: Create analytics.component.html COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/analytics/analytics.component.html`
**Action**: CREATE

**Quality Requirements**:
- All 7 sections rendered with real mockup-matching HTML
- No placeholder or "coming soon" text anywhere
- Filter period buttons use `(click)="selectPeriod('7d')"` pattern with `[class.active]="selectedPeriod === '7d'"`
- Selects bind to component properties with `[(ngModel)]` or `(change)="selectedClient = $event.target.value"` — use Angular event binding
- Table uses semantic `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` — no div-based tables
- All `<select>` elements have `aria-label` attributes
- CSS chart bars use `[style.width.%]` for horizontal bars or `[style.height.%]` for vertical bars bound to data values
- Daily cost bars: height = `(entry.amount / maxDailyCost) * 100` percent; apply `[ngClass]="getBarColor(entry.amount, data.dailyBudgetLimit)"` for color

**Sections to Implement**:
1. Page header: h1 "Analytics & Insights", subtitle "AI cost analytics and performance insights across all projects", Export button + Schedule Report button
2. Filter bar: period button group (7d, 30d, This Month, Custom), 3 selects (Client, Team, Project) with `aria-label`
3. Stat cards row: 5 cards using `*ngFor` over `data.statCards` — label, value, optional unit, trend arrow (▲/▼ based on direction), trend percent, sub text
4. Chart grid (2-col): left = Cost by Provider (horizontal bars per provider with color classes), right = Cost by Client (bars with budget line overlay)
5. Agent performance table: 8 columns — Agent name + online dot, Tasks, Avg Duration, Tokens/Task, Cost/Task, Success Rate badge
6. Daily Cost Trend: vertical bar chart 200px high with Y-axis labels ($0/$10/$20/$30/$40/$50), 30 bars, dashed budget line at 70% height, X-axis labels (1/5/10/15/20/25/30)
7. Team Breakdown (3-col grid): team name, cost/tasks/agents stats, Avg Cost/Task, budget progress bar with percentage

---

### Task 1.7: Create analytics.component.scss COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/analytics/analytics.component.scss`
**Action**: CREATE

**Quality Requirements**:
- All styles scoped to component (default Angular ViewEncapsulation — no `:host ::ng-deep`)
- Use CSS variables from `styles.scss` throughout — no hardcoded color hex values
- No external library class dependencies

**Key Style Sections to Implement**:
- `.analytics-page` — main container with padding, max-width or full-width matching dashboard
- `.page-header` — flex row with title block + actions
- `.filter-bar` — flex row, period button group (`.period-btn`, `.period-btn.active`), select dropdowns styled dark
- `.stat-cards` — CSS grid 5-col (responsive fallback: repeat(auto-fit, minmax(160px, 1fr)))
- `.stat-card` — bg-secondary, border, border-radius, padding; `.stat-value` large font; `.trend-up` (success color) / `.trend-down` (error color)
- `.chart-grid` — 2-column CSS grid, gap
- `.chart-card` — bg-secondary, border, border-radius, padding; `.chart-title` heading style
- `.provider-bar-row` — flex row; `.bar-track` flex-1 bg-primary; `.bar-fill` height 8px; color classes `.fill-blue`, `.fill-green`, `.fill-orange`, `.fill-gray`
- `.client-bar-row` — relative positioned track; `.budget-line` absolute vertical 2px warning-color
- `.agent-table` — full-width, bg-secondary, border-collapse; `.status-dot` 8px circle; `.dot-online` success color; `.dot-offline` text-secondary; `.badge-high` green badge; `.badge-medium` warning badge; `.badge-low` error badge
- `.daily-trend-chart` — `position: relative; height: 200px; padding: 0 0 24px 40px`; `.y-axis` absolute left; `.bar-area` flex align-end; `.trend-bar` flex:1; `.budget-line-h` absolute horizontal dashed warning line; `.x-axis` absolute bottom; `.bar-normal` accent color; `.bar-over-budget` warning color
- `.team-grid` — 3-column CSS grid
- `.team-card` — bg-secondary, border; `.budget-track` 6px height bg-primary; `.budget-fill` height 100%; `.bar-normal` accent; `.bar-warn` warning; `.bar-danger` error

---

### Task 1.8: Update app.routes.ts to register AnalyticsComponent COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/app.routes.ts`
**Action**: MODIFY

**Quality Requirements**:
- Add import: `import { AnalyticsComponent } from './views/analytics/analytics.component';`
- Replace line 14: `{ path: 'analytics', component: PlaceholderViewComponent, data: { title: 'Analytics' } }` with `{ path: 'analytics', component: AnalyticsComponent }`
- Do NOT remove the `PlaceholderViewComponent` import — it is still used by agents, models, new-task, onboarding, providers routes
- No other changes to the file

---

**Batch 1 Verification**:
- All 4 new files exist at specified paths
- All 4 modified files updated correctly
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved
