# Development Tasks - TASK_2026_106

**Total Tasks**: 5 | **Batches**: 3 | **Status**: 3/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `SKILL.md` has exactly 1 occurrence of `implementation-plan.md` (line 135, phase detection table): Verified by architect grep
- `task-tracking.md` has 5 occurrences of `implementation-plan.md` and 2 of `visual-design-specification.md`: Verified by architect with line numbers
- `strategies.md` has 5 occurrences of `implementation-plan.md` and 1 of `visual-design-specification.md`: Verified by architect with line numbers
- `checkpoints.md` has 3 occurrences of `implementation-plan.md`: Verified by architect with line numbers
- `auto-pilot/SKILL.md` has 3 occurrences of `implementation-plan.md`: Verified by architect with line numbers

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phase detection breaks for 21 existing tasks that have `implementation-plan.md` | MEDIUM | Phase detection tables must note BOTH `plan.md` AND `implementation-plan.md` as valid (legacy fallback) |
| 21 out-of-scope files still reference `implementation-plan.md` after this task | HIGH (awareness) / LOW (severity) | Document as required follow-up in completion; agents are LLMs and will adapt |
| `plan.md` name collision with `task-tracking/plan.md` (project roadmap) | LOW | Paths are always fully qualified; context disambiguates |

---

## Batch 1: Core Orchestration Files COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 2 | **Dependencies**: None

### Task 1.1: Add Universal Lifecycle Flow + rename artifact in SKILL.md COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md`
**Spec Reference**: implementation-plan.md lines 59-82 (new section content), line 91 (rename location)

**Changes**:
1. Insert `## Universal Lifecycle Flow` section after the "Quick Start" section (after line 35, before "Your Role: Orchestrator")
2. Line 135: Replace `| implementation-plan.md  |` with `| plan.md OR implementation-plan.md |` (legacy fallback note — see Validation Notes)

**Universal Lifecycle Flow Section Content**:
```markdown
## Universal Lifecycle Flow

Every task type follows the same 6-step lifecycle. The agents and review criteria vary, but the surrounding process — artifacts, status transitions, logging, commits — is identical.

| Step | Purpose | Artifact | What Varies |
|------|---------|----------|-------------|
| 1. GATHER CONTEXT | Collect codebase state, constraints | context.md | First agent (PM, Researcher, etc.) |
| 2. DEFINE REQUIREMENTS | Scope, acceptance criteria | task-description.md | PM or first planning agent |
| 3. PLAN THE WORK | Approach, structure, steps | plan.md | Architect (code), Content Writer (outline), Designer (brief) |
| 4. EXECUTE | Produce the deliverable | Actual output (code, content, designs) | Developer, Content Writer, Designer, DevOps |
| 5. REVIEW | Quality gate | review-report.md | Code review, style review, accessibility review |
| 6. COMPLETE | Close the task | Status transition, logging, commit | Completion Worker or Supervisor |

**Invariants across all types:**
- Artifact filenames at each step
- Status transitions: CREATED -> IN_PROGRESS -> IMPLEMENTED -> IN_REVIEW -> COMPLETE
- Logging format and session analytics
- Commit conventions and traceability
- Checkpoint handling
- Supervisor monitoring protocol
```

**Validation Notes**:
- RISK: Phase detection for 21 existing tasks. The line 135 rename MUST retain `implementation-plan.md` as a legacy fallback. Exact wording: change `| implementation-plan.md  |` to `| plan.md (or legacy: implementation-plan.md) |` so agents know to accept either filename during continuation mode.

---

### Task 1.2: Rename artifact references in task-tracking.md COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/task-tracking.md`
**Spec Reference**: implementation-plan.md lines 101-107

**Changes (7 locations)**:
1. **Line 34** (folder structure): `implementation-plan.md       # Architecture design (Architect output)` -> `plan.md                      # Plan (Architect output — architecture, content outline, design brief)`
2. **Line 49** (folder structure): `visual-design-specification.md # Visual design (UI/UX Designer output, optional)` -> `design-spec.md               # Design specification (UI/UX Designer output, optional)`
3. **Line 150** (ownership table): `| implementation-plan.md | software-architect     | Architecture, file specifications |` -> `| plan.md | software-architect     | Plan — architecture, outline, or brief |`
4. **Line 191** (phase detection table): `| + implementation-plan.md         | Architect done         |` -> `| + plan.md (or legacy: implementation-plan.md) | Architect done         |`
5. **Line 220** (continuation example): `3. Found: context.md, task-description.md, implementation-plan.md, tasks.md` -> `3. Found: context.md, task-description.md, plan.md, tasks.md`

**Note on visual-design-specification.md**: Also rename at line 49 (folder structure only — line 49 is the only `visual-design-specification.md` occurrence in task-tracking.md per architect investigation).

**Validation Notes**:
- Line 191 phase detection is CRITICAL — must include legacy fallback to avoid breaking continuation for 21 existing tasks.

---

