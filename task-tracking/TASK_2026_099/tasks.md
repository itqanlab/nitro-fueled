# Development Tasks - TASK_2026_099

**Total Tasks**: 10 | **Batches**: 3 | **Status**: 3/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- [Task metadata table pattern]: Verified - task-template.md:5-14 uses pipe-table format
- [JIT extraction pattern]: Verified - SKILL.md:591-607 extracts Complexity, Model, Provider, File Scope, Testing
- [Duration string pattern]: Verified - auto-pilot.md:27 uses `Nm` format for --interval
- [Dependency graph pattern]: Verified - SKILL.md:477-505 builds and walks dependency graph
- [Status classification pattern]: Verified - SKILL.md:480-491 has classifications including BLOCKED
- [Pre-flight validation pattern]: Verified - auto-pilot.md:79-197 runs validation before Supervisor

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Duration string parsing edge cases (e.g., "0s", "abc") | LOW | Task 1.2 adds validation with fallback to defaults |
| Transitive dependency walk performance | LOW | Task 2.1 includes caching strategy in algorithm |
| Orphan detection false positives | LOW | Task 2.2 uses exact dependency graph walking |

---

## Batch 1: Task Template and Documentation IMPLEMENTED

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: None

### Task 1.1: Add Timing Fields to Task Template IMPLEMENTED

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md
**Spec Reference**: implementation-plan.md:66-99
**Pattern to Follow**: Existing Metadata table at lines 5-14

**Quality Requirements**:
- Fields must be optional with "default" sentinel value
- Valid Poll Interval range: 10s to 10m
- Valid Health Check Interval range: 1m to 30m
- Valid Max Retries range: 0-5 (clamped if exceeds 5)
- Include guidance comments explaining each field

**Validation Notes**:
- Duration string format follows existing pattern: `Ns` or `Nm`

**Implementation Details**:
- Add 3 new rows to the Metadata table after the Testing field
- Add guidance comments explaining when to use custom values
- Fields: Poll Interval, Health Check Interval, Max Retries

---

### Task 1.2: Document New Fields in Template Guide IMPLEMENTED

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/docs/task-template-guide.md
**Spec Reference**: implementation-plan.md:196-228
**Pattern to Follow**: Existing Field Reference table at lines 64-73

**Quality Requirements**:
- Add Poll Interval, Health Check Interval, Max Retries to Field Reference table
- Document consumer as "Auto-pilot (Step 5a-jit)"
- Provide usage guidance (when to use custom values)
- Explain fallback to global defaults

**Validation Notes**:
- Document that invalid duration strings fall back to global defaults

**Implementation Details**:
- Add 3 rows to Field Reference table
- Add new section "When to Use Custom Timing Values" with guidance

---

**Batch 1 Verification**:
- task-template.md has 3 new fields in Metadata table
- task-template-guide.md has updated Field Reference table
- task-template-guide.md has "When to Use Custom Timing Values" section

---

## Batch 2: Auto-Pilot Skill Modifications COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 5 | **Dependencies**: Batch 1 (template changes provide field definitions)

### Task 2.1: Add BLOCKED_BY_DEPENDENCY Classification COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md
**Spec Reference**: implementation-plan.md:229-270
**Pattern to Follow**: Existing classification table at SKILL.md:480-491

**Quality Requirements**:
- Add BLOCKED_BY_DEPENDENCY classification to table
- Add blocked dependency detection algorithm to Step 3
- Walk transitive dependencies to find tasks with BLOCKED dependencies
- Log blocked dependency chains clearly
- BLOCKED_BY_DEPENDENCY tasks do NOT count against retry limit

**Validation Notes**:
- Transitive walk must complete in under 100ms for 200 tasks
- Use caching/visited-set to avoid redundant walks

**Implementation Details**:
- Add to classification table: `| **BLOCKED_BY_DEPENDENCY** | Status is CREATED/IMPLEMENTED AND has transitive dependency on BLOCKED task |`
- Add "Blocked Dependency Detection" subsection after Step 3 dependency validation
- Implement transitive walk with visited-set caching
- Add log entry pattern for blocked dependency chains

---

### Task 2.2: Add Orphan BLOCKED Task Warning COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md
**Spec Reference**: implementation-plan.md:272-333
**Pattern to Follow**: Existing log entry pattern at SKILL.md:89-151

**Quality Requirements**:
- Separate BLOCKED tasks into "blocking others" vs "orphan blocked"
- Display non-blocking warning at start of every Supervisor session
- Include task ID, reason, and action prompt
- Log to session log
- No warning if no orphan blocked tasks exist

**Validation Notes**:
- Orphan detection computed during Step 3 (no separate pass)
- Classification uses exact dependency graph walking

**Implementation Details**:
- Add "Orphan Blocked Warning" section after Session Lifecycle startup
- Add log entry pattern: `| Orphan blocked task detected | ... |`
- Warning format matches specification in implementation-plan.md:286-295

---

### Task 2.3: Add Timing Field Extraction to Step 5a-jit COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md
**Spec Reference**: implementation-plan.md:103-148
**Pattern to Follow**: Existing JIT extraction at SKILL.md:591-607

**Quality Requirements**:
- Extract Poll Interval, Health Check Interval, Max Retries from task.md
- Validate duration string format (parse to seconds)
- Validate ranges and clamp Max Retries to 5
- Fall back to global defaults when "default" or absent
- Invalid duration strings must NOT block spawning

**Validation Notes**:
- Duration pattern: `^(\d+)(s|m)$`
- Poll Interval: min 10s, max 10m (600s)
- Health Check Interval: min 1m (60s), max 30m (1800s)
- Max Retries: clamp to 5, log warning

