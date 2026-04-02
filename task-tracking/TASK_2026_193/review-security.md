# Security Review — TASK_2026_193

## Files Changed
- `.claude/skills/auto-pilot/references/session-lifecycle.md` (modified, +3 lines)
- `.claude/skills/auto-pilot/SKILL.md` (modified, +4 lines)
- `packages/mcp-cortex/src/tools/tasks.ts` (implemented orphan release logic)

## Summary
Implemented orphaned claim recovery functionality that automatically releases tasks claimed by dead sessions or with expired TTL. The implementation includes fixes for atomicity, race conditions, and proper event logging.

## Vulnerability Analysis

| Category | Finding | Severity | Details |
|----------|---------|----------|---------|
| SQL Injection | PASS | N/A | All queries use parameterized statements throughout `detectOrphanedClaims` and `handleReleaseOrphanedClaims`. No user input is concatenated into SQL strings. |
| Atomicity | PASS | N/A | Release loop is wrapped in a transaction (line 374). If any step fails, no partial releases are committed, preventing inconsistent state. |
| Race Condition | PASS | N/A | Guard against concurrent release (lines 380-389): UPDATE includes `WHERE id = ? AND session_claimed IS NOT NULL` to skip tasks already reclaimed/released between detection and release. Prevents spurious event logging. |
| Event Logging | PASS | N/A | Events logged with `event_type='orphan_recovery'` and proper payload format (lines 393-400). Includes `was_claimed_by` and `stale_for_ms` details under 'details' key for auditability. |
| Authorization | PASS | N/A | Tool requires MCP server access. Authorization is trust-based (local repo access = task access). This is appropriate for the intended use case. |
| Information Disclosure | PASS | N/A | Returns list of released task IDs only. No sensitive task content exposed. |
| Denial of Service | PASS | N/A | Tool is only called during supervisor startup as a best-effort operation. Repeated calls would have minimal impact (idempotent operation). |
| Workflow Bypass | PASS (Acknowledged) | Low | Implementation always resets released tasks to 'CREATED' regardless of pre-claim status (line 382). Acknowledged in handoff as intentional behavior. Could theoretically be exploited by crashing a supervisor mid-workflow, but requires repo access + ability to crash supervisors. Mitigated by: (1) local-only environment, (2) requires concurrent supervisor startup, (3) no sensitive operations bypassed, (4) acknowledged design decision. |
| Data Integrity | PASS | N/A | Status reset to 'CREATED' is intentional and documented. Original status is preserved in event log under 'details' for audit trail. |

## Additional Observations

### Best Practices Followed
- Transactional atomicity ensures consistent state
- Proper parameterized queries prevent SQL injection
- Event logging provides audit trail for all releases
- Concurrent release guards prevent race conditions
- Idempotent operation (safe to call multiple times)

### Known Risks (from handoff)
- Orphan release is "best-effort" - if it fails, only a warning is logged. Orphaned claims may persist if the tool fails.
- Tasks with NULL `claim_timeout_ms` are only released if their session is dead, never due to TTL expiration.
- Released tasks reset to 'CREATED' status (acknowledged design decision).

## Overall Verdict

| Verdict | PASS |
|---------|------|

## Rationale
The implementation is secure for its intended use case. All critical vulnerabilities (atomicity, race conditions, SQL injection) have been addressed through proper transaction wrapping, concurrent release guards, and parameterized queries. The workflow bypass concern is acknowledged but mitigated by the local-only environment and trust-based authorization model. The system is appropriate for a developer tool running in a controlled local repository.