**Batch 1 Verification**:
- Both files exist and have been modified
- No raw `implementation-plan.md` references remain (except in legacy fallback notes)
- Universal Lifecycle Flow section present in SKILL.md
- nitro-code-logic-reviewer approved

---

## Batch 2: Strategy and Checkpoint Files COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 2 | **Dependencies**: Batch 1 complete (naming convention established)

### Task 2.1: Rename artifact references in strategies.md COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/strategies.md`
**Spec Reference**: implementation-plan.md lines 115-121

**Changes (6 locations)**:
1. **Line 40** (FEATURE flow): `Phase 3: [IF UI/UX work] nitro-ui-ux-designer --> Creates visual-design-specification.md` -> `Phase 3: [IF UI/UX work] nitro-ui-ux-designer --> Creates design-spec.md`
2. **Line 49** (FEATURE flow): `Phase 4: nitro-software-architect --> Creates implementation-plan.md` -> `Phase 4: nitro-software-architect --> Creates plan.md`
3. **Line 106** (REFACTORING flow): `nitro-software-architect --> Creates implementation-plan.md` -> `nitro-software-architect --> Creates plan.md`
4. **Line 194** (DEVOPS flow): `Phase 2: nitro-software-architect --> Creates implementation-plan.md` -> `Phase 2: nitro-software-architect --> Creates plan.md`
5. **Line 421** (creative output table): `| nitro-ui-ux-designer           | \`task-tracking/TASK_[ID]/visual-design-specification.md\`` -> `| nitro-ui-ux-designer           | \`task-tracking/TASK_[ID]/design-spec.md\``

**Note**: Architect specifies 5 locations for `implementation-plan.md` and 1 for `visual-design-specification.md` = 6 total changes. Verify exact line numbers by reading the file first — line numbers may have shifted.

---

### Task 2.2: Rename artifact references in checkpoints.md COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/checkpoints.md`
**Spec Reference**: implementation-plan.md lines 129-133

**Changes (3 locations)**:
1. **Line 20** (checkpoint table): `| **2**  | Architecture Validation     | After Architect   | Approve implementation-plan.md |` -> `| **2**  | Architecture Validation     | After Architect   | Approve plan.md |`
2. **Line 181** (checkpoint 2 trigger): `After nitro-software-architect completes and creates \`implementation-plan.md\`` -> `After nitro-software-architect completes and creates \`plan.md\``
3. **Line 189** (checkpoint 2 deliverable): `**Deliverable**: task-tracking/TASK_[ID]/implementation-plan.md` -> `**Deliverable**: task-tracking/TASK_[ID]/plan.md`

**Note**: Verify exact line numbers by reading the file first.

---

**Batch 2 Verification**:
- Both files exist and have been modified
- No raw `implementation-plan.md` or `visual-design-specification.md` references remain in these files
- nitro-code-logic-reviewer approved

---

## Batch 3: Auto-Pilot Skill COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 1 | **Dependencies**: Batch 1 complete (naming convention established)

### Task 3.1: Rename artifact references in auto-pilot/SKILL.md COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: implementation-plan.md lines 141-145

**Changes (3 locations)**:
1. **Line 1087** (task folder preservation list): `implementation-plan.md` -> `plan.md`
2. **Line 1343** (retry context phase detection): `implementation-plan.md exists? -> Architecture already done` -> `plan.md (or legacy: implementation-plan.md) exists? -> Architecture already done`
3. **Line 1720** (stuck worker assessment): `implementation-plan.md exists? -> Architecture done` -> `plan.md (or legacy: implementation-plan.md) exists? -> Architecture done`

**Note**: Lines 1343 and 1720 are phase detection references — add legacy fallback just like SKILL.md line 135 and task-tracking.md line 191. Line 1087 is just a preservation list (no detection logic), so plain rename is fine there.

**Validation Notes**:
- Lines 1343 and 1720 are phase detection logic — MUST include legacy fallback for `implementation-plan.md` to prevent broken continuation for existing tasks.
- Verify exact line numbers by reading the file first — this is a large file (1720+ lines).

---

**Batch 3 Verification**:
- File exists and has been modified
- Phase detection references include legacy fallback
- nitro-code-logic-reviewer approved

---

## Completion Notes

**Required Follow-Up Task**: After this task completes, a follow-up task must rename `implementation-plan.md` -> `plan.md` and `visual-design-specification.md` -> `design-spec.md` across 21 additional out-of-scope files:
- 10 agent definitions in `.claude/agents/` (nitro-team-leader.md, nitro-software-architect.md, nitro-backend-developer.md, nitro-frontend-developer.md, nitro-systems-developer.md, nitro-devops-engineer.md, nitro-senior-tester.md, nitro-code-style-reviewer.md, nitro-visual-reviewer.md, nitro-project-manager.md)
- 4 orchestration references (agent-catalog.md, team-leader-modes.md, developer-template.md, agent-calibration.md)
- 2 example traces (feature-trace.md, creative-trace.md)
- 2 content writer skill files (CODEBASE-MINING.md, BLOG-POSTS.md)
- 3 docs files (task-template-guide.md, nitro-fueled-design.md, index.html)