**Implementation Details**:
- Extend Step 5a-jit section to extract 3 new fields
- Add "Duration String Parsing" subsection with validation rules
- Add "Max Retries Parsing" subsection with clamping logic
- Log warning for invalid values, continue with defaults

---

### Task 2.4: Add Per-Worker Monitoring Configuration COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md
**Spec Reference**: implementation-plan.md:149-193
**Pattern to Follow**: Existing monitoring loop at SKILL.md:736-834

**Quality Requirements**:
- Store per-task timing in Active Workers table
- Use per-task Poll Interval for event wait (event-driven mode)
- Use per-task Health Check Interval for stuck detection timing
- Use per-task Max Retries for retry limit comparison
- Fall back to global defaults when per-task value is "default"

**Validation Notes**:
- Per-task values extracted in Step 5a-jit
- Active Workers table needs new columns for timing values

**Implementation Details**:
- Add columns to Active Workers table: `poll_interval`, `health_check_interval`, `max_retries`
- Modify Step 6 event-driven mode to use per-task poll interval
- Modify Step 6 health check timing to use per-task health_check_interval
- Modify retry limit check to use per-task max_retries
- Update Step 5f to store timing values in state.md

---

### Task 2.5: Add Orphan Blocked Warning to Command Pre-Flight COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/auto-pilot.md
**Spec Reference**: implementation-plan.md:272-333
**Pattern to Follow**: Existing pre-flight validation at auto-pilot.md:79-197

**Quality Requirements**:
- Add orphan blocked detection to Step 4 pre-flight validation
- Display warning in Pre-Flight Report
- Warning is non-blocking (proceeds with run)
- Include task ID, reason, and action prompt

**Validation Notes**:
- Runs in command entry point, not inside Supervisor context
- Computed during dependency graph building (no separate pass)

**Implementation Details**:
- Add Step 4c-ii: "Orphan BLOCKED Task Detection"
- For each BLOCKED task, check if any other task depends on it
- If no dependents: add to warnings
- Add warning section to Pre-Flight Report format

---

**Batch 2 Verification**:
- SKILL.md has BLOCKED_BY_DEPENDENCY classification
- SKILL.md has orphan blocked warning logic
- SKILL.md Step 5a-jit extracts timing fields
- SKILL.md Step 6 uses per-task timing values
- auto-pilot.md Step 4 has orphan blocked detection

---

## Batch 3: Orchestration Skill Guardrail COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 3 | **Dependencies**: Batch 2 (blocked dependency classification pattern)

### Task 3.1: Add Blocked Dependency Guardrail COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md
**Spec Reference**: implementation-plan.md:335-386
**Pattern to Follow**: Existing mode detection at SKILL.md:103-145

**Quality Requirements**:
- Check if requested task has BLOCKED dependencies before spawning work
- Walk transitive dependencies (dependencies of dependencies)
- Refuse to proceed with clear warning
- Display blocking chain if transitive BLOCKED found
- STOP and do not proceed if guardrail triggers

**Validation Notes**:
- Guardrail runs in CONTINUATION mode before any agent invocation
- Transitive walk uses same pattern as auto-pilot SKILL.md

**Implementation Details**:
- Add "Blocked Dependency Guardrail" section after Phase Detection
- Read task.md Dependencies, check each dependency status
- Walk transitive dependencies recursively
- If BLOCKED found: display warning and STOP
- Include blocking chain in warning message

---

### Task 3.2: Add Orphan Blocked Warning to Orchestration Startup COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md
**Spec Reference**: implementation-plan.md:272-333
**Pattern to Follow**: Existing session directory setup at SKILL.md:216-239

**Quality Requirements**:
- Display orphan blocked warning at start of every /orchestrate invocation
- Read registry and identify all BLOCKED tasks
- Check if any other task depends on each BLOCKED task
- If BLOCKED tasks with no dependents exist: display warning
- Use same warning format as auto-pilot

**Validation Notes**:
- Warning runs after Session Directory setup
- Same algorithm as auto-pilot orphan detection

**Implementation Details**:
- Add "Orphan BLOCKED Task Warning" section after Session Directory Setup
- Read registry.md to find BLOCKED tasks
- For each BLOCKED task, scan all task.md files for dependencies
- If no dependents found: add to orphan list
- Display warning if orphan list non-empty

---

### Task 3.3: Add Log Entry Patterns for New Events COMPLETE

**File**: /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md
**Spec Reference**: implementation-plan.md:89-151, 272-333
**Pattern to Follow**: Existing log entry table at SKILL.md:89-151

**Quality Requirements**:
- Add log entry pattern for orphan blocked task detected
- Add log entry pattern for blocked dependency detected
- Add log entry pattern for per-task timing field extraction issues
- Use pipe-table row format matching existing entries

**Validation Notes**:
- Log entries are append-only to session log
- Format: `| {HH:MM:SS} | auto-pilot | {EVENT} — {details} |`

**Implementation Details**:
- Add entries to log entry table in Session Log section:
  - Orphan blocked task detected
  - Blocked dependency detected (direct)
  - Blocked dependency detected (transitive)
  - Invalid timing field value (fallback to default)
  - Max retries value clamped

---

**Batch 3 Verification**:
- orchestration/SKILL.md has blocked dependency guardrail
- orchestration/SKILL.md has orphan blocked warning at startup
- auto-pilot/SKILL.md has new log entry patterns

---

## Summary

| Batch | Description | Tasks | Status |
|-------|-------------|-------|--------|
| 1 | Task Template and Documentation | 2 | IMPLEMENTED |
| 2 | Auto-Pilot Skill Modifications | 5 | COMPLETE |
| 3 | Orchestration Skill Guardrail | 3 | COMPLETE |

**Total**: 10 tasks across 3 batches
