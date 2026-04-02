# Log Templates — auto-pilot

All event types and their exact log row formats for `{SESSION_DIR}log.md`.

**Append one row per event** (do NOT use the `[HH:MM:SS]` bracket format — use the pipe-table row):

| Event | Log Row |
|-------|---------|
| Pre-flight passed | `\| {HH:MM:SS} \| auto-pilot \| PRE-FLIGHT PASSED — {no issues found \| N warning(s)} \|` |
| Pre-flight warning | `\| {HH:MM:SS} \| auto-pilot \| PRE-FLIGHT WARNING — {warning_message} \|` |
| Pre-flight blocking issue | `\| {HH:MM:SS} \| auto-pilot \| PRE-FLIGHT BLOCKING — {blocking_issue_message} \|` |
| Pre-flight aborted | `\| {HH:MM:SS} \| auto-pilot \| PRE-FLIGHT FAILED — {N} blocking issue(s) found \|` |
| Loop started | `\| {HH:MM:SS} \| auto-pilot \| SUPERVISOR STARTED — {N} tasks, {N} unblocked, concurrency {N} \|` |
| Worker spawned | `\| {HH:MM:SS} \| auto-pilot \| SPAWNED {worker_id} for TASK_X ({WorkerType}: {TaskType}) — provider={provider}, model={model}, tier={tier} \|` |
| Worker subscribed | `\| {HH:MM:SS} \| auto-pilot \| SUBSCRIBED {worker_id} for TASK_X — watching {N} condition(s) \|` |
| Subscribe fallback | `\| {HH:MM:SS} \| auto-pilot \| WARN — subscribe_worker unavailable, falling back to 5-minute polling \|` |
| Completion event received | `\| {HH:MM:SS} \| auto-pilot \| EVENT — TASK_X: {event_label} received, triggering completion handler \|` |
| Worker healthy | `\| {HH:MM:SS} \| auto-pilot \| HEALTH CHECK — TASK_X: healthy \|` |
| Worker high context | `\| {HH:MM:SS} \| auto-pilot \| HEALTH CHECK — TASK_X: high_context ({context_percent}%) \|` |
| Worker compacting | `\| {HH:MM:SS} \| auto-pilot \| HEALTH CHECK — TASK_X: compacting \|` |
| Compaction warning | `\| {HH:MM:SS} \| auto-pilot \| COMPACTION WARNING — TASK_X: compacted {N} times \|` |
| Compaction limit | `\| {HH:MM:SS} \| auto-pilot \| COMPACTION LIMIT — TASK_X: compacted {N} times, killing \|` |
| Worker stuck (strike 1) | `\| {HH:MM:SS} \| auto-pilot \| WARNING — TASK_X: stuck (strike 1/2) \|` |
| Worker stuck (strike 2, killing) | `\| {HH:MM:SS} \| auto-pilot \| KILLING — TASK_X: stuck for 2 consecutive checks \|` |
| Kill failed | `\| {HH:MM:SS} \| auto-pilot \| KILL FAILED — TASK_X: {error} \|` |
| State transitioned (success) | `\| {HH:MM:SS} \| auto-pilot \| STATE TRANSITIONED — TASK_X: {old_state} -> {new_state} \|` |
| No transition (failure) | `\| {HH:MM:SS} \| auto-pilot \| NO TRANSITION — TASK_X: expected {expected_state}, still {current_state} (retry {N}/{limit}) \|` |
| Build done | `\| {HH:MM:SS} \| auto-pilot \| BUILD DONE — TASK_X: IMPLEMENTED, spawning Review+Fix Worker \|` |
| Review+Fix done | `\| {HH:MM:SS} \| auto-pilot \| REVIEWFIX DONE — TASK_X: COMPLETE \|` |
| Retry scheduled | `\| {HH:MM:SS} \| auto-pilot \| RETRY — TASK_X: attempt {N}/{retry_limit} \|` |
| Task blocked (max retries) | `\| {HH:MM:SS} \| auto-pilot \| BLOCKED — TASK_X: exceeded {retry_limit} retries \|` |
| Task blocked (cycle) | `\| {HH:MM:SS} \| auto-pilot \| BLOCKED — TASK_X: dependency cycle with TASK_Y \|` |
| Task blocked (cancelled dep) | `\| {HH:MM:SS} \| auto-pilot \| BLOCKED — TASK_X: dependency TASK_Y is CANCELLED \|` |
| Task blocked (missing dep) | `\| {HH:MM:SS} \| auto-pilot \| BLOCKED — TASK_X: dependency TASK_Y not in registry \|` |
| Orphan blocked task | `\| {HH:MM:SS} \| auto-pilot \| ORPHAN BLOCKED — TASK_X: blocked with no dependents, needs manual resolution \|` |
| Timing warning | `\| {HH:MM:SS} \| auto-pilot \| TIMING WARNING — TASK_X: {field} value {value} invalid or clamped, falling back to default \|` |
| MCP retry | `\| {HH:MM:SS} \| auto-pilot \| MCP RETRY — {tool_name}: attempt {N}/3 \|` |
| MCP failure (per-worker) | `\| {HH:MM:SS} \| auto-pilot \| MCP SKIP — TASK_X: {tool_name} failed, will retry next interval \|` |
| MCP failure (global) | `\| {HH:MM:SS} \| auto-pilot \| MCP UNREACHABLE — pausing supervisor, state saved \|` |
| Spawn failure | `\| {HH:MM:SS} \| auto-pilot \| SPAWN FAILED — TASK_X: {error} \|` |
| Spawn fallback triggered | `\| {HH:MM:SS} \| auto-pilot \| SPAWN FALLBACK — TASK_X: {provider} failed, retrying with {fallback_provider}/{fallback_model} \|` |
| Provider switch (retry) | `\| {HH:MM:SS} \| auto-pilot \| PROVIDER SWITCH — TASK_X: {previous_provider} failed {N} times, switching to claude \|` |
| State recovered | `\| {HH:MM:SS} \| auto-pilot \| STATE RECOVERED — {N} active workers, {N} completed \|` |
| Reconciliation | `\| {HH:MM:SS} \| auto-pilot \| RECONCILE — worker {id} missing from MCP, treating as finished \|` |
| Cleanup spawned | `\| {HH:MM:SS} \| auto-pilot \| CLEANUP — TASK_X: spawning Cleanup Worker to salvage uncommitted work \|` |
| Cleanup done | `\| {HH:MM:SS} \| auto-pilot \| CLEANUP DONE — TASK_X: {committed N files \| no uncommitted changes} \|` |
| Worker replaced | `\| {HH:MM:SS} \| auto-pilot \| REPLACING — TASK_X: spawning new worker (previous {reason}) \|` |
| Claim rejected (cortex) | `\| {HH:MM:SS} \| auto-pilot \| CLAIM REJECTED — TASK_X: already claimed by another session \|` |
| Compaction detected | `\| {HH:MM:SS} \| auto-pilot \| COMPACTION — reading {SESSION_DIR}state.md to restore context \|` |
| Plan consultation | `\| {HH:MM:SS} \| auto-pilot \| PLAN CONSULT — guidance: {PROCEED\|REPRIORITIZE\|ESCALATE\|NO_ACTION} \|` |
| Plan escalation | `\| {HH:MM:SS} \| auto-pilot \| PLAN ESCALATION — {guidance_note} \|` |
| Plan no action | `\| {HH:MM:SS} \| auto-pilot \| PLAN — no action needed \|` |
| Plan not found | `\| {HH:MM:SS} \| auto-pilot \| PLAN — no plan.md found, using default ordering \|` |
| Loop stopped | `\| {HH:MM:SS} \| auto-pilot \| SUPERVISOR STOPPED — {completed} completed, {failed} failed, {blocked} blocked \|` |
| Limit reached | `\| {HH:MM:SS} \| auto-pilot \| LIMIT REACHED — {N}/{limit} tasks completed, stopping \|` |
| Worker log written | `\| {HH:MM:SS} \| auto-pilot \| WORKER LOG — TASK_X ({Build\|Review\|Cleanup}): {duration}m, ${X.XX}, {tokens}k tokens, ctx={context_pct}%, compactions={N}, provider={provider}, model={model}, {N} files changed \|` |
| Worker log failed | `\| {HH:MM:SS} \| auto-pilot \| WORKER LOG FAILED — TASK_X: {reason} \|` |
| Analytics written | `\| {HH:MM:SS} \| auto-pilot \| ANALYTICS — {N} tasks completed, total ${X.XX} \|` |
| Analytics failed | `\| {HH:MM:SS} \| auto-pilot \| ANALYTICS FAILED — {reason} \|` |
| Sequential started | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL MODE STARTED — {N} tasks in backlog \|` |
| Sequential task started | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL — starting TASK_X (attempt {N}/{retry_limit}) \|` |
| Sequential task completed | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL COMPLETE — TASK_X \|` |
| Sequential task partial | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL PARTIAL — TASK_X: status={status}, treating as needs-review \|` |
| Sequential task retry | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL RETRY — TASK_X: attempt {N}/{retry_limit} \|` |
| Sequential task blocked | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL BLOCKED — TASK_X: exceeded {retry_limit} retries \|` |
| Sequential stopped | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL STOPPED — {completed} completed, {failed} failed, {blocked} blocked \|` |
| Sequential empty queue | `\| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL EMPTY — no eligible tasks found (queue empty after filtering) \|` |
| Session archive committed | `\| {HH:MM:SS} \| auto-pilot \| SESSION ARCHIVE — committed {SESSION_ID} \|` |
| Session archive failed | `\| {HH:MM:SS} \| auto-pilot \| SESSION ARCHIVE WARNING — commit failed: {reason[:200]} \|` |
| Cortex available | `\| {HH:MM:SS} \| auto-pilot \| CORTEX AVAILABLE — using nitro-cortex for task state \|` |
| Cortex unavailable | `\| {HH:MM:SS} \| auto-pilot \| CORTEX UNAVAILABLE — falling back to file-based state \|` |
| log_event call failed | `\| {HH:MM:SS} \| auto-pilot \| CORTEX LOG FAILED — {event_type}: {error[:100]} \|` |
| Session log rendered from DB | `\| {HH:MM:SS} \| auto-pilot \| LOG RENDERED — {N} events from cortex, {M} already in log.md \|` |
| Escalate disabled (cortex off) | `\| {HH:MM:SS} \| auto-pilot \| ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false \|` |
| NEED_INPUT received | `\| {HH:MM:SS} \| auto-pilot \| NEED INPUT — TASK_X: pausing loop for user response \|` |
| Input provided | `\| {HH:MM:SS} \| auto-pilot \| INPUT PROVIDED — TASK_X: resuming loop \|` |
| end_session called successfully | `\| {HH:MM:SS} \| auto-pilot \| SESSION ENDED — cortex session record closed \|` |
| end_session failed | `\| {HH:MM:SS} \| auto-pilot \| SESSION END FAILED — cortex end_session error: {error[:100]} \|` |
