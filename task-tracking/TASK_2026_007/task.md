# Task: Update CLAUDE.md and Design Doc

## Metadata

| Field      | Value         |
|------------|---------------|
| Type       | DOCUMENTATION |
| Priority   | P1-High       |
| Complexity | Simple        |

## Description

CLAUDE.md and the design doc (`docs/claude-orchestrate-package-design.md`) are outdated and don't reflect the current architecture. Update both to match the actual state of the project.

**CLAUDE.md updates needed:**
- Current State section still says "Need to build auto-pilot skill" — should reflect Supervisor, Planner, new task states
- Development Priority: mark items 1-3 as done (already done), update items 4-5 with current understanding
- Add Supervisor/Planner to project structure
- Add new task states (IMPLEMENTED, IN_REVIEW) to conventions
- Update package name references to "nitro-fueled"

**Design doc updates needed:**
- Rename from `claude-orchestrate` to `nitro-fueled` throughout
- Update Auto-Pilot Loop section to reflect Supervisor architecture (Build/Review workers, state transitions)
- Update agent list to reflect core/project agent separation and systems-developer
- Update task states to include IMPLEMENTED and IN_REVIEW
- Add Planner and /plan command to the architecture
- Update PM Agent Discussion to reflect Planner solving the scoping problem
- Resolve open questions that have been answered (stack detection = yes, anti-patterns = core/project split)

## Dependencies

- None

## Acceptance Criteria

- [ ] CLAUDE.md Current State reflects Supervisor, Planner, new states
- [ ] CLAUDE.md Development Priority is up to date
- [ ] Design doc renamed from claude-orchestrate to nitro-fueled
- [ ] Design doc reflects Supervisor/Planner architecture
- [ ] Design doc reflects Build/Review worker split
- [ ] Design doc reflects core/project agent separation
- [ ] Open questions resolved where answers exist

## References

- `CLAUDE.md`
- `docs/claude-orchestrate-package-design.md`
- `docs/mcp-session-orchestrator-design.md`
