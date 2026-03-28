# Implementation Plan — TASK_2026_106

## Codebase Investigation Summary

### Artifact Reference Surface Area

The task.md scopes 5 files. Investigation reveals **significantly broader** surface area:

| Category | Files with `implementation-plan.md` references | Count |
|----------|------------------------------------------------|-------|
| **In-scope (task.md)** | SKILL.md, task-tracking.md, strategies.md, checkpoints.md, auto-pilot/SKILL.md | 5 |
| **Out-of-scope (agents)** | nitro-team-leader.md, nitro-software-architect.md, nitro-backend-developer.md, nitro-frontend-developer.md, nitro-systems-developer.md, nitro-devops-engineer.md, nitro-senior-tester.md, nitro-code-style-reviewer.md, nitro-visual-reviewer.md, nitro-project-manager.md | 10 |
| **Out-of-scope (references)** | agent-catalog.md, team-leader-modes.md, developer-template.md, agent-calibration.md | 4 |
| **Out-of-scope (examples)** | feature-trace.md, creative-trace.md | 2 |
| **Out-of-scope (content writer)** | CODEBASE-MINING.md, BLOG-POSTS.md | 2 |
| **Out-of-scope (docs)** | task-template-guide.md, nitro-fueled-design.md, index.html | 3 |

**Total files with `implementation-plan.md` references**: 26 files
**Total files with `visual-design-specification.md` references**: 7 files

### Critical Discovery: `plan.md` Name Collision

**Evidence**: `.claude/skills/orchestration/SKILL.md:462` references `task-tracking/plan.md` — this is the **project-level roadmap plan**, NOT a task-level artifact. If we rename the task-level artifact from `implementation-plan.md` to `plan.md`, we create ambiguity:

- `task-tracking/plan.md` = project roadmap (existing)
- `task-tracking/TASK_XXX/plan.md` = task-level plan (proposed)

**Risk Assessment**: LOW. The paths are different (`task-tracking/plan.md` vs `task-tracking/TASK_XXX/plan.md`), and context always disambiguates. However, the Completion Phase section in SKILL.md says "Update `task-tracking/plan.md`" which could be confusing when the same document also discusses a task-level `plan.md`. Worth noting but not blocking.

### Existing Task Folders with `implementation-plan.md`

**21 task folders** currently contain `implementation-plan.md`:
TASK_2026_001 through TASK_2026_110 (21 files total).

These are historical artifacts. The orchestration phase detection logic reads file names to determine what phase a task is in. After renaming, phase detection will look for `plan.md` instead of `implementation-plan.md`, meaning **continuation mode will NOT detect the architect phase as complete for old tasks** unless we account for this.

---

## Architecture Design

### Design Philosophy

**Approach**: Direct replacement of artifact names across in-scope files, with Universal Lifecycle Flow added as a new top-level section in SKILL.md.

**Rationale**: The task explicitly scopes 5 files. The broader surface area (agents, examples, docs) should be handled in a follow-up task to avoid scope creep into 26 files.

**Key Decision**: Phase detection should check for BOTH `plan.md` (new) and `implementation-plan.md` (legacy fallback) in the phase detection tables. This is NOT backward compatibility architecture — it is a one-line detection change that prevents broken continuation for the 21 existing tasks. Future tasks will only produce `plan.md`.

---

## Component Specifications

### Component 1: Universal Lifecycle Flow Section (SKILL.md)

**Purpose**: Add a new top-level section documenting the 6-step type-agnostic lifecycle
**File**: `.claude/skills/orchestration/SKILL.md` (MODIFY)
**Evidence**: Task requirement from task.md lines 36-84

**What to add**: New section after the "Quick Start" section (after line 35, before "Your Role: Orchestrator") titled `## Universal Lifecycle Flow`. Content:

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

### Component 2: Artifact Rename in SKILL.md

**Purpose**: Replace `implementation-plan.md` with `plan.md` throughout SKILL.md
**File**: `.claude/skills/orchestration/SKILL.md` (MODIFY)
**Evidence**: SKILL.md:135 — phase detection table

**Changes**:
- Line 135: `| implementation-plan.md  |` -> `| plan.md                |`

No other occurrences of `implementation-plan.md` exist in SKILL.md (verified via grep).

### Component 3: Artifact Rename in task-tracking.md

**Purpose**: Update folder structure docs, ownership table, and phase detection table
**File**: `.claude/skills/orchestration/references/task-tracking.md` (MODIFY)
**Evidence**: Lines 34, 49, 150, 191, 220

**Changes (5 locations)**:

