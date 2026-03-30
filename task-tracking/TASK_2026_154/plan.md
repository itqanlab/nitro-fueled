# Plan — TASK_2026_154

## Architecture

Use the cortex DB as the only live state source during the supervisor loop.

1. Update `SKILL.md` to change the runtime contract:
   - DB-backed reads only inside the loop
   - `state.md`/`log.md` are no longer loop memory
   - compaction recovery comes from DB re-query
2. Replace `parallel-mode.md` with a smaller core-loop reference that clearly separates:
   - cortex-backed stateless loop
   - file-based fallback path
3. Update `session-lifecycle.md` so session artifacts match the new contract.
4. Mirror the shipped skill/reference changes to the scaffold copy.

## Risks

1. The scaffold copy must stay aligned with the live `.claude` files or new projects will ship stale supervisor behavior.
2. Existing references to `state.md`/`log.md` elsewhere may remain, so the updated docs need clear wording around “DB-backed path” versus fallback mode.
