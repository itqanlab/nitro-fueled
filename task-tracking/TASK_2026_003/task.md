# Task: Supervisor Architecture

## Metadata

| Field      | Value     |
|------------|-----------|
| Type       | REFACTORING |
| Priority   | P1-High   |
| Complexity | Complex   |

## Description

Restructure the auto-pilot and orchestration workflow with three major changes:

1. **Rename main session to Supervisor**: The auto-pilot main session is renamed to "Supervisor" to reflect its role as a flow coordinator that spawns workers, monitors health, and ensures state transitions happen — without inspecting work quality or verifying artifacts itself.

2. **Split worker sessions into Build and Review phases**: Instead of one worker session doing everything (PM → Architect → Dev → Reviews → Completion), split into two focused sessions:
   - **Build Worker**: Runs PM → Architect → Team-Leader → Dev → commit. Marks task as IMPLEMENTED when done.
   - **Review Worker**: Runs all reviewers → fixes findings → commit → Completion Phase. Marks task as COMPLETE when done.

   This reduces context pressure per session, makes completion phase less likely to be skipped, and gives the Supervisor explicit state transitions to react to.

3. **Add new task states**: Expand the state machine from `CREATED → IN_PROGRESS → COMPLETE` to `CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE` so the Supervisor knows which worker type to spawn based on current state.

**Supervisor behavior**:
- Reads registry states, spawns appropriate worker type based on current state
- Monitors worker health (alive? stuck? finished?)
- If worker finishes and registry state transitioned → decide what's next based on new state
- If worker finishes but registry state did NOT transition → respawn same worker type (counts as retry, orchestration flow handles resumption via phase detection)
- Workers update the registry themselves, not the Supervisor
- Reviewers are responsible for verification, not the Supervisor

## Dependencies

- None

## Acceptance Criteria

- [ ] Auto-pilot SKILL.md renamed to Supervisor, role/terminology updated throughout
- [ ] Task states expanded: CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE (plus BLOCKED, CANCELLED)
- [ ] Two worker session types defined: Build Worker (CREATED → IMPLEMENTED) and Review Worker (IMPLEMENTED → COMPLETE)
- [ ] Supervisor spawn logic: spawns Build Worker for CREATED tasks, Review Worker for IMPLEMENTED tasks
- [ ] Supervisor failure handling: worker finished but state didn't transition → respawn same worker type (counts as retry)
- [ ] Orchestration SKILL.md updated with Exit Gate for workers to self-validate before exiting
- [ ] Build Worker prompt template scoped to stop after implementation + commit
- [ ] Review Worker prompt template scoped to reviews + fixes + completion phase
- [ ] task-tracking reference updated with new states
- [ ] Registry format supports new states

## References

- Auto-pilot SKILL.md: `.claude/skills/auto-pilot/SKILL.md`
- Orchestration SKILL.md: `.claude/skills/orchestration/SKILL.md`
- Task-tracking reference: `.claude/skills/orchestration/references/task-tracking.md`
- Auto-pilot command: `.claude/commands/auto-pilot.md`
- Checkpoints reference: `.claude/skills/orchestration/references/checkpoints.md`
- TASK_2026_002 review-style.md findings (dead `--stuck` param, missing modes docs)
