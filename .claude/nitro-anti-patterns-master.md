# Anti-Patterns Master — All Tech Categories

Master reference used by `nitro-fueled init` to generate a project-specific `anti-patterns.md`.
Each section is tagged with the tech stacks it applies to. The init process selects sections
matching the detected stack and merges them into a single file.

## Tag Reference

| Tag | Applies When |
|-----|-------------|
| `universal` | All projects regardless of stack |
| `typescript` | TypeScript detected (`tsconfig.json`) |
| `nodejs` | Node.js project (`package.json`) |
| `angular` | Angular framework detected |
| `react` | React or Next.js detected |
| `nextjs` | Next.js detected |
| `vue` | Vue or Nuxt detected |
| `svelte` | Svelte or SvelteKit detected |
| `electron` | Electron detected |
| `tailwind` | Tailwind CSS detected |
| `database` | Any DB ORM/driver detected (prisma, drizzle, typeorm, mongoose, etc.) |
| `express` | Express.js detected |
| `nestjs` | NestJS detected |

---

<!-- tags: universal -->
## Silent Failures

- NEVER swallow errors in fire-and-forget calls. At minimum, log them.
- Delete/update on non-existent ID must return a "not found" indicator, not silent success.
- Operations that modify state must surface errors to the caller — never silently succeed.

<!-- tags: universal -->
## Race Conditions & Concurrency

- Buttons and actions that trigger async operations: disable during execution OR use a guard flag.
- Check-then-act patterns (read status → set status) are NOT safe. Use a single atomic state transition.
- Concurrent calls to the same resource: use mutual exclusion (one at a time) or idempotency.

<!-- tags: universal -->
## Error UX

- User-facing errors must be human-readable, not raw exception messages.
- Config/init failures at startup must block with a clear message, not silently continue.
- Clipboard, file dialog, and network operations must handle failure with user feedback.

<!-- tags: universal -->
## Code Size & Responsibility

- Functions over 50 lines are doing too much — split by responsibility.
- Files over 300 lines signal a missing abstraction. Split by concern before the file grows further.
- One function, one responsibility. If you need "and" to describe it, split it.

<!-- tags: universal -->
## Input Validation

- Validate at system boundaries (user input, external APIs, IPC). Trust internal code.
- Never assume external data is the right type or shape. Validate or coerce explicitly.
- Reject invalid input early (guard clauses at the top of functions).

<!-- tags: typescript -->
## Type Safety

- Use typed string unions / enums for status, type, and category fields — not bare `string`.
- Avoid `as` type assertions. If the type system fights you, the type is wrong.
- Use `Pick<>` / `Omit<>` instead of duplicating interface subsets.
- Never use `any` — use `unknown` and narrow, or define the correct type.
- Nullability must be explicit. Don't hide `T | undefined` behind `T`.

<!-- tags: nodejs -->
## Resource & Listener Cleanup

- Every `addEventListener` / `on()` must have a corresponding removal on teardown.
- Timers (`setInterval`, `setTimeout`) must be cleared when the component/service is destroyed.
- Promises that cache initialization (`_initPromise`) MUST reset to null on failure.
- File handles and streams opened must be closed in all exit paths (success and error).

<!-- tags: nodejs express nestjs -->
## Async Error Handling (Node.js)

- Async route handlers must be wrapped with error-catching middleware — unhandled promise rejections crash the process.
- Never mix callback and Promise patterns in the same handler.
- Rejection in `Promise.all` cancels ALL concurrent operations — use `Promise.allSettled` when partial success is acceptable.

<!-- tags: angular -->
## Angular Lifecycle

- NEVER read signal inputs in `constructor`. Use `ngOnInit`, `afterNextRender`, or `effect()`.
- NEVER call `inject()` outside injection context (constructors, field initializers, factory functions).
- Use `computed()` for derived state, NOT mutable properties with manual recalculation.
- Template expressions must NOT call methods — use `computed()` signals instead.
- Every `addEventListener` / `on()` must have a corresponding removal in `ngOnDestroy`.
- Document-level style overrides (cursor, userSelect) MUST be restored on destroy/drag-end.

<!-- tags: angular -->
## Angular Patterns

- Always `standalone: true`. Never NgModule unless integrating legacy code.
- Always `OnPush` change detection.
- `inject()` for DI, never constructor injection.
- `@if`/`@for`/`@switch` control flow, not `*ngIf`/`*ngFor`.
- Signal-based inputs: `input()`, `input.required<T>()`. Signal-based outputs: `output<T>()`.
- Components: max 150 lines. Inline templates: max 50 lines.
- Services/stores: max 200 lines. Spec files: max 300 lines.

<!-- tags: react nextjs -->
## React Patterns

- `useEffect` with missing dependencies causes stale closures. Always include all deps or use `useCallback`/`useMemo`.
- Never mutate state directly — always return a new object/array.
- Avoid prop drilling beyond 2 levels — use context or state management.
- Keys in lists must be stable and unique (not array index when list can reorder).
- Avoid side effects in render — keep render pure.

<!-- tags: nextjs -->
## Next.js Patterns

- Server Components cannot use hooks or browser APIs. Always check the component boundary.
- `use client` directive must be at the top of the file, not inside a function.
- `getServerSideProps` / `getStaticProps` data must be serializable (no class instances, Dates as strings).
- Route handlers must handle all HTTP methods explicitly or return 405.

<!-- tags: vue -->
## Vue Patterns

- Never mutate props directly — emit events to the parent.
- Computed properties should be pure — no side effects.
- `watch` with `{ immediate: true }` runs on mount — document why if intentional.
- Composition API: keep `setup()` focused; extract reusable logic into composables.

<!-- tags: tailwind -->
## Styling & Theme (Tailwind)

- NEVER use hardcoded hex colors. Use Tailwind theme tokens or CSS variables.
- NEVER use inline `style` attributes. Use Tailwind utility classes.
- Tailwind dynamic classes must be in safelist or use full class names (no string interpolation).
- Dark mode classes must be paired (`text-gray-900 dark:text-gray-100`).

<!-- tags: database -->
## Soft-Delete Consistency

- ALL queries that return data must filter `deleted_at IS NULL` unless explicitly requesting deleted items.
- Cascade deletes must cover ALL child tables — audit the schema before writing delete logic.
- Updates must reject soft-deleted records.

<!-- tags: database -->
## Data Integrity

- Multi-step DB writes must be wrapped in a transaction.
- Version increments must use atomic SQL (e.g., `SET version = version + 1`), not read-modify-write.
- Use UNIQUE constraints to prevent duplicates, don't rely on application-level checks alone.
- Foreign key constraints should be enforced at the DB level, not just application level.

<!-- tags: electron -->
## Electron IPC

- IPC handlers must wrap raw rejections into structured error responses — never let raw errors cross the IPC boundary.
- Never expose Node.js APIs directly to the renderer — use contextBridge to limit the surface.
- IPC handler arguments must be validated — renderers can be compromised.
- File system operations in the main process must validate that paths are within expected directories (path traversal).
