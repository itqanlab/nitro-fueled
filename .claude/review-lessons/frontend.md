# Frontend Review Lessons

Rules for Angular components, NgRx Signal Stores, templates, routing, styling.
Auto-updated after each task's review cycle. Append new findings — do not remove existing ones.

## Angular Lifecycle

- **Use `inject()` for DI** — never constructor-based injection. (T07)
- **Never read signal inputs in constructor** — use `ngOnInit`, `afterNextRender`, or `effect()`. (T08)
- **Never call `inject()` outside injection context** — constructors, field initializers, factory functions only. (T08)
- **Use `computed()` for derived state** — not mutable properties with manual recalculation. (T08)
- **Template expressions must not call methods** — use `computed()` signals. (T08)

## Components

- **ResizeHandle: restore body styles on destroy** — not just on mouseup. Use `DestroyRef` or `ngOnDestroy`. (T08)
- **Every `addEventListener`/`on()` must have removal** in `ngOnDestroy` or teardown. (5/14 tasks)
- **Document-level style overrides** (cursor, userSelect) MUST be restored on destroy/drag-end. (T08)
- **CollapsiblePanel: read localStorage in ngOnInit** — inputs aren't bound in constructor. (T08)
- **Single source of truth for state** — if parent and child both own collapsed/expanded, one overwrites. Pick one owner. (T08)
- **Cmd+K must check `event.target`** — skip if target is input/textarea/contentEditable. (T08)
- **Use `navigator.userAgentData`** — `navigator.platform` is deprecated. (T08)

## Change Detection

- **All Angular components must use `changeDetection: ChangeDetectionStrategy.OnPush`** — default change detection causes unnecessary re-renders. Every new component must include `changeDetection: ChangeDetectionStrategy.OnPush` in its `@Component` decorator. (11 tasks: 079,081,082,083,084,115,147,148,153,155) [RETRO_2026-03-30_since-2026-03-27]

## Routing

- **Routes must have default paths** — `/settings` needs redirect to `/settings/general`. (T08)
- **Lazy route loading needs error boundary** — failed module load = blank app. Add error handling. (T08)

## Styling

- **Never hardcoded hex colors** — use CSS variables or Tailwind theme tokens. (T08)
- **Never inline `style` attributes** — use Tailwind utility classes. (T08)
- **Tailwind dynamic classes: use full names** — no `text-${color}` interpolation. Safelist or conditional full classes. (T06)
- **NG-ZORRO dark.css + light overrides** — verify used components have light overrides. Unoverridden = dark bleed. (T06)

## State Management (NgRx Signal Store)

- **Store max 200 lines** — split into feature slices if growing beyond. (7/14 tasks)
- **Buttons triggering async ops: disable during execution** — or guard flag to prevent double-fire. (T04, T08)
- **Check-then-act is NOT safe** — use single atomic state transition, not read-then-set. (T04)
- **IPC calls from stores need timeout** — renderer waits forever if main process hangs. (T03, T07)

## IPC Consumption (renderer side)

- **IpcService must catch raw rejections** — if handler missing or crashes, raw Electron Error breaks `IpcResponse` contract. (T07)
- **Boolean fields arrive as 0/1 from SQLite** — convert in handler (backend), not in component. If backend doesn't, convert in store. (T07)
- **Clipboard, file dialog, network ops must handle failure** — with user feedback, not silent swallow. (T08, T09)
- **Config/init failures at startup must block with clear message** — not silently continue broken. (T09)

## Template Bindings

- **`[class]="computed()"` overwrites ALL static classes** — use `[ngClass]` to merge, or include static classes in the computed string. Never combine `class="..."` with `[class]="..."` on the same element. (T83)

## Signal Store Event Handlers

