# Code Logic Review — TASK_2026_051

## Score: 4/10

## Findings

### Critical

- **`agent-map.ts`: 39 of 40 `agentName` entries do NOT use `nitro-` prefix** — `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/agent-map.ts` lines 9–48. The acceptance criterion explicitly states "agent-map.ts uses new `nitro-*` names for all entries." The task description also says "Generated stack agents also use the prefix: `nitro-react-developer.md`, `nitro-swift-developer.md`, etc." Every entry from `nextjs-developer` through `ios-developer` and the infrastructure agents (`devops-developer`, `terraform-developer`, etc.) remains unprefixed. Only `nitro-ui-ux-designer` (line 43) was updated. This is a 97.5% miss rate on a stated acceptance criterion. When the CLI uses agent-map.ts to resolve a tech-stack agent, it will look for `nextjs-developer.md` instead of `nitro-nextjs-developer.md`, breaking agent resolution for every generated stack agent.

- **`.claude/skills/auto-pilot/SKILL.md`: still references `review-lead.md` and `test-lead.md` (old names) at lines 1257, 1280, 1335, 1358, 1377, 1417** — The auto-pilot supervisor reads these paths literally to load Review Lead and Test Lead instructions when spawning workers. When the Supervisor follows these file paths (`.claude/agents/review-lead.md` and `.claude/agents/test-lead.md`), those files no longer exist — they were renamed to `nitro-review-lead.md` and `nitro-test-lead.md`. This causes every auto-pilot review pipeline invocation to fail to load the correct agent instructions. The scaffold mirror (`packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`) was correctly updated; the source was not. This is a divergence between source and scaffold that will cause silent orchestration failures.

- **`.claude/commands/plan.md`: still references `.claude/agents/planner.md` (old name) at lines 19 and 74** — The `/plan` command explicitly reads `planner.md` to load the Planner agent definition. That file no longer exists at that path; it was renamed to `nitro-planner.md`. Every invocation of `/plan` will fail to load the Planner agent. The scaffold mirror (`packages/cli/scaffold/.claude/commands/plan.md`) was correctly updated to `nitro-planner.md`; the source was not. This is a live breakage in the `/plan` command — one of the most-used commands in the system.

### Minor

- **`agent-calibration.md` uses `backend-developer` and `.claude/agents/backend-developer.md` as its canonical example** — `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/agent-calibration.md` lines 120–121 and 189. This file was not listed in the File Scope of the task, so it is not a hard miss, but the example now documents a non-existent agent path. Any agent using this as a template to create a new record file will produce a Definition File pointing to the old unprefixed name pattern. Low operational risk since these are documentation examples, not executable paths.

- **`agent-calibration.md` Usage section refers to `team-leader` and `review-lead` (unprefixed) as writers** — lines 176 and 177 list `team-leader` and `review-lead` as the workers responsible for record updates. These are informal prose references, not executable paths, but they are inconsistent with the renamed agents. Also not in File Scope, but worth tracking.

## Summary

The rename operation is incomplete in three places that produce live breakage, plus one statutory miss on an acceptance criterion.

The two highest-risk failures are divergences between the scaffold (correctly updated) and the source (not updated) for `.claude/skills/auto-pilot/SKILL.md` and `.claude/commands/plan.md`. These files were explicitly in the task's File Scope. The evidence suggests the developer updated the scaffold mirror but forgot to apply the same changes to the corresponding source files.

The `agent-map.ts` failure is a misreading of the acceptance criterion. The task states "agent-map.ts uses new `nitro-*` names for all entries" and the task description says generated stack agents also use the prefix. All 39 non-`nitro-ui-ux-designer` entries were left unchanged. This breaks CLI resolution for every generated tech-stack agent.

The file rename itself (both locations, 22 agents each) was executed correctly. `subagent_type` references in skill files, examples, and command files were updated correctly in the scaffold. The internal `nitro-review-lead.md` and `nitro-test-lead.md` sub-worker prompt templates correctly use `nitro-` prefixed agent identities. The failure is localized to three specific files where the source was not kept in sync with the scaffold.

**Recommendation: REJECT — three critical acceptance criteria unmet before this is production-usable.**
