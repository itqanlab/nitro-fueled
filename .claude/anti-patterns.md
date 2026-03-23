# Anti-Patterns — Lessons from QA Reviews

Rules derived from 142 QA findings across 14 tasks. Check these BEFORE submitting work.

## 1. File Size Limits (violated in 7/14 tasks)
- Components: max 150 lines. Inline templates: max 50 lines.
- Services/repositories/stores: max 200 lines. Spec files: max 300 lines.
- If approaching limits, split by responsibility DURING implementation, not after.

## 2. Resource & Listener Cleanup (violated in 5/14 tasks)
- Every `addEventListener` / `on()` must have a corresponding removal in `ngOnDestroy` or teardown.
- Document-level style overrides (cursor, userSelect) MUST be restored on destroy/drag-end.
- Promises that cache initialization (`_initPromise`) MUST reset to null on failure.

## 3. Silent Failures (violated in 7/14 tasks)
- NEVER swallow errors in fire-and-forget calls. At minimum, log them.
- Delete/update on non-existent ID must return a "not found" indicator, not silent success.
- IPC handlers must wrap raw rejections into structured error responses.

## 4. Race Conditions & Concurrency (violated in 5/14 tasks)
- Buttons that trigger async operations: disable during execution OR use a guard flag.
- Check-then-act patterns (read status → set status) are NOT safe. Use a single atomic state transition.
- Concurrent picker/dialog calls: use mutual exclusion (one at a time).

## 5. Angular Lifecycle (violated in 4/14 tasks)
- NEVER read signal inputs in `constructor`. Use `ngOnInit`, `afterNextRender`, or `effect()`.
- NEVER call `inject()` outside injection context (constructors, field initializers, factory functions).
- Use `computed()` for derived state, NOT mutable properties with manual recalculation.
- Template expressions must NOT call methods — use `computed()` signals instead.

## 6. Type Safety (violated in 5/14 tasks)
- Use typed string unions / enums for status, type, and category fields — not bare `string`.
- Avoid `as` type assertions. If the type system fights you, the type is wrong.
- Use `Pick<>` / `Omit<>` instead of duplicating interface subsets.

## 7. Soft-Delete Consistency (violated in 3/14 tasks)
- ALL queries that return data must filter `deleted_at IS NULL` unless explicitly requesting deleted items.
- Cascade deletes must cover ALL child tables — audit the schema before writing delete logic.
- Updates must reject soft-deleted records.

## 8. Styling & Theme (violated in 3/14 tasks)
- NEVER use hardcoded hex colors. Use CSS variables or Tailwind theme tokens.
- NEVER use inline `style` attributes. Use Tailwind utility classes.
- Tailwind dynamic classes must be in safelist or use full class names (no string interpolation).

## 9. Error UX (violated in 4/14 tasks)
- User-facing errors must be human-readable, not raw exception messages.
- Config/init failures at startup must block the app with a clear message, not silently continue.
- Clipboard, file dialog, and network operations must handle failure with user feedback.

## 10. Data Integrity (violated in 4/14 tasks)
- Multi-step DB writes must be wrapped in a transaction.
- Version increments must use atomic SQL (e.g., `SET version = version + 1`), not read-modify-write.
- Use UNIQUE constraints to prevent duplicates, don't rely on application-level checks alone.
