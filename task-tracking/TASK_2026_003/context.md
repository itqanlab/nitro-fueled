# Context — TASK_2026_003

## User Intent

Restructure the auto-pilot and orchestration workflow:
1. Rename auto-pilot main session to "Supervisor" — flow coordinator role
2. Split single worker session into Build Worker and Review Worker
3. Add new task states: IMPLEMENTED, IN_REVIEW
4. Workers update registry themselves, Supervisor only monitors flow
5. Supervisor failure handling: respawn same worker type if state didn't transition

## Strategy

**Type**: REFACTORING
**Flow**: Architect → Team-Leader → Developer → QA
**Complexity**: Complex

## Key Decisions (from Product Owner discussion)

- Workers update the registry, not the Supervisor
- No special cleanup workers — respawn same type on failure
- Registry tracks execution state, Plan tracks strategy (separate artifacts)
- Reviewers verify quality, not the Supervisor
- Each role has focused context — no session overloaded with unnecessary knowledge

## Files to Modify

- `.claude/skills/auto-pilot/SKILL.md` → rename to Supervisor, restructure core loop
- `.claude/skills/orchestration/SKILL.md` → add Exit Gate, update Completion Phase for Build/Review split
- `.claude/skills/orchestration/references/task-tracking.md` → add new states
- `.claude/commands/auto-pilot.md` → update terminology and references