- **Read `store.signal()` fresh before each `patchState`** — capturing `store.sessions()` once at callback top creates stale closures when multiple events fire rapidly. Each `patchState` must read current state. (T83)
- **Reset guard flags on destroy** — if a store uses a `subscribed` flag to prevent double-subscription, register `destroyRef.onDestroy(() => patchState(store, { subscribed: false }))` so re-entry works. (T83)
- **Throttle/debounce event-driven IPC refreshes** — subscribing to high-frequency events (e.g., `text_delta`) and calling `ipc.invoke` on each one floods the IPC channel. Either filter by event type or debounce the refresh call. (T81)
- **Clean up subscriptions before re-subscribing** — if `subscribeEvents(taskId)` can be called multiple times (e.g., route param changes in an effect), call `cleanup()` first or guard with a flag. Otherwise duplicate listeners accumulate. (T81)

## Security (renderer side)

- **Always use DOMPurify.sanitize() on marked.parse() output** — never use `bypassSecurityTrustHtml` without DOMPurify. In Electron, XSS in the renderer means access to the IPC bridge and all allowlisted channels. Every other component in the codebase uses DOMPurify; skipping it is a critical vulnerability. (T81)
- **Validate route params before IPC dispatch** — route params like projectId/taskId should be format-checked (e.g., UUID regex) before being sent as IPC payloads. Empty-string checks are insufficient. (T81)
- **Wrap marked.parse() in try/catch inside computed signals** — if marked throws on malformed input, the entire computed signal throws, crashing Angular change detection. Always fall back to plain text. (T81)

## Optimistic Updates

- **Optimistic inserts must be rolled back on failure** — if you add a temp item to a signal array before the IPC call, remove it (filter by temp ID) in the catch/error branch. Otherwise the user sees phantom data that was never persisted. (T81)

## IPC Payload Correctness

- **Verify renderer payload satisfies Zod schema constraints** — if a Zod schema has `z.string().min(1)`, passing `''` (e.g., `task.field ?? ''`) will always fail validation. Either validate before calling or ensure the fallback satisfies the schema. (T81)
- **Event handlers must refresh ALL dependent data** — if `onSessionEvent` only refreshes sessions but timeline/messages also depend on the event, users see stale data until manual reload. Refresh every data source affected by the event. (T81)

## Testing (frontend)

- **No `async` keyword on synchronous tests** — misleading. (T09)
- **Test `ngOnDestroy` cleanup** — verify listener removal, subscription teardown. (T06)
- **Edge case coverage** — test with empty input, missing optional fields, boundary values. (T09)

## Store Error Handling

- **Store methods that call IPC must show errors on failure** — `loadCosts()` / `loadQueue()` checking `res.success` but having no `else` branch with `msg.error()` means users see stale data with no indication of failure. Always add error feedback. (T86)

## Session / Multi-Context Data Paths

- **WebSocket events must write to the same path the view reads** — if a view reads `sessionData.get(id).log`, an incremental `log:entry` event handler must patch that path, not a different field like `state.sessionLog`. Mismatched read/write paths silently discard live updates. (T38)
- **Session cache guards need TTL or documented intent** — `!sessionData.has(id)` as a fetch guard creates a permanent one-shot cache. Active sessions can change while cached. Either add a staleness check or comment the intentional caching so maintainers do not silently break it. (T38)
- **Inline SVG data URIs bypass the token system** — `backgroundImage` SVGs with `fill='%23hexcolor'` cannot reference JS token variables. Use a positioned inline SVG element instead so the fill color stays in the token system and changes with the theme. (T38)
- **Picker components must not own async API calls** — components that are purely presentational selectors should not contain `api.getX().then(...)` logic. Lift fetch-on-select into the hook layer alongside related WebSocket handlers so the component stays pure. (T38)

## Static / Landing Pages (Astro, plain HTML)

