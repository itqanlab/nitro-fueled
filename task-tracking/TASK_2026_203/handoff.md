# Handoff — TASK_2026_203

## Files Changed
- .claude/skills/auto-pilot/references/session-lifecycle.md (modified — added step 3a close_stale_sessions zombie flush + log entry)
- apps/dashboard-api/src/dashboard/cortex.types.ts (modified — last_heartbeat added to CortexSession and RawSession)
- apps/dashboard-api/src/dashboard/cortex-queries-task.ts (modified — last_heartbeat in SESSION_COLS and mapSession)
- apps/dashboard-api/src/dashboard/cortex.service.ts (modified — closeStaleSession() method with transactional write)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (modified — POST /api/sessions/close-stale endpoint)
- apps/dashboard/src/app/models/api.types.ts (modified — last_heartbeat on CortexSession, readonly on all Cortex* fields)
- apps/dashboard/src/app/services/api.service.ts (modified — closeStaleSession() method)
- apps/dashboard/src/app/models/sessions-panel.model.ts (modified — lastHeartbeat?: string | null on ActiveSessionSummary)
- apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts (modified — cortexSessions signal, heartbeatStatusMap computed, 30s now interval, 5min close-stale interval)
- apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html (modified — heartbeat indicator block in active sessions loop)
- apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.scss (modified — heartbeat-warn/stale styles using design tokens)

## Commits
- (staged, not yet committed)

## Decisions
- `last_heartbeat` flows from cortex DB → CortexSession type → SESSION_COLS → mapSession → DashboardController → ApiService → sessions-panel (via getCortexSessions cross-reference)
- Sessions panel fetches cortex sessions separately (best-effort) for heartbeat data rather than modifying the getActiveSessionsEnhanced mock path
- closeStaleSession DB write uses its own non-readonly Database connection; wraps multi-row update in a transaction for atomicity
- TTL floor is `>= 1` minute to prevent fractional-minute values from nuking healthy sessions
- heartbeatStatusMap: 0-1m = no label, 1-2m = plain, 2-10m = amber (heartbeat-warn), 10m+ = red (heartbeat-stale), null/NaN = red "No heartbeat"

## Known Risks
- getCortexSessions() for heartbeat data is best-effort — if cortex DB is unavailable, all running sessions show "No heartbeat" rather than no label
- update_heartbeat call site in SKILL.md parallel-mode.md was already present (Step 6 line 2); the task was already satisfied for AC-1
