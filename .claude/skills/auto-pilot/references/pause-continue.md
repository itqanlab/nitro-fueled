# Pause and Continue Modes — auto-pilot

## Pause Mode

When `--pause` is passed, the supervisor sets a `pause_requested = true` flag in memory at startup. The loop proceeds normally — the supervisor spawns and monitors workers as usual. At the END of each monitoring cycle (after Step 6 completes), check `pause_requested`:

**IF `pause_requested` is true:**

1. Write `Loop Status: PAUSED` to `{SESSION_DIR}state.md` (keep all other state intact).
2. Append to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR PAUSED — {N} active workers still running, session preserved |`
3. Remove this session's row from `task-tracking/active-sessions.md`.
4. Display:
   ```
   SUPERVISOR PAUSED
   -----------------
   Active workers: {N} (still running — NOT killed)
   Session: {SESSION_ID}
   Resume with: /auto-pilot --continue {SESSION_ID}
   ```
5. **Do NOT run Step 8** (session stop). Exit the loop without committing session artifacts — they will be committed by `--continue` or the stale archive check.

> **Note**: Pause preserves all active workers. When you resume with `--continue`, the supervisor reconciles worker state — workers that completed while paused are handled by the normal completion handler.

---

## Continue Mode

When `--continue [SESSION_ID]` is passed:

### Finding the Session to Resume

1. **If SESSION_ID is provided**: look for `task-tracking/sessions/{SESSION_ID}/state.md`. If not found, print error and exit.
2. **If SESSION_ID is omitted**: scan `task-tracking/sessions/` for all directories matching `SESSION_{YYYY-MM-DD}_{HH-MM-SS}`. Read each `state.md` and look for any `Loop Status` that is NOT `COMPLETE`, `ABORTED`, or `CANCELLED` (i.e. `PAUSED`, `STOPPED`, `RUNNING`, or missing). Select the most recently created one. `RUNNING` is valid here — it means the session was killed before it could write a clean stop. If none found, print error and exit.

### Resume Sequence

1. **MCP validation** (same as normal startup — HARD FAIL if MCP unavailable).
2. **Concurrent Session Guard** (same check — warn if another supervisor is active).
3. **Read state.md** from the located session. Restore all state:
   - Active workers, completed/failed task lists, retry counters, config
   - `SESSION_DIR = task-tracking/sessions/{SESSION_ID}/`
4. **Re-register in `task-tracking/active-sessions.md`** (append a new row for this resumed session, same SESSION_ID).
5. Append to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR RESUMED — {N} active workers, {N} completed, {N} failed |`
6. Write `Loop Status: RUNNING` to `{SESSION_DIR}state.md`.
7. **Skip Startup Sequence steps 1–4** (no fresh pre-flight, no stale-archive check, no new session dir, no log-stale-results). Go directly to **Core Loop Step 1: Read State** (worker reconciliation) to sync with MCP, then continue normally.

> **Continue skips pre-flight**: The session was already validated when it started. Tasks that were valid then are assumed still valid (or will fail the JIT gate if they changed).
