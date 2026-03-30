# Code Style Review - TASK_2026_154

| Item | Value |
|------|-------|
| Task | TASK_2026_154 |
| Review Type | Code Style |
| Verdict | FAIL |

## Findings

1. `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md:87-94,219-223`
   The scaffold skill still mixes the new DB-first loop guidance with older file-centric instructions. It says the supervisor "MUST append every significant event" to `log.md`, and it still describes `state.md` as live supervisor state with append-only `log.md`. That directly conflicts with the mirrored `parallel-mode.md`, which now treats both files as optional artifacts outside the steady-state loop. This leaves the scaffold docs internally inconsistent and harder to follow.

2. `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md:247-253,313-328`
   The scaffold copy still documents autonomous git commits during stop/archive flows (`commit all session artifacts`, `git commit -m ...`). That is out of step with the updated live docs and with the repository rule that commits require explicit user instruction. Even for scaffold docs, this is a style and maintainability problem because it preserves obsolete operational guidance beside the new stateless-loop wording.

3. `.claude/skills/auto-pilot/references/session-lifecycle.md:18-24,39-45,117-118`
   The stale-archive timing is described inconsistently. The startup sequence says Step 0 runs before MCP validation, but the later lifecycle subsection says the startup block runs after MCP validation and concurrent-session guard. The intended order can be inferred, but the duplicated wording makes the lifecycle harder to read and easier to misapply.

## Summary

The live `parallel-mode.md` rewrite is much clearer and substantially improves the stateless loop contract. The remaining issue is documentation consistency: the scaffold `SKILL.md` still carries several old file-based and auto-commit instructions, and `session-lifecycle.md` has one ordering inconsistency that should be tightened.