1. **Line 34** (folder structure): `implementation-plan.md       # Architecture design (Architect output)` -> `plan.md                      # Plan (Architect output — architecture, content outline, design brief)`
2. **Line 49** (folder structure): `visual-design-specification.md # Visual design (UI/UX Designer output, optional)` -> `design-spec.md               # Design specification (UI/UX Designer output, optional)`
3. **Line 150** (ownership table): `| implementation-plan.md | software-architect     | Architecture, file specifications |` -> `| plan.md | software-architect     | Plan — architecture, outline, or brief |`
4. **Line 191** (phase detection table): `| + implementation-plan.md         | Architect done         |` -> `| + plan.md                        | Architect done         |`
5. **Line 220** (continuation example): `3. Found: context.md, task-description.md, implementation-plan.md, tasks.md` -> `3. Found: context.md, task-description.md, plan.md, tasks.md`

### Component 4: Artifact Rename in strategies.md

**Purpose**: Update workflow diagrams
**File**: `.claude/skills/orchestration/references/strategies.md` (MODIFY)
**Evidence**: Lines 40, 49, 106, 194, 421

**Changes (5 locations)**:

1. **Line 40** (FEATURE flow): `Phase 3: [IF UI/UX work] nitro-ui-ux-designer --> Creates visual-design-specification.md` -> `Phase 3: [IF UI/UX work] nitro-ui-ux-designer --> Creates design-spec.md`
2. **Line 49** (FEATURE flow): `Phase 4: nitro-software-architect --> Creates implementation-plan.md` -> `Phase 4: nitro-software-architect --> Creates plan.md`
3. **Line 106** (REFACTORING flow): `nitro-software-architect --> Creates implementation-plan.md` -> `nitro-software-architect --> Creates plan.md`
4. **Line 194** (DEVOPS flow): `Phase 2: nitro-software-architect --> Creates implementation-plan.md` -> `Phase 2: nitro-software-architect --> Creates plan.md`
5. **Line 421** (creative output table): `| nitro-ui-ux-designer           | \`task-tracking/TASK_[ID]/visual-design-specification.md\`` -> `| nitro-ui-ux-designer           | \`task-tracking/TASK_[ID]/design-spec.md\``

### Component 5: Artifact Rename in checkpoints.md

**Purpose**: Update checkpoint definitions
**File**: `.claude/skills/orchestration/references/checkpoints.md` (MODIFY)
**Evidence**: Lines 20, 181, 189

**Changes (3 locations)**:

1. **Line 20** (checkpoint table): `| **2**  | Architecture Validation     | After Architect   | Approve implementation-plan.md |` -> `| **2**  | Architecture Validation     | After Architect   | Approve plan.md |`
2. **Line 181** (checkpoint 2 trigger): `After nitro-software-architect completes and creates \`implementation-plan.md\`` -> `After nitro-software-architect completes and creates \`plan.md\``
3. **Line 189** (checkpoint 2 deliverable): `**Deliverable**: task-tracking/TASK_[ID]/implementation-plan.md` -> `**Deliverable**: task-tracking/TASK_[ID]/plan.md`

### Component 6: Artifact Rename in auto-pilot/SKILL.md

**Purpose**: Update worker prompt templates and phase detection references
**File**: `.claude/skills/auto-pilot/SKILL.md` (MODIFY)
**Evidence**: Lines 1087, 1343, 1720

**Changes (3 locations)**:

1. **Line 1087** (task folder preservation list): `implementation-plan.md` -> `plan.md`
2. **Line 1343** (retry context phase detection): `implementation-plan.md exists? -> Architecture already done` -> `plan.md exists? -> Architecture already done`
3. **Line 1720** (stuck worker assessment): `implementation-plan.md exists? -> Architecture done` -> `plan.md exists? -> Architecture done`

---

## Risk Assessment

### Risk 1: Broken Continuation for 21 Existing Tasks (MEDIUM)

**Impact**: Phase detection in task-tracking.md (line 191) and SKILL.md (line 135) checks for `plan.md`. Old tasks have `implementation-plan.md`. Continuation mode will treat these tasks as if the architect phase never ran.

**Mitigation**: Add a comment or note in the phase detection tables that legacy tasks may have `implementation-plan.md` — the orchestrator should treat either filename as equivalent for phase detection. Alternatively, the Team-Leader note at SKILL.md already says "Read implementation-plan.md" — this will also need updating.

**Recommendation**: Do NOT rename the 21 existing files. They are historical. The phase detection logic in SKILL.md and task-tracking.md should mention `plan.md (or legacy implementation-plan.md)` as a one-time transition note. This is acceptable because these are specification documents read by LLM agents, not code parsed by a machine.

### Risk 2: Out-of-Scope Files (HIGH awareness, LOW severity)

