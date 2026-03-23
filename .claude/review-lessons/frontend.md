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
