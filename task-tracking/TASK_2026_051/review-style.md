# Code Style Review — TASK_2026_051

## Score: 4/10

## Summary

The 22 core agent files are correctly renamed in both `.claude/agents/` and the scaffold mirror. YAML frontmatter `name:` fields and all concrete `subagent_type:` invocation sites in reference files (agent-catalog.md, checkpoints.md, strategies.md) are updated. That is the extent of what was done cleanly.

The implementation is incomplete in three areas that will cause runtime failures:

1. The live `.claude/skills/auto-pilot/SKILL.md` still contains old agent names. This is the file the running Supervisor reads. It points workers to `review-lead.md` and `test-lead.md` — paths that no longer exist. This breaks every Review Worker and Test Lead spawn.
2. The live `.claude/commands/plan.md` still points to `planner.md`, not `nitro-planner.md`. The `/plan` command will fail to load the agent.
3. `agent-map.ts` was only partially updated: `nitro-ui-ux-designer` was prefixed but none of the stack-specific entries were (the task's own acceptance criteria at line 68 requires ALL entries to use the `nitro-*` prefix, and line 42 of task.md explicitly says "Generated stack agents also use the prefix").

---

## Findings

### Critical

- **`.claude/skills/auto-pilot/SKILL.md` not updated — old agent paths still live** — Lines 1257, 1280, 1335, 1358, 1377, 1417 reference `.claude/agents/review-lead.md` and `.claude/agents/test-lead.md`. These files do not exist; they were renamed to `nitro-review-lead.md` and `nitro-test-lead.md`. Additionally, lines 569-570 still show bare `code-logic-reviewer` and `code-style-reviewer` in the model routing table. The scaffold version was correctly updated; the live version was not. Every Review Worker and Test Lead spawned by auto-pilot will fail to load its instructions.

- **`.claude/commands/plan.md` not updated — `/plan` command broken** — Lines 19, 65, and 74 reference `.claude/agents/planner.md`. That file no longer exists (renamed to `nitro-planner.md`). The `/plan` command reads this path in Step 1 before doing anything else. It will error on every invocation.

- **`agent-map.ts` partially updated — only one of N entries prefixed** — Line 43 has `agentName: 'nitro-ui-ux-designer'` but lines 9-48 have 31 other entries with bare names (`nextjs-developer`, `angular-developer`, `devops-developer`, etc.). The task acceptance criteria (task.md line 68) states "agent-map.ts uses new nitro-* names for all entries" and line 42 states "Generated stack agents also use the prefix." The map is inconsistent: one entry prefixed, all others not. At init time, a project detecting Angular will generate `angular-developer.md` without the `nitro-` prefix, conflicting with the claimed ownership separation goal of the task.

### Major

- **`.claude/commands/create-skill.md` references a stale path** — Line 109 shows `- Skill pattern: .claude/skills/ui-ux-designer/SKILL.md`. The scaffold version was updated to `nitro-ui-ux-designer/SKILL.md`, but neither the live commands nor the actual skill directories were renamed — the skill directory itself is still `ui-ux-designer/` in both locations. The scaffold reference now points to a path that does not exist (`nitro-ui-ux-designer/SKILL.md`), making the scaffold version wrong. The live version is correct in pointing to the existing path but creates a discrepancy that will confuse anyone comparing the two.

- **`agent-calibration.md` example records use old agent names** — Lines 17, 31, 32, 33, 43, 121 reference `backend-developer`, `systems-developer`, `code-style-reviewer`, `team-leader`. These are illustrative examples in a schema document. They are not invocation sites, but they are stale after the rename. This file is under `.claude/skills/orchestration/references/` which is listed as in-scope (task.md line 83). A new contributor reading this document will not understand that `backend-developer` in the example should now be `nitro-backend-developer`.

- **`SKILL.md` strategy table mixes naming styles — line 33** — `.claude/skills/orchestration/SKILL.md` line 33 reads: `| CREATIVE | [nitro-ui-ux-designer] -> content-writer -> frontend |`. Other rows in the same table use human-readable abbreviations (`PM`, `Architect`, `Developer`). The CREATIVE row was partially updated: `nitro-ui-ux-designer` now has the full prefixed name in brackets while `content-writer` and `frontend` remain as bare abbreviations. The pre-rename version likely had `[ui-ux-designer]` which was updated but the rest of the row was not normalized. This is cosmetically inconsistent but won't cause a runtime failure.

### Minor

- **`orchestrate-help.md` command example stale in live file** — Line 107 in `.claude/commands/orchestrate-help.md` shows `/validate-project-manager TASK_CMD_009`. The scaffold was updated to `/validate-nitro-project-manager`. This is a documentation example, not a real command, but the scaffold and live versions diverge unnecessarily. Low impact since neither command appears to exist as an actual registered command.

- **`agent-catalog.md` header still claims "16 specialist agents"** — Line 3 of `.claude/skills/orchestration/references/agent-catalog.md` reads "16 specialist agents" but `.claude/agents/` now contains 22 files. This predates TASK_2026_051 and is not a rename regression, but it is misleading and the task touched this file.

---

## What Must Be Fixed Before Merge

1. Update `.claude/skills/auto-pilot/SKILL.md` lines 569, 570, 1257, 1280, 1335, 1358, 1377, 1417 to use `nitro-` names. This is a copy of the already-correct scaffold version.

2. Update `.claude/commands/plan.md` lines 19, 65, 74 from `planner.md` to `nitro-planner.md`. The scaffold version already has the correct content.

3. Decide on `agent-map.ts` scope: either prefix all 32 stack entries with `nitro-` (per task acceptance criteria) or explicitly revise the acceptance criteria to clarify that stack-specific generated agents do not use the prefix. The current half-and-half state is inconsistent and will generate inconsistently named files at init.