**Impact**: 21 additional files reference `implementation-plan.md` but are out of scope for this task. After this task completes, agents will read their own `.md` definitions which still say `implementation-plan.md`, but the actual file in the task folder will be `plan.md`.

**Affected categories**:
- 10 agent definitions (`.claude/agents/nitro-*.md`)
- 4 additional orchestration references (agent-catalog.md, team-leader-modes.md, developer-template.md, agent-calibration.md)
- 2 example traces
- 2 content writer skills
- 3 docs files

**Mitigation**: Create a follow-up task (TASK_2026_106B or new task) to rename across all remaining files. The agents are LLMs — if the task folder has `plan.md` and their instructions say `implementation-plan.md`, they will likely still find the file. But consistency matters for reliability.

**Recommendation**: Flag this as a required follow-up in the completion report. The 5 in-scope files are the "brain" of the orchestration system; agents and examples are "limbs" that should follow.

### Risk 3: `plan.md` Name Collision with Project Roadmap (LOW)

**Impact**: `task-tracking/plan.md` (project roadmap) and `task-tracking/TASK_XXX/plan.md` (task plan) share the same filename. LLM agents might confuse them.

**Mitigation**: The paths are always fully qualified in instructions. Context disambiguates. No action needed.

---

## Batch Structure (for Team-Leader Decomposition)

### Batch 1: Core Orchestration Files (SKILL.md + task-tracking.md)

**Developer**: nitro-systems-developer
**Files**:
- `.claude/skills/orchestration/SKILL.md` — Add Universal Lifecycle Flow section + rename `implementation-plan.md` -> `plan.md`
- `.claude/skills/orchestration/references/task-tracking.md` — Rename `implementation-plan.md` -> `plan.md` + `visual-design-specification.md` -> `design-spec.md`

**Why grouped**: These two files define the core orchestration model. Changes must be consistent.

### Batch 2: Strategy and Checkpoint Files

**Developer**: nitro-systems-developer
**Files**:
- `.claude/skills/orchestration/references/strategies.md` — Rename artifact references in workflow diagrams
- `.claude/skills/orchestration/references/checkpoints.md` — Rename artifact references in checkpoint definitions

**Why grouped**: Both are reference files consumed by the orchestrator. Independent from Batch 1 content but dependent on the same naming convention.

### Batch 3: Auto-Pilot Skill

**Developer**: nitro-systems-developer
**Files**:
- `.claude/skills/auto-pilot/SKILL.md` — Rename 3 references to `implementation-plan.md` -> `plan.md`

**Why separate**: This is a different skill with its own scope. Can be verified independently.

---

## Team-Leader Handoff

### Developer Type Recommendation

**Recommended Developer**: nitro-systems-developer
**Rationale**: All changes are to orchestration specification files (agents, skills, commands, references). No application code, no backend/frontend work.

### Complexity Assessment

**Complexity**: LOW-MEDIUM
**Estimated Effort**: 1-2 hours

The changes are mostly find-and-replace with one new section to write (Universal Lifecycle Flow). The risk is in completeness — missing a reference breaks phase detection.

### Files Affected Summary

**CREATE**: None
**MODIFY**:
- `.claude/skills/orchestration/SKILL.md` (add section + 1 rename)
- `.claude/skills/orchestration/references/task-tracking.md` (5 renames + 1 `design-spec.md` rename)
- `.claude/skills/orchestration/references/strategies.md` (5 renames)
- `.claude/skills/orchestration/references/checkpoints.md` (3 renames)
- `.claude/skills/auto-pilot/SKILL.md` (3 renames)

### Out-of-Scope Follow-Up Required

A follow-up task should rename `implementation-plan.md` -> `plan.md` across:
- 10 agent definitions in `.claude/agents/`
- 4 orchestration references (agent-catalog.md, team-leader-modes.md, developer-template.md, agent-calibration.md)
- 2 example traces
- 2 content writer skill files (CODEBASE-MINING.md, BLOG-POSTS.md)
- 3 docs files (task-template-guide.md, nitro-fueled-design.md, index.html)

And `visual-design-specification.md` -> `design-spec.md` across:
- creative-trace.md
- agent-catalog.md
- strategies.md (covered in-scope)
- task-tracking.md (covered in-scope)

### Architecture Delivery Checklist

- [x] All components specified with evidence (line numbers cited)
- [x] All changes are find-and-replace with exact locations
- [x] Universal Lifecycle Flow content specified
- [x] Risk assessment complete (3 risks identified)
- [x] Out-of-scope surface area documented for follow-up
- [x] Batch structure suitable for Team-Leader decomposition
- [x] Developer type recommended (nitro-systems-developer)
- [x] Complexity assessed (LOW-MEDIUM, 1-2 hours)
