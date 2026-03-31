# Security Review — TASK_2026_181

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 1                                    |
| Files Reviewed   | 7                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | SESSION_ID regex validation present and explicit. `--priority` invalid values exit immediately. |
| Path Traversal           | PASS   | SESSION_ID format validated before any path construction. File operations in worker prompts are scoped to task folder. |
| Secret Exposure          | PASS   | No API keys, tokens, or credentials in any in-scope file. |
| Injection (shell/prompt) | FAIL   | Stale `session-orchestrator` key name remains in `docs/mcp-nitro-cortex-design.md` MCP config example. Also, the AppleScript block in that doc constructs shell arguments via string interpolation without escaping (design doc only — not executable code, but sets a dangerous template). |
| Insecure Defaults        | PASS   | Defaults are conservative: `--dangerously-skip-permissions` is intentional and explicit, fallback to `claude` on unavailable provider is safe. |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Stale `session-orchestrator` Key in MCP Config Example

- **File**: `docs/mcp-nitro-cortex-design.md:322-329`
- **Problem**: The MCP configuration JSON block still uses `"session-orchestrator"` as the server key name, and the `args` path references `/path/to/session-orchestrator/dist/index.js`. The task's stated goal was to replace all `session-orchestrator` references in scaffold/documentation files with `nitro-cortex`. This example was missed.
- **Impact**: Any developer or target-project user who copies this config block verbatim will register the MCP server under the old name. The scaffold command files (e.g., `nitro-auto-pilot.md`) now reference `MCP nitro-cortex` in their error messages and availability checks. A project that follows this doc example but uses the renamed server will see confusing "MCP nitro-cortex not found" errors even though the server is running — because it was registered as `session-orchestrator`. This is a silent operational breakage.
- **Fix**: Update the config block to use `"nitro-cortex"` as the key and update the `args` path to reference `nitro-cortex` (e.g., `/path/to/nitro-cortex/dist/index.js`). Also update the `Project Structure` tree at line 49 which still shows `session-orchestrator/` as the root directory name.

---

## Minor Issues

- **Unescaped interpolation in AppleScript template** (`docs/mcp-nitro-cortex-design.md:99-108`): The design doc's `spawn_worker` implementation shows a template literal that inlines `${label}`, `${workingDirectory}`, and `${escapedPrompt}` directly into an AppleScript string. Only `escapedPrompt` acknowledges escaping exists; `label` and `workingDirectory` are interpolated raw. This is documentation-only (not executed here), but the template sets a pattern that, if copied verbatim into an implementation, would allow shell injection via a crafted `label` or `workingDirectory` argument. The note "out of scope for the rename task" applies — this pre-existing pattern was not introduced by TASK_2026_181 — flagged for awareness only.

---

## Findings Summary

1. **Stale rename in design doc** (Serious) — `docs/mcp-nitro-cortex-design.md` has 3 remaining occurrences of `session-orchestrator`: lines 49 (project tree), 322 (MCP config key), and 324 (args path). This is the only incomplete part of the rename. All scaffold command and skill files correctly reference `nitro-cortex`.

2. **Shell injection pattern in design doc** (Minor, pre-existing, out of scope) — AppleScript template in the design doc interpolates `label` and `workingDirectory` without escaping. Pre-dates this task; not introduced by the rename.

3. **Prompt injection** — No issues found. The SESSION_ID validation guard (`^SESSION_[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}$`) in both `nitro-auto-pilot.md` variants is correctly applied before any path is constructed, and the error message explicitly states "Refusing to proceed to prevent path traversal." This is a positive security control.

4. **Dangerous tool permissions** — `--dangerously-skip-permissions` is explicitly justified in both the SKILL.md and worker prompt templates as required for autonomous worker sessions. The scope boundary is enforced via the File Scope field, not tool restrictions. No undocumented broad-permission grants were introduced.

5. **MCP tool scope** — The `agent-calibration.md` scaffold file does not reference MCP tool calls directly; it is a schema/format reference file. No injection risk.

---

## Verdict

| Verdict | PASS |
|---------|------|
| Overall | PASS |

**Recommendation**: APPROVE with advisory — the stale `session-orchestrator` references in `docs/mcp-nitro-cortex-design.md` (lines 49, 322, 324) are an incomplete rename that will confuse developers following the design doc. Fix in a follow-on pass or as part of the next doc-maintenance task. The scaffold files that ship to target projects are clean.

**Confidence**: HIGH

**Top Risk**: Incomplete rename in `docs/mcp-nitro-cortex-design.md` MCP config example causing silent MCP registration failures in projects that copy the example verbatim.
