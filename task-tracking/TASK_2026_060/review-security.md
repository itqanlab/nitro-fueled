# Security Review — TASK_2026_060

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 1                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | File-system evidence check reads arbitrary paths derived from worker-type classification; no boundary validation described |
| Path Traversal           | FAIL   | Evidence artifact paths (`tasks.md`, `review-context.md`, `test-report.md`) are constructed from task folder names that originate in registry.md — no normalization guard specified |
| Secret Exposure          | PASS   | No credentials, tokens, or sensitive literals introduced |
| Injection (shell/prompt) | PASS   | No shell execution added; prompt injection surface unchanged |
| Insecure Defaults        | PASS   | `mcp_empty_count` defaults to 0; grace period caps at 2 — conservative defaults |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: File-System Evidence Artifact Paths Are Unvalidated Against Task Folder Boundary

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 306-323 (Step 1 reconciliation table)
- **Problem**: The new reconciliation logic instructs the supervisor to read artifact files at paths like `task-tracking/TASK_YYYY_NNN/tasks.md`, `task-tracking/TASK_YYYY_NNN/review-context.md`, and `task-tracking/TASK_YYYY_NNN/test-report.md`. The task ID (`TASK_YYYY_NNN`) used to construct these paths is read from `{SESSION_DIR}state.md`, which was originally populated from `task-tracking/registry.md`. The spec does not describe any normalization or boundary check on the task ID value before it is used to construct file paths. If a task ID in `registry.md` or `state.md` contains path components (e.g., `../secrets`, `TASK_2026_001/../../sensitive-dir`), the supervisor would read a file outside the `task-tracking/` tree. In a text-based orchestration system where registry content is human-edited, this is a realistic concern.
- **Impact**: An attacker (or a malicious/corrupted `registry.md`) could cause the supervisor to read arbitrary files on disk during the evidence check phase. For an AI agent, "reading" an artifact also means the content becomes part of the context window, potentially exposing sensitive file contents to the agent's reasoning and log output.
- **Fix**: The spec should explicitly require that task IDs match the pattern `/^TASK_\d{4}_\d{3}$/` before constructing any file path from them. Any task ID that does not match this pattern should be logged as an error and skipped — never used in a path join.

---

### Issue 2: "MCP Restart Suspected" Grace Period Creates a Supervisory Blind-Spot Window for Stuck/Misbehaving Workers

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 317-322 (Step 1 reconciliation, empty-list branch)
- **Problem**: When `list_workers` returns empty and no file-system evidence is present, the supervisor sets all active workers to status `"unknown"` and defers action for up to 2 monitoring intervals. During this window, the supervisor performs no health checks, no stuck-detection, and applies no retry limits to those workers. A worker that has entered an infinite loop, is waiting for a human response, or is consuming excessive resources is invisible to the supervisor for the entire grace period. Additionally, the spec does not describe what happens to the stuck-detection two-strike counter for those workers during the grace period — if it is preserved, a worker that was already at strike 1 before the MCP restart would get a free reset; if it is cleared, it gets a leniency pass beyond its configured retry limit.
- **Impact**: A misbehaving worker can avoid supervisor intervention for at least 2 full monitoring cycles (default: 10 minutes with 5-minute interval) with no way for the supervisor to detect or react. At worst, if the MCP restart happens repeatedly (e.g., flapping), the grace period resets each time and the worker is never recovered. This is a denial-of-service on the supervisor's recovery function — not an external attacker concern, but an operational reliability risk that has security implications in a cost-per-token billing model (unbounded runaway workers).
- **Fix**: The spec should state that stuck-detection strike counts are preserved (not cleared) for workers placed in `"unknown"` status. It should also document a maximum number of times `mcp_empty_count` can cycle to 2 and reset before the supervisor escalates to a human rather than indefinitely retrying. A cap of 3 MCP-restart-cycles before escalation would bound the worst case.

---

## Minor Issues

### Minor 1: No Integrity Check on `mcp_empty_count` When Read Back from `state.md`

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 318, 322
- `mcp_empty_count` is persisted to `state.md` and read back on the next monitoring loop. The spec does not describe validation of this field on read (e.g., must be a non-negative integer). A corrupted or manually edited `state.md` with `mcp_empty_count: -1` or `mcp_empty_count: 999` would cause incorrect branch selection (either skipping the grace period entirely or treating every MCP response as an immediate failure). The spec should require that on read, if the field is missing or non-integer, it is treated as 0.

### Minor 2: Evidence Interpretation Is Structurally Weak for ReviewLead — Section Heading Match Only

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 306-314 (evidence table, ReviewLead row)
- The completion evidence for a ReviewLead is described as `review-context.md` existing with a `## Findings Summary` section. This is a string-presence check on a heading inside an AI-authored file. A partial or corrupt write of `review-context.md` that includes the heading text but lacks the actual findings content would be treated as a completed review. This is a defense-in-depth concern — the spec should describe a minimum structure check (e.g., the section must contain at least one table row or non-empty content) rather than heading presence alone.

### Minor 3: Log Message for "MCP Restart Suspected" May Echo Unvalidated Worker Count

- **File**: `.claude/skills/auto-pilot/SKILL.md` line 319
- The log format `"MCP RESTART SUSPECTED — {N} active workers in state..."` includes `{N}` which is derived from the count of entries in `state.md`. This is a low-risk information disclosure — a log that reveals how many workers the supervisor believes are active. In the current local-machine context this is not sensitive, but if log output is ever forwarded to an external service, this count leaks pipeline topology. Flagged for awareness.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: MEDIUM
**Top Risk**: Unvalidated task ID values used to construct file-system paths during the evidence check phase (Issue 1). An attacker or corrupted registry can cause the supervisor to read files outside the task-tracking directory boundary, exposing their contents to the agent's context window.

---

## Notes on Scope

This review covers only `.claude/skills/auto-pilot/SKILL.md` lines 294-350 as specified in the task brief. The broader SKILL.md file was read for context (Worker Recovery Protocol, prompt templates, session lifecycle) to evaluate the security implications of the new logic accurately. No out-of-scope findings were observed that warrant separate flagging.

The file is a markdown behavioral specification, not executable code. All findings describe logical security properties of the described behavior, not implementation bugs.