- **Counter/number animations must start on viewport entry, not on script load** — calling `animateCounter()` unconditionally at parse time means the animation fires before the element is visible. Wrap in a one-shot `IntersectionObserver` on the target element. (TASK_2026_056)
- **Clipboard copy silent-fail is unacceptable on a marketing page** — bare `catch {}` on `navigator.clipboard.writeText` leaves the user believing they copied when they did not. Always provide visual error feedback; attempt `document.execCommand('copy')` as a synchronous fallback before giving up entirely. (TASK_2026_056)
- **Mobile hamburger state must be reset on viewport resize** — if a user opens the mobile menu then widens the viewport, the `open` class and `aria-expanded="true"` persist on the now-hidden menu. Add a `resize` listener that clears state when crossing the responsive breakpoint. (TASK_2026_056)
- **`setTimeout` for UI icon-swap must use `clearTimeout` on re-entry** — without clearing the previous timeout, rapid clicks accumulate pending callbacks that race each other and produce inconsistent icon state. Always `clearTimeout(prevTimer)` before starting a new one. (TASK_2026_056)
- **IntersectionObserver must be feature-detected before construction** — constructing `new IntersectionObserver(...)` without a `'IntersectionObserver' in window` guard crashes the entire inline `<script>` block on unsupported clients, silently disabling all subsequent interactive behaviors (hamburger, clipboard) that share the same script scope. (TASK_2026_056)
- **Active nav-link highlighting must clear when the user scrolls below all observed sections** — using `entry.isIntersecting` only to *set* an active link, without tracking exits, causes the last matched link to stay highlighted indefinitely as the user scrolls through unobserved sections. Either observe exit events or add a bottom sentinel that clears all active links. (TASK_2026_056)
- **All color values must go through the design token system** — using raw Tailwind color utilities (e.g., `text-yellow-400`) alongside project-specific tokens (e.g., `text-nitro-orange`) creates inconsistency and breaks palette-wide updates. Add missing colors to the Tailwind theme extension and use only token classes. (TASK_2026_056)
- **`aria-current` must accompany class-based active-link highlighting** — toggling Tailwind color classes for "active" state is invisible to screen readers. Always pair class changes with `link.setAttribute('aria-current', 'true')` / `removeAttribute('aria-current')` so keyboard and AT users get semantic state. (TASK_2026_056)

## Editor / Toolbar Components

- **Markdown toolbar `catch` block must sanitize before `[innerHTML]`** — if `marked.parse()` throws, the catch fallback must still run `DOMPurify.sanitize(rawContent)` before returning. Returning raw content directly to `[innerHTML]` creates an XSS vector regardless of how unlikely the throw is. (TASK_2026_080)
- **`isDirty` must be checked before any navigation or agent/item switch** — an editor that computes `isDirty` but does not gate item-switching behind a dirty check gives the user a false sense of safety. Always confirm or auto-save before overwriting store state. (TASK_2026_080)
- **Toolbar cursor placement must land INSIDE inserted markers when no text is selected** — inserting `**bold text**` and placing the cursor at `start + wrapped.length` puts it after the closing marker. When `selectedText === ''`, the cursor should land at `start + openingMarker.length` so the user types in place of the placeholder. (TASK_2026_080)
- **Code insertion: empty selection must produce a fenced block, not inline ticks** — `selectedText.includes('\n')` is false for an empty string, so the empty-selection case silently falls into the inline branch. The correct condition is `selectedText === '' || selectedText.includes('\n')`. (TASK_2026_080)
- **Version number on save button must be `currentVersion + 1`** — displaying `currentVersion` as the target version tells the user they are overwriting the version they just loaded, not creating a new one. Always compute next = current + 1 for the label. (TASK_2026_080)
- **`totalLines` must be seeded from initial content, not left at default 0** — if the cursor position signal defaults to `{ totalLines: 0 }`, the status bar shows "0 lines" until the user interacts with the textarea. Initialize by reading the textarea content length in `ngAfterViewInit`. (TASK_2026_080)

## Data Visualization

