# Code Logic Review — TASK_2026_099

**Reviewer**: nitro-code-logic-reviewer
**Date**: 2026-03-28
**Score**: 6/10

## Summary

Implementation covers most acceptance criteria but has one critical gap: the blocked-dependency guardrail for `/orchestrate` is missing. Auto-pilot SKILL.md correctly implements blocked dependency detection, orphan blocked task warnings, and per-task timing extraction. Documentation files are consistent.

---

## Critical Issues

### LOGIC-001: Missing Orchestration Blocked-Dependency Guardrail (Severity: HIGH)

**Location**: `.claude/skills/orchestration/SKILL.md`

**Description**: Acceptance criterion states: "Orchestration SKILL.md refuses to start a task that depends on a BLOCKED task, with clear warning." This is NOT implemented. The orchestration SKILL.md has no logic to:
1. Check if the target task has transitive dependencies on BLOCKED tasks
2. Warn the user and refuse to proceed if such dependencies exist

**Expected**: Before starting `/orchestrate TASK_YYYY_NNN`, the skill should:
1. Walk the task's dependency chain
2. If any dependency has status BLOCKED, display warning and refuse to proceed
3. Log the blocked dependency chain

**Evidence**: Reviewed lines 1-603 of orchestration/SKILL.md. The "Core Orchestration Loop" section (line 104+) and "CONTINUATION: Phase Detection" (line 128+) have no dependency-status checks. The review-context.md also notes: "The task file scope includes this file... However, no commits from TASK_2026_099 touched this file."

**Impact**: Users can start tasks with broken dependency chains, leading to wasted dev cycles.

---

## Warnings

### LOGIC-W001: Orphan Blocked Task Warning Not in Orchestration Skill

**Location**: `.claude/skills/orchestration/SKILL.md`

**Description**: The task description specifies orphan blocked task warnings should appear "on every `/orchestrate` or `/auto-pilot` invocation." Auto-pilot correctly implements this (Step 9-11 in auto-pilot SKILL.md). However, orchestration SKILL.md does not display these warnings.

**Impact**: Users invoking `/orchestrate` directly (not via auto-pilot) won't see orphan blocked task warnings.

---

## Verified Correct

### 1. BLOCKED_BY_DEPENDENCY Classification (auto-pilot SKILL.md:491)

```markdown
| **BLOCKED_BY_DEPENDENCY** | Status is CREATED **OR** IMPLEMENTED **AND** has a transitive dependency on a BLOCKED task |
```

Logic is correct: tasks waiting for build (CREATED) or review (IMPLEMENTED) that depend on a BLOCKED task are properly classified without being marked as failed.

### 2. Blocked Dependency Detection Algorithm (auto-pilot SKILL.md:509-518)

Steps 4-6 correctly:
- Walk transitive dependency chains
- Detect BLOCKED ancestors
- Log blocked dependency chains
- Hold (not fail) blocked-by-dependency tasks

### 3. Orphan Blocked Task Detection (auto-pilot SKILL.md:519-533)

Steps 7-11 correctly:
- Identify BLOCKED tasks with no downstream dependents
- Display warning at session start
- Log each orphan blocked task
- Allow spawning to continue (non-blocking warning)

### 4. Per-Task Timing Extraction (auto-pilot SKILL.md:620-654)

Step 5a-jit correctly:
- Extracts Poll Interval, Health Check Interval, Max Retries from task.md
- Treats absent/"default" as global config values
- Applies Duration String Parsing rules

### 5. Duration String Parsing (auto-pilot SKILL.md:639-652)

Parsing rules are correct:
- Pattern: `^(\d+)(s|m)$`
- Poll Interval: min 10s, max 10m (600s)
- Health Check Interval: min 1m (60s), max 30m (1800s)
- Max Retries: 0-5, values >5 clamped to 5 with warning

### 6. Provider Routing with preferred_tier (auto-pilot SKILL.md:684-712)

Step 5d correctly:
- Reads `preferred_tier` field from task.md
- Routes based on light/balanced/heavy values
- Falls back to Complexity field if absent/empty/"auto"
- Provider Routing Table uses preferred_tier instead of Complexity

### 7. Task Template Consistency (task-tracking/task-template.md)

Metadata table includes all required fields:
- `preferred_tier` with values `[light | balanced | heavy | auto]`
- `Poll Interval` with format guidance
- `Health Check Interval` with format guidance
- `Max Retries` with 0-5 range

