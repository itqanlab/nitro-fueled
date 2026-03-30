# Code Logic Review — TASK_2026_165

## Review Summary

Reviewed all modified files per handoff.md for logic correctness, completeness, and absence of stubs.

## Review Results

| File | Issue | Severity | Verdict |
|------|--------|-----------|---------|
| `.claude/skills/auto-pilot/SKILL.md` | None | — | PASS |
| `.claude/skills/auto-pilot/references/session-lifecycle.md` | None | — | PASS |
| `.claude/skills/auto-pilot/references/parallel-mode.md` | None | — | PASS |
| `.claude/commands/nitro-auto-pilot.md` | None | — | PASS |
| `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` | Session lifecycle content embedded inline instead of separate reference file (older structure than source) | Low | PASS |
| `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` | None | — | PASS |
| `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md` | Missing "HARD RULES" section, evaluation mode parameters, and sequential mode parameters (intentional per handoff.md - partial scaffold sync) | Low | PASS |

## Detailed Findings

### Source Files (`.claude/`)

**`.claude/skills/auto-pilot/SKILL.md`**
- ✅ Line 129: Correctly states "Session identity comes from `create_session()`"
- ✅ Line 226: References session-lifecycle.md for full startup sequence details
- ✅ No TODOs or placeholders found
- ✅ All acceptance criteria addressed

**`.claude/skills/auto-pilot/references/session-lifecycle.md`**
- ✅ Lines 21-22: Explicitly states "Create session in nitro-cortex DB — call `create_session(source='auto-pilot', task_count=N, config=JSON)` and treat the returned `session_id` as canonical for the rest of the run"
- ✅ Line 26: "Every per-session artifact and MCP call must reuse that exact DB `session_id`. Do not create a separate timestamp-based fallback ID"
- ✅ Lines 40-59: Startup sequence correctly ordered: MCP validation → Concurrent Session Guard → Stale Archive Check → Create session in DB → Session Directory creation
- ✅ No TODOs or placeholders found

**`.claude/skills/auto-pilot/references/parallel-mode.md`**
- ✅ Line 91: Correctly implements session-filtered worker counting: "Call `list_workers(session_id=SESSION_ID, status_filter: 'running', compact: true)` and derive `slots = concurrency_limit - running_workers_in_this_session`"
- ✅ Line 92: Explicitly warns "Never compute `slots` from global active workers across all sessions"
- ✅ Lines 96-98: Correctly documents cross-session deduplication: "Treat `claim_task(task_id, SESSION_ID)` as the cross-session deduplication guard. If another session already claimed the task, skip it and select the next candidate"
- ✅ No TODOs or placeholders found

**`.claude/commands/nitro-auto-pilot.md`**
- ✅ Line 80-81: Validates SESSION_ID format with regex `^SESSION_[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}$`
- ✅ Line 167: "call `create_session(source='auto-pilot', task_count=N, config=JSON)` and use the returned DB `SESSION_ID` as the canonical ID for the rest of the run"
- ✅ Line 167: Explicitly states "Do not generate a second local timestamp-based session ID"
- ✅ No TODOs or placeholders found

### Scaffold Files (`apps/cli/scaffold/`)

**`apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`**
- ✅ Lines 246-248: Correctly implements DB-backed session ID: "Store the returned DB `session_id` as `SESSION_ID` and use it everywhere that follows"
- ✅ Line 262: "The `active-sessions.md` row, session directory name, and any later `list_workers(session_id=...)` calls must all use the same `SESSION_ID` value returned by `create_session()`"
- ⚠️  **Structural difference**: Session lifecycle content is embedded inline in SKILL.md (lines 206-400+) instead of being in a separate `references/session-lifecycle.md` file. This reflects the older scaffold structure noted in handoff.md but does not affect the DB-backed session ID logic.
- ✅ No TODOs or placeholders found

**`apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`**
- ✅ Line 91: Identical to source for session-filtered worker counting
- ✅ Lines 96-98: Identical to source for `claim_task()` cross-session deduplication documentation
- ✅ No TODOs or placeholders found

**`apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md`**
- ✅ Line 53-54: Correctly validates DB-backed SESSION_ID format
- ✅ Line 105: Correctly implements DB-backed session initialization: "call `create_session(source='auto-pilot', task_count=N, config=JSON)` and use the returned DB `SESSION_ID` as the canonical ID for the rest of the run"
- ✅ Line 105: Explicitly states "Do not generate a second local timestamp-based session ID"
- ⚠️  **Incomplete sections**: Missing "STOP — HARD RULES" section, evaluation mode parameters (--evaluate, --compare, --role, --reviewer), sequential mode parameter, and some validation sections. Per handoff.md line 27: "The scaffold auto-pilot files were already older than the source `.claude` variants, so this task updates only the session/concurrency portions required by TASK_2026_165 rather than performing a full scaffold resync."
- ✅ No TODOs or placeholders found

## Acceptance Criteria Verification

| Acceptance Criteria | Status | Evidence |
|--------------------|--------|----------|
| Auto-pilot pre-flight/session lifecycle docs call `create_session()` before session directory creation | ✅ PASS | Source session-lifecycle.md lines 21-22; source command.md line 167; scaffold SKILL.md line 246; scaffold command.md line 105 |
| Continue/resume docs and command examples accept the DB-backed `SESSION_YYYY-MM-DDTHH-MM-SS` format | ✅ PASS | Source command.md lines 80-81; scaffold command.md lines 52-54 |
| Parallel-mode docs use session-filtered worker counting and session-scoped `claim_task()` semantics | ✅ PASS | Source and scaffold parallel-mode.md lines 91-98 (identical) |
| Source `.claude` files and scaffold copies are updated together | ✅ PASS | Source and scaffold parallel-mode.md are byte-identical; SKILL.md and command.md both have DB-backed session ID logic in relevant sections |

## Additional Notes

1. **No TODOs or placeholders found** in any of the modified files
2. **Logical consistency** maintained across all source and scaffold files for the session/concurrency changes
3. **Complete implementation** - all required DB-backed session ID logic is present
4. **Accurate technical descriptions** - SESSION_ID format, `create_session()` calls, and `claim_task()` semantics are correctly documented
5. **Consistent terminology** - "canonical nitro-cortex DB session ID", "DB-issued session ID", "SESSION_YYYY-MM-DDTHH-MM-SS format" used consistently

| Overall Verdict | PASS |
