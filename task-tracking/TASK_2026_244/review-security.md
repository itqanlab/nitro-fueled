# Security Review — TASK_2026_244

## Overall Score: 7/10

## Assessment

Three files reviewed. Authentication is present on the WebSocket handlers and broadcast scope is correctly limited to session rooms. The primary concern is that model name fields (`supervisorModel`, `prepModel`, `implementModel`, `implementFallbackModel`, `reviewModel`) accept arbitrary-length, unconstrained strings — no length cap and no character allowlist. Depending on how `workerManager.spawnWorker` consumes the `model` value, this is a potential injection vector. A secondary concern is that `sessionId` in `join-session`/`leave-session` is type-checked but not format-validated, allowing clients to subscribe to arbitrary room names.

---

## Findings

### [SERIOUS] Model name fields accept unbounded, unrestricted strings

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:254-260` (create) and `:324-330` (updateConfig)
- **Severity**: Serious
- **Description**: The validation loop for `['prepModel', 'implementModel', 'implementFallbackModel', 'reviewModel', 'supervisorModel']` checks only `typeof body[key] !== 'string'`. There is no maximum length check and no character allowlist. A caller can submit a model name of arbitrary length (including megabyte-scale values), and can include characters such as spaces, shell metacharacters (`&`, `;`, `|`, `$`, `` ` ``), or flag-like prefixes (`--`).
- **Path to impact**: The validated value flows through `AutoPilotService.createSession` → `SupervisorConfig.supervisor_model` → `SessionRunner.spawnForCandidate` → `workerManager.spawnWorker({ model, ... })`. If the worker manager assembles a shell command using the `model` value (e.g., `claude --model <value>`), malicious content could inject CLI flags or, in an `exec`-based invocation, shell commands. Even with array-based `spawn`, an unbounded value can cause argument-too-long failures or fill the SQLite events log with garbage data at scale.
- **Fix**: Add a length cap (e.g., max 128 characters) and a character allowlist (e.g., `/^[a-zA-Z0-9._:-]{1,128}$/`) for all model name fields in both `parseCreateBody` and `parseUpdateConfigBody`. This is consistent with the pattern already applied to `priority` (allowlist) and `concurrency` (range check).

---

### [SERIOUS] `sessionId` in join-session/leave-session has no format validation

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:84-93` (join) and `:101-111` (leave)
- **Severity**: Serious
- **Description**: Both handlers accept any string as `sessionId` — only `typeof === 'string'` is checked. An authenticated client can call `join-session` with an arbitrary room name (e.g., `"__all__"`, `"admin"`, a UUID belonging to another user's session, or a crafted string) and will be subscribed to that Socket.IO room. Since `emitSupervisorEvent` routes events to `server.to(event.sessionId)`, any client subscribed to a room matching a real session ID will receive all supervisor events for that session — including task IDs, worker IDs, process IDs, and model names.
- **Note from handoff**: The handoff acknowledges "WsAuthGuard on handleConnection but not on join-session/leave-session handlers" — this is incorrect. The `@UseGuards(WsAuthGuard)` decorator is present on both handlers (lines 78, 96). Authentication is enforced. However, authorization is absent: there is no check that the requesting client owns or is entitled to the session they are joining.
- **Fix**: Validate `sessionId` against the same regex used in the REST controller — `SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/` (defined at `auto-pilot.controller.ts:37`). Move this regex to a shared constants file and import it in both the controller and the gateway. Optionally, verify that the session exists in `AutoPilotService` before allowing the join.

---

### [MINOR] Debug logger emits full event payload including internal operational data

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:552`
- **Severity**: Minor
- **Description**: `this.logger.debug(\`Event: ${event.type} — ${JSON.stringify(payload)}\`)` serializes the entire payload on every event emission, including `config` (on `supervisor:started`), which contains all provider/model/directory settings, and `pid` (on `worker:spawned`). In production log aggregation systems, this becomes a high-volume stream of sensitive operational data.
- **Fix**: Either remove the payload from debug logging (log only `event.type` and `event.sessionId`), or suppress payload logging when the type is `supervisor:started` or `worker:spawned`.

---

### [PASS] Broadcast scope — emitSupervisorEvent is room-scoped only

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:72-76`
- `this.server.to(event.sessionId).emit(...)` — correctly scoped to the named room derived from the server-controlled `SupervisorEvent` object. No global `.emit()` path exists in `emitSupervisorEvent`. PASS.

---

### [PASS] WebSocket CORS origin allowlist

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:21-25`
- CORS origins are explicitly restricted to three localhost ports. No wildcard. PASS.

---

### [PASS] Event payload injection

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:544-555`
- All `emitEvent` call sites pass payload objects composed entirely of internal state values (`taskId`, `workerId`, `workerType`, `loopStatus`, etc.). No user-controlled strings are embedded in payloads. The `reason` strings are either hardcoded or derived from `String(err)` from internal exceptions. PASS.

---

### [PASS] WsAuthGuard on join-session/leave-session

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:78, 96`
- Despite the handoff's note that these handlers are unguarded, both carry `@UseGuards(WsAuthGuard)`. Authentication is enforced. PASS.

---

### [PASS] supervisorModel type check present

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:254-260`
- Type is validated as `string` before use. The concern is only the absence of a length/character constraint (flagged as Serious above). The basic type gate is PASS.

---

## OWASP Checklist Results

| Category                 | Status | Notes                                                                                                  |
|--------------------------|--------|--------------------------------------------------------------------------------------------------------|
| Input Validation         | FAIL   | Model name fields unbounded (no length cap, no character allowlist). sessionId not format-validated.   |
| Path Traversal           | PASS   | No file operations in these three files that accept external path input.                               |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys in any of the three files.                                        |
| Injection (shell/prompt) | FAIL   | Unbounded model name string could reach `spawnWorker` as a CLI argument — potential flag injection.    |
| Insecure Defaults        | PASS   | CORS is explicitly scoped; server null-guard present; no overly permissive default found.              |

---

## Verdict

**Recommendation**: APPROVED_WITH_NOTES

**Confidence**: HIGH

**Top Risk**: Unbounded, unvalidated model name fields (`supervisorModel` and peers) flow through to `spawnWorker` without any character or length constraint. If the worker spawn path uses shell execution or string concatenation rather than array-based `spawn`, this is directly exploitable as a flag injection or shell injection vector. Even in the array-based case, the absence of length bounds is a defense-in-depth gap. Both serious issues are low-effort to fix with a regex allowlist already established in the controller for `priority`.
