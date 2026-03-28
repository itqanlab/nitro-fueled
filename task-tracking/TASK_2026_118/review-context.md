# Review Context — TASK_2026_118

## Task Scope
- Task ID: 2026_118
- Task type: FEATURE
- Files in scope: [these are the ONLY files reviewers may touch]
  - `.claude/commands/nitro-status.md` (new/updated file)
  - `apps/cli/scaffold/.claude/commands/nitro-status.md` (new/updated file)

## Git Diff Summary

Implementation commit: `d6391ee` — fix(TASK_2026_114): but contains the TASK_2026_118 implementation.

Both files were updated from a thin alias to a full standalone implementation.

### `.claude/commands/nitro-status.md`
- **Before**: Simple alias referencing `/nitro-project-status`, 15 lines
- **After**: Full standalone command with explicit registry-only reading, output format spec, notes — 64 lines
- Added `## Execution` section with explicit "Do NOT read task.md files" constraint
- Added step-by-step execution: read registry.md, parse table, calculate status counts, generate non-complete task table, identify What's Next
- Added `## Output Format` with fenced code block template for full output structure
- Added `## Notes` section explaining lightweight design rationale

### `apps/cli/scaffold/.claude/commands/nitro-status.md`
- **Identical** to `.claude/commands/nitro-status.md` — both files byte-for-byte in sync

## Project Conventions
(from CLAUDE.md)
- Command files are Markdown files in `.claude/commands/` following `/nitro-*` naming convention
- Agent naming: all use `nitro-` prefix for namespace scoping
- Changes to `.claude/` are the scaffold — must always be mirrored to `apps/cli/scaffold/.claude/`
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED

## Style Decisions from Review Lessons
(from `.claude/review-lessons/review-general.md` — rules relevant to Markdown command files)

- **Enum values must match canonical source character-for-character** — status values (CREATED, IN_PROGRESS, etc.) must match SKILL.md exactly. (TASK_001)
- **Commands that claim "read X as source of truth" must not hardcode content that duplicates X** — the command must reference registry.md, not duplicate its schema inline. (TASK_001)
- **Summary sections must be updated when the steps they describe change** — if a Notes or Summary section exists, it must agree with Execution steps. (TASK_2026_064)
- **Implementation-era language must be removed before merge** — no phrases implying the feature is novel. (TASK_2026_064)
- **"Create using the template below" must be followed by an actual template** — Output Format section must contain a real fenced code block. (TASK_2026_061)
- **Step numbering must be flat and sequential** — no mixed schemes. (TASK_2026_043)
- **Metadata fields and prose instructions must be consistent within the same file** — IMPORTANT constraint in Execution must agree with Notes. (TASK_2026_123)
- **Named concepts must use one term everywhere** — `/nitro-status` vs `/status` must not be mixed. (TASK_2026_003)

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- `.claude/commands/nitro-status.md`
- `apps/cli/scaffold/.claude/commands/nitro-status.md`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 0
- Minor: 3 (STYLE-1 title missing nitro- prefix, STYLE-2 Active Tasks/Needs Attention ambiguity, SEC-01 prompt injection via registry.md — LOW)