- **Y-axis tick labels must share the same scale as bar height calculations** — if bar heights use `amount / maxValue * 100`, the y-axis must label the top tick as `maxValue`, not a hardcoded ceiling. Mismatched scales silently produce wrong visual readings for every bar. (TASK_2026_079)
- **Filter UI state must be connected to a data transform or explicitly marked as stub** — implementing filter state (`selectedPeriod`, `selectedClient`) without connecting it to a `computed()` data derivation is a silent UI lie. Either wire the filter to a `computed()` signal or add a `// TODO: connect to real data` comment so the state is not mistaken for functional. (TASK_2026_079)
- **Trend direction color must encode semantic context, not raw direction** — coloring all `down` trends red and all `up` trends green is wrong when the metric improves by going down (cost, duration, error rate). Add a `goodWhenDown` flag or derive `semantic: 'good'|'bad'` at the data layer. (TASK_2026_079)
- **Budget line `bottom` position must be clamped to 100%** — `(limit / maxValue) * 100` overflows the chart container when the limit exceeds the data maximum. Always apply `Math.min(100, ...)` before binding to `[style.bottom.%]`. (TASK_2026_079)
- **`Math.max(...emptyArray)` returns `-Infinity`** — spreading an empty array into `Math.max()` silently produces `-Infinity`, breaking all downstream calculations that divide by it. Guard with `dailyCosts.length ? Math.max(...) : 0` before assigning `maxDailyCost`. (TASK_2026_079)

## Angular Template Patterns