Comment blocks correctly document:
- preferred_tier mapping (light=glm-4.7, balanced=glm-5, heavy=claude-opus-4-6)
- Duration string formats
- Fallback behavior

### 8. Documentation Consistency (docs/task-template-guide.md)

Field Reference table (lines 65-76) correctly:
- Lists Poll Interval, Health Check Interval, Max Retries
- Maps consumer to "Auto-pilot (Step 5a-jit)"
- Documents default values

"When to Use Custom Timing Values" section (lines 92-145) provides correct guidance for each timing field with use cases.

"Fallback Behavior" subsection (lines 138-144) correctly documents:
- `default` sentinel behavior
- Invalid value handling (warning + fallback)
- Backward compatibility guarantee

---

## Logic Flow Verification

### Test Case: Task with BLOCKED Dependency

1. TASK_A has status BLOCKED (failed 3 times)
2. TASK_B depends on TASK_A
3. TASK_B has status CREATED

**Expected flow in auto-pilot**:
- Step 3: TASK_B classified as BLOCKED_BY_DEPENDENCY
- Step 3 line 515: Log "BLOCKED DEPENDENCY — TASK_A: is BLOCKED and blocks TASK_B"
- Step 4: TASK_B excluded from Build Queue
- Step 5: TASK_B not spawned

**Verified**: Auto-pilot SKILL.md handles this correctly.

**Expected flow in orchestrate**:
- User runs `/orchestrate TASK_B`
- Skill should check dependency chain
- Skill should warn and refuse to proceed

**NOT VERIFIED**: Orchestration SKILL.md has no such check (LOGIC-001).

### Test Case: Orphan BLOCKED Task

1. TASK_A has status BLOCKED
2. No other task depends on TASK_A

**Expected flow in auto-pilot**:
- Step 7: TASK_A identified as orphan blocked
- Step 9: Warning displayed
- Step 10: Log "ORPHAN BLOCKED — TASK_A: blocked with no dependents, needs manual resolution"
- Step 11: Spawning continues

**Verified**: Auto-pilot SKILL.md handles this correctly.

### Test Case: Per-Task Timing Override

1. TASK_A has `Max Retries: 4` in task.md
2. Global --retries is 2

**Expected flow**:
- Step 5a-jit extracts Max Retries = 4
- Step 5f records max_retries=4 in state.md
- Worker uses 4 retries for this task

**Verified**: Auto-pilot SKILL.md handles this correctly.

---

## Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| task-template.md has timing fields | PASS | Lines 15-17 |
| docs/task-template-guide.md documents timing | PASS | Lines 74-76, 92-145 |
| Auto-pilot Step 5a-jit extracts timing | PASS | Lines 620-654 |
| Auto-pilot monitoring uses per-task intervals | PASS | Step 5f records per-task values |
| Auto-pilot Step 3 classifies BLOCKED_BY_DEPENDENCY | PASS | Line 491 |
| Auto-pilot logs blocked dependency chains | PASS | Line 515 |
| Orchestration SKILL.md refuses blocked-dep tasks | **FAIL** | Not implemented (LOGIC-001) |
| Max Retries clamped to 5 | PASS | Lines 649-652 |
| Backward compatibility (no per-task config) | PASS | "default" sentinel handled |
| Orphan blocked warning in auto-pilot | PASS | Lines 519-533 |
| Orphan blocked warning in orchestrate | **WARN** | Not implemented (LOGIC-W001) |

---

## Recommendations

1. **Implement blocked-dependency guardrail in orchestration SKILL.md** (LOGIC-001)
   - Add dependency-chain walk in "CONTINUATION: Phase Detection"
   - Before any agent invocation, check if target task has BLOCKED ancestors
   - If BLOCKED ancestors found, display warning and exit

2. **Consider adding orphan blocked warning to orchestration skill** (LOGIC-W001)
   - Match the auto-pilot behavior for consistency
   - Lower priority than LOGIC-001

---

## Conclusion

The auto-pilot SKILL.md implementation is solid and handles all the specified blocked dependency and timing scenarios correctly. However, the orchestration SKILL.md is missing the critical blocked-dependency guardrail required by the acceptance criteria. This is a significant gap that leaves users unprotected when invoking `/orchestrate` directly.

**Recommendation**: Do not mark task COMPLETE until LOGIC-001 is addressed.
