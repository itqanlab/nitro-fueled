# Security Review — TASK_2026_061

## Score: 8/10

## Summary

This task is pure documentation — one reference file and 22 empty record template files. There are no code execution paths, no shell commands, no API calls, and no credential handling. The review therefore focuses on: (1) inadvertent sensitive path or key exposure in example content, (2) whether the record format could induce insecure practices when filled in by future agents, and (3) information disclosure risk in the file structure itself.

All 22 record files are empty scaffolds with identical structure. The primary findings are in the reference doc `agent-calibration.md`.

---

## Issues Found

### Issue 1: Absolute Internal Path Disclosed in Example Content

**File**: `.claude/skills/orchestration/references/agent-calibration.md` — line 8 (Metadata section of the record format spec and the filled example block starting at line 94)

**Problem**: The `Definition File` field in the record format and the worked example use relative paths like `.claude/agents/backend-developer.md`. These are project-relative paths that disclose the internal directory layout of the `.claude/` orchestration system. While these are not sensitive in isolation, the pattern instructs every future agent record to embed a local file system path in a human-readable, version-controlled file. If this system is ever used in a project where `.claude/` contains environment-specific paths or if the convention is carried over to a project with absolute paths (e.g., `/Users/alice/work/client-project/.claude/agents/...`), the absolute path would be committed to version control.

**Risk**: Low for this project (relative paths only), but the schema as documented does not prohibit or warn against recording absolute paths. A developer following the template literally on a project where the agent definition is referenced by absolute path would commit that path to the repository.

**Fix**: Add a note in the Metadata section spec: "The `Definition File` field must always use a project-relative path (e.g., `.claude/agents/backend-developer.md`). Never record an absolute path." This closes the pattern before it can propagate to consumer projects.

---

### Issue 2: Free-Text `Description` Field in Failure Log Has No Sanitization Guidance

**File**: `.claude/skills/orchestration/references/agent-calibration.md` — lines 79–80 (Failure Log section) and lines 116–120 (filled example)

**Problem**: The Failure Log table includes a free-text `Description` field. The schema and the worked example do not include any guidance about what must NOT appear in this field. Failure descriptions written by agents or team-leaders could inadvertently contain:

- File paths that include usernames or machine-specific directories (e.g., `agent read /Users/alice/.env to resolve a config`)
- Token or key fragments captured from error output (e.g., `API call failed — response body contained: Bearer sk-...`)
- Internal system details from MCP error messages

The format actively encourages detailed narrative descriptions, which increases the surface area for accidental sensitive data capture. Since these records are version-controlled markdown files, any sensitive string committed here would persist in git history.

**Fix**: Add an explicit constraint to the Failure Log section: "Descriptions must not include file system paths outside the project root, authentication tokens, API keys, or raw error messages from external services. Summarize what went wrong in behavioral terms only (e.g., 'agent modified a file outside its defined scope' — not the full path or contents of that file)."

---

## Minor Notes

1. **`task-tracking/` is not in `.gitignore`** (out of scope to verify here, noted only) — if agent records accumulate sensitive failure descriptions over time, having this directory committed to a public repository is an information disclosure risk. Not a finding against the files in scope, but worth a follow-up check on `.gitignore`.

2. **The `wrong_tool_used` example at line 64** mentions the specific MCP tool name `mcp__session-orchestrator__spawn_worker`. This is an internal tool identifier. It is not sensitive, but it does disclose the internal MCP namespace convention. This is acceptable in a private orchestration reference doc but should be noted if this file is ever published externally.

3. **The example in the filled record (lines 94–127) references realistic-looking task IDs** (`TASK_2026_031`, `TASK_2026_038`, etc.) that overlap with actual task IDs used in this project. This is cosmetically fine, but if those tasks contained sensitive work, a reader might attempt to cross-reference them. The IDs are not sensitive in themselves.

4. **No guidance on record file permissions** — the schema does not specify that record files should have restricted permissions. On a shared development machine, world-readable record files could expose behavioral patterns about agents to unauthorized users. Low risk in practice for a local dev tool, but consistent with the lesson from TASK_2026_059 (explicit mode recommendations for sensitive operational files).

5. **The `Evaluation History` section's `Changes Made` field** is free-text with no length or content constraint. A very detailed entry could expose implementation details of the agent definition (e.g., specific instruction text that was removed). Not a blocking concern, but guidance to keep entries terse (e.g., "Added prohibition against X at line N") would reduce the risk.

---

## Verdict

**Recommendation**: APPROVE with minor documentation hardening
**Confidence**: HIGH
**Top Risk**: The free-text `Description` field in the Failure Log has no guardrails against recording sensitive strings (tokens, raw error output, absolute paths). This is the single most realistic path to inadvertent credential or path exposure, and it can be closed with a single documentation addition before the format is used in production.
