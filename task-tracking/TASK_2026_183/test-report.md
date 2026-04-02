# Test Report — TASK_2026_183

| Status | PASS |
|--------|------|

## Test Results

### progress-center.helpers.spec.ts (73 tests)

#### UI_PHASES constant
- should contain exactly 5 phases in pipeline order: PASS

#### buildPhaseAverages()
- should return default averages when no timing data is provided: PASS
- should override PM average from timing data: PASS
- should override Dev average from timing data: PASS
- should derive QA and Review from Review timing data: PASS
- should override Review average from Completion timing data: PASS
- should handle null avg_duration_minutes by using Dev default: PASS

#### collectSessionTaskIds()
- should collect task IDs from workers: PASS
- should collect task IDs from events matching the session: PASS
- should not include task IDs from events belonging to other sessions: PASS
- should deduplicate task IDs appearing in both workers and events: PASS
- should skip workers with empty task_id: PASS
- should skip events with null task_id: PASS

#### currentPhase()
- should return Review for COMPLETE tasks: PASS
- should return QA for IN_REVIEW tasks: PASS
- should return QA for FIXING tasks: PASS
- should return QA when a running review worker exists: PASS
- should return Dev when Dev phase has been logged: PASS
- should return Architect when Architect phase has been logged but not Dev: PASS
- should return PM when only PM phase has been logged: PASS
- should default to PM when no phases have been logged: PASS

#### phaseStates()
- should mark all phases as complete for a COMPLETE task: PASS
- should mark all phases as complete for a FAILED task: PASS
- should mark all phases as complete for a CANCELLED task: PASS
- should mark PM as complete and Architect as active when current is Architect: PASS
- should mark first phase (PM) as active when current is PM: PASS
- should include exactly 5 phase entries: PASS

#### progressPercent()
- should return 100 for terminal task status COMPLETE: PASS
- should return 100 for terminal task status FAILED: PASS
- should return 0 when all phases are pending: PASS
- should return 100 when all phases are complete: PASS
- should return 50 when half the phases are complete and one is active: PASS
- should calculate partial progress with only an active phase: PASS

#### remainingEta()
- should return null when all phases are complete: PASS
- should return half the phase average for an active phase: PASS
- should return full sum for all pending phases: PASS
- should fall back to 5 for unknown phase keys: PASS

#### maxEta()
- should return null when no tasks have ETA: PASS
- should return null for empty task list: PASS
- should return the maximum ETA value: PASS
- should ignore null ETA values when some tasks have values: PASS

#### sessionStatus()
- should return completed when session loop_status is not running: PASS
- should return stuck when stuckWorkers > 0: PASS
- should return warning when heartbeat is stale: PASS
- should return running when heartbeat is fresh and no stuck workers: PASS
- should return running when last_heartbeat is null and no stuck workers: PASS

#### isWorkerStuck()
- should return false for a non-running worker: PASS
- should return false when session has no heartbeat: PASS
- should return false when heartbeat is fresh: PASS
- should return true when worker is running and heartbeat is stale: PASS

#### isSessionActive()
- should return true for a running session with no end time: PASS
- should return false when loop_status is not running: PASS
- should return false when ended_at is set: PASS

#### minutesBetween()
- should return 0 when start equals end: PASS
- should return correct minutes for a 30-minute interval: PASS
- should return 0 (not negative) when end is before start: PASS
- should return 60 for a 1-hour interval: PASS

#### activitySummary()
- should generate summary with task_id as target: PASS
- should fall back to session_id when task_id is null: PASS
- should include phase when present in data: PASS
- should include status when present in data: PASS
- should include both phase and status when both present in data: PASS
- should not include non-string phase/status values: PASS

#### activityTone()
- should return error for event types containing "fail": PASS
- should return error for event types containing "error": PASS
- should return warning for event types containing "warn": PASS
- should return warning for event types containing "stuck": PASS
- should return success for event types containing "complete": PASS
- should return success for event types containing "implemented": PASS
- should return info for neutral event types: PASS

#### isTerminalTaskStatus()
- should return true for COMPLETE: PASS
- should return true for FAILED: PASS
- should return true for CANCELLED: PASS
- should return false for IN_PROGRESS: PASS
- should return false for IN_REVIEW: PASS
- should return false for CREATED: PASS
- should return false for BLOCKED: PASS

---

### progress-center.service.spec.ts (34 tests)

#### getSnapshot() — cortex unavailable
- should return null when getSessions returns null: PASS
- should return null when getWorkers returns null: PASS
- should return null when getTasks returns null: PASS
- should return null when getPhaseTiming returns null: PASS
- should return null when getEventsSince returns null: PASS

#### getSnapshot() — empty data
- should return a valid snapshot with no active sessions: PASS
- should have a generatedAt ISO timestamp: PASS
- should have a healthy tone with no sessions or failed tasks: PASS

#### getSnapshot() — active session
- should include a running session in the snapshot: PASS
- should not include sessions that have ended: PASS
- should not include sessions with loop_status other than running: PASS
- should report active workers count correctly: PASS
- should use task title from task map when available: PASS
- should fall back to task ID as title when task is not in map: PASS
- should exclude tasks where getTaskTrace returns null: PASS
- should report source from session data: PASS

#### health tone logic
- should return healthy tone when no stuck workers, failed tasks, or retrying workers: PASS
- should return critical tone when there are failed tasks: PASS
- should return warning tone when there are retrying workers (no stuck/failed): PASS
- should count active sessions in health: PASS

#### activity feed
- should include events belonging to active sessions: PASS
- should exclude events from sessions that are not active: PASS
- should return events in reverse chronological order (most recent first): PASS
- should cap activity feed at 40 events: PASS
- should map event fields to activity shape correctly: PASS

#### session progress calculations
- should report 0 completedTasks when no tasks are terminal: PASS
- should count completed tasks correctly: PASS
- should use Waiting for worker activity as currentTaskLabel when no tasks are present: PASS
- should set currentPhase to PM as default when no tasks exist: PASS
- should sort tasks by progressPercent descending: PASS

---

## Summary

All 107 tests pass across 2 test suites (73 helper tests, 34 service tests). The helpers file is fully covered: phase average derivation, phase state machine, progress percent scoring, ETA calculation, session status heuristics, stuck-worker detection, activity tone classification, and terminal-status detection. The service tests cover all cortex-unavailable null paths, snapshot assembly with active and inactive sessions, health tone logic (healthy / warning / critical), activity feed filtering and ordering, and session progress calculations.

Test files:
- `apps/dashboard-api/test/dashboard/progress-center.helpers.spec.ts`
- `apps/dashboard-api/test/dashboard/progress-center.service.spec.ts`
