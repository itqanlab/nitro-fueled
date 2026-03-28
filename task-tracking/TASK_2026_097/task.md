# Task: Auto-Complexity Estimation at Task Creation

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | FEATURE      |
| Priority   | P2-Medium    |
| Complexity | Medium       |
| Model      | default      |
| Testing    | unit         |

## Description

At task CREATE time, the system should **automatically estimate the task's complexity tier** (simple / medium / complex) from the task description and metadata. The user is never asked. The estimated tier is stored as `preferred_tier` in the task metadata and used by the Supervisor when routing the task to a worker.

### Complexity Signals

The estimator analyzes the task description for the following signals:

**Simple** (→ `light` tier):
- Single file change
- Bugfix with clear root cause
- Documentation update
- Config change
- Keywords: "fix typo", "update config", "add field", "rename"

**Medium** (→ `balanced` tier):
- Multiple files, single service
- New endpoint or component
- Refactor within a module
- Keywords: "add endpoint", "create component", "migrate command", "implement service"

**Complex** (→ `heavy` tier):
- Cross-service changes
- New subsystem or infrastructure
- Architectural changes
- Keywords: "scaffold", "integrate", "cross-service", "architecture", "pipeline", "migrate database"
- High estimated file count (>10 files)

### Implementation

- **Complexity estimator** — new module `libs/worker-core/src/core/complexity-estimator.ts` (or CLI-side equivalent)
- Called during task creation (`apps/cli/src/commands/create.ts`) after the task description is captured
- Outputs: `{ tier: 'simple' | 'medium' | 'complex', confidence: 'high' | 'low', signals: string[] }`
- Writes `preferred_tier` into the task.md metadata table
- Low-confidence estimates default to `medium`

### Task Metadata Update

The task.md template gains a new metadata field:

```
| preferred_tier | medium | (auto-estimated: balanced provider tier) |
```

### Supervisor Integration

The auto-pilot skill reads `preferred_tier` from task.md when deciding which provider+tier to use. This replaces any hard-coded complexity-to-tier logic in the skill.

## Dependencies

None — independent of TASK_2026_095 and TASK_2026_096. Can run in parallel with both.

## Acceptance Criteria

- [ ] `nitro-fueled create` writes `preferred_tier` to task.md automatically
- [ ] Complexity estimator correctly classifies simple/medium/complex for representative test cases
- [ ] Low-confidence estimates default to `medium`
- [ ] Auto-pilot skill reads `preferred_tier` from task.md instead of estimating at runtime
- [ ] Task template updated to include `preferred_tier` field
- [ ] No user prompt for complexity — fully automatic

## Parallelism

**Wave**: 1 (independent — can run in parallel with TASK_2026_095)
**Can run in parallel with**: TASK_2026_095, TASK_2026_096, TASK_2026_098
**Conflicts with**: None

## References

- `apps/cli/src/commands/create.ts`
- `task-tracking/task-template.md`
- `.claude/skills/auto-pilot/SKILL.md`
