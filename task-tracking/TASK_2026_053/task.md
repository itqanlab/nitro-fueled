# Task: Update Docs and Workspace to Reflect Package Vision

## Metadata

| Field      | Value         |
|------------|---------------|
| Type       | DOCUMENTATION |
| Priority   | P1-High       |
| Complexity | Simple        |

## Description

The landing page (`docs/index.html`), `CLAUDE.md`, and `task-tracking/plan.md` still describe nitro-fueled as an internal dev tool. They need to reflect the actual product vision: an installable CLI package that sets up a fully customized AI orchestration pipeline in any project.

### What to update

**`docs/index.html` (landing page)**

Add a proper "Install" section showing the user journey:
```
npx nitro-fueled init     → detects workspace, installs core agents + skills
                          → AI analyzes workspace, proposes custom agents
                          → generates stack-specific anti-patterns
npx nitro-fueled update   → pulls latest agents/skills, preserves customizations
/plan                     → start building
/run                      → autonomous pipeline executes
```

Update agent names throughout to `nitro-*` prefix (from TASK_2026_051).
Add "How it stays current" section explaining the manifest + update model.
Update hero stats to reflect new agent count post-rename.

**`CLAUDE.md` (project root)**

Update "What This Is" section to describe the package correctly:
- It's an installable CLI toolkit, not just a `.claude/` setup
- This project IS the library being tested on itself
- `.claude/` here IS the scaffold — they are always in sync

Add a note about the `nitro-*` naming convention so contributors know why.

**`task-tracking/plan.md`**

Add a new phase for CLI maturity (the 5 tasks created today: 049-053) and update Current Focus and Supervisor Guidance to reflect this new priority area.

**`docs/nitro-fueled-design.md`** (if exists)

Review and update any references to old architecture that predate the package vision.

## Dependencies

- TASK_2026_051 (Rename `nitro-*`) must be COMPLETE — docs must use final agent names

## Parallelism

Can run in parallel with TASK_2026_050 (update command) since they touch different files.
Run after TASK_2026_051 completes (Wave 4, parallel with T2).

## Acceptance Criteria

- [ ] Landing page has an "Install" section with the `init` → `plan` → `run` flow
- [ ] Landing page uses `nitro-*` agent names throughout
- [ ] Landing page has a section explaining the manifest-based update model
- [ ] `CLAUDE.md` accurately describes the package-as-library-tested-on-itself model
- [ ] `CLAUDE.md` documents the `nitro-*` naming convention
- [ ] `task-tracking/plan.md` has a new CLI Maturity phase with tasks 049-053
- [ ] No remaining references to old agent names (non-prefixed) in docs

## File Scope

- `docs/index.html`
- `CLAUDE.md`
- `task-tracking/plan.md`
- `docs/nitro-fueled-design.md` (review only — update if stale)