- **Never use `*ngFor`/`*ngIf` in new Angular 17+ templates** — the project standard is `@for`/`@if`/`@switch` block syntax. Using the old structural directives in one component creates the only divergent template in the codebase and requires adding `NgFor`/`NgIf` to `imports`, which becomes dead code after migration. Always use block syntax from the start. (TASK_2026_079)
- **CSS variable color driven by data must use class names, not inline `[style]` bindings** — binding `[style.color]="'var(' + colorVar + ')'"` bypasses the project's rule against inline style attributes and creates an implicit string-format contract (the field must hold a valid CSS variable name) with no type enforcement. Use a string union type for a color key and drive variation through CSS classes (e.g. `.stat-value--warning`). (TASK_2026_079)
- **`$any()` in templates is the template equivalent of a type assertion — avoid it** — `$any($event.target).value` in `(change)` handlers escapes type safety. Use a typed handler method in the class that casts via `(event.target as HTMLSelectElement).value` so the escape is explicit, greppable, and in one place. (TASK_2026_079)
- **Per-item template method calls must be replaced with precomputed collections** — calling `getBudgetClass(team.budgetUsed, team.budgetTotal)` inside `*ngFor` / `@for` fires the method on every change detection cycle for every item. Precompute a mapped array with all derived properties as a `readonly` property or `computed()` signal on the component class. (TASK_2026_079)
- **`get` accessors that read signals are equivalent to method calls in templates** — a `get` that calls `signal()` fires on every change detection cycle, not only when the dependency changes. Always use `computed()` for signal-derived boolean/string state exposed to templates. (TASK_2026_080)
- **SVG data URI arrow icons bypass the CSS variable system** — `background-image: url("data:image/svg+xml,...stroke='%23hexcolor'")` encodes a literal hex color that cannot reference `var()` tokens. Use a positioned inline SVG element or a CSS `::after` pseudo-element border trick so the color stays in the token system and responds to theme changes. (TASK_2026_080)
- **`.store.ts` naming implies NgRx Signal Store semantics** — if the implementation uses plain `@Injectable` with raw signals, name the file `.service.ts` and the class `*Service`. Mismatched naming forces developers to hold two mental models and wastes onboarding time. (TASK_2026_080)
- **All components in a feature must use the same template/styles convention** — mixing inline `template:`/`styles:` with external `.html`/`.scss` files within the same feature directory creates tooling inconsistency (no IDE HTML support, no SCSS nesting). Choose one convention per feature and apply it uniformly. (TASK_2026_080)
- **Do not call a service method twice when the result is already stored** — if `public readonly agentList` is initialized by `service.getList()`, the constructor must reference `this.agentList`, not call `service.getList()` again. Double-calls create silent divergence when the service becomes stateful or async. (TASK_2026_080)
- **`toSignal` `initialValue: null` fires the effect before HTTP completes — do not equate initial null with API error** — when `toSignal(..., { initialValue: null })` is used, the effect runs synchronously on construction with `null`. Any `if (raw === null) { unavailable = true }` branch will set the error state before the HTTP request returns, causing a brief false-alarm error banner on every healthy page load. Use a `LoadingState = 'pending' | 'loaded' | 'error'` discriminated union, or check a separate `isFirstEmit` flag, to distinguish the initial null from a real API failure null. (TASK_2026_146)
- **`[nzLoading]` or equivalent spinner bindings must not be derived from empty-array length** — `[nzLoading]="list.length === 0"` conflates "still loading" with "loaded but empty", producing a perpetual spinner when the list is genuinely empty. Use a dedicated boolean loading flag that is set to `false` once the Observable emits any value (including an empty array). (TASK_2026_146)
- **`rangeWidth` or bar overlay width computed as `(max - min) / globalAvgMax` will exceed 100%** — the global max of average values is always smaller than the max of individual maximum values; the resulting CSS width overflows its container. Either compute `globalMax` from the same dimension being visualised (max values) or clamp the result to `100%`. (TASK_2026_146)
- **Reviews and fix-cycles without a timestamp field must be explicitly placed in a timeline, not silently appended after sorted items** — appending records with `time: ''` after a chronological sort produces a timeline that shows all timestamped events first and all un-timed events last, which misrepresents execution order. If a timestamp is unavailable, document the limitation inline (e.g., `label: '(time unknown)'`) rather than letting silent ordering imply the events happened at the end. (TASK_2026_146)
- **Quality-per-dollar or cost-efficiency metrics must not hardcode per-model token pricing** — baking `$3/M input, $15/M output` into an adapter makes every non-Claude-Sonnet model appear overpriced or underpriced, inverting rankings in the very view designed to compare models. Inject pricing from a config or fetch actual cost from the DB (where `CortexWorker.cost` already tracks it). (TASK_2026_146)
- **`computed()` signals on components must always be `public readonly`** — declaring `public truncatedActivities = computed(...)` without `readonly` allows the signal reference itself to be reassigned. Angular's change detection tracks the original reference; reassignment silently breaks template bindings with no type error. Every `signal()` and `computed()` field must carry `readonly`. (TASK_2026_203)
- **CSS variable `var()` fallback values must not be hardcoded hex/rgb** — writing `color: var(--token, #hexvalue)` bakes a color that cannot be updated by theme changes into the component. If the token is missing from the theme, the fallback hex takes over silently and the component goes out of sync with the palette. Use only `var(--token)` with no fallback; fix missing tokens in the theme file instead. (TASK_2026_203)
- **`computed()` signals iterating combined active+recent signal arrays must not include entries that are always filtered out** — `heartbeatStatusMap` spread both `sessions()` and `recentSessions()` but `continue`d for non-running sessions. Since `recentSessions` is constructed to only contain non-running entries, the spread was purely wasted allocation every tick. Scope the iteration to the minimal set the logic actually processes. (TASK_2026_203)
- **`String.prototype.slice()` in templates is a method call** — `session.startedAt.slice(11, 16)` in an `@for` template fires on every change detection cycle for every item. Move all string transformations into a `computed()` precomputed map on the component class. (TASK_2026_203)
- **`catchError(() => EMPTY)` in background polling intervals must log before discarding** — a fire-and-forget `interval().pipe(switchMap(() => api.call().pipe(catchError(() => EMPTY)))).subscribe()` with a bare `EMPTY` swallows every error with zero observability. Always add `console.warn('[ComponentName] background call failed:', err)` inside `catchError` before returning `EMPTY`. Violates the anti-pattern: "NEVER swallow errors in fire-and-forget calls. At minimum, log them." (TASK_2026_203)
- **Optional interface fields on model types allow silent data flow gaps** — marking `lastHeartbeat?: string | null` on `ActiveSessionSummary` allows the server to omit the field without a TypeScript error. If the field is required for a feature to function, it must be non-optional. Make it optional only when absence is a genuinely valid server response, and add a fallback label in the component to distinguish "absent" from "null". (TASK_2026_203)
