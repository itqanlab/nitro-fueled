# Security Review: TASK_2026_207

## Summary
Reviewed 5 files for security vulnerabilities including SQL injection, input validation, error handling, hardcoded secrets, safe data handling, and type safety. One serious issue found (path traversal), otherwise code follows secure practices with prepared statements and proper input whitelisting.

## Findings

| Severity | File | Line | Description |
|----------|------|------|-------------|
| serious | packages/mcp-cortex/src/tools/tasks.ts | 17 | Path traversal vulnerability: `taskId` is used in `join(projectRoot, 'task-tracking', taskId)` without validation. If `taskId` contains `../`, an attacker could write files outside the intended directory. |
| minor | packages/mcp-cortex/src/index.ts | 86 | `task_id` input for `update_task` is validated only as `z.string()` without format validation, allowing arbitrary strings that could exploit the path traversal in `writeStatusFile`. |

## Verdict

| Category | Status |
|----------|--------|
| Security | FAIL |

## Notes

### Path Traversal Issue (tasks.ts:17)
```typescript
export function writeStatusFile(projectRoot: string, taskId: string, status: string): void {
  const taskDir = join(projectRoot, 'task-tracking', taskId);
```

**Risk**: An attacker with MCP tool access could pass `task_id: "../../../tmp/pwned"` to `update_task`, causing a directory and status file to be created outside the task-tracking directory.

**Recommended Fix**: Validate `taskId` matches `TASK_\d{4}_\d{3}` format before path construction:
```typescript
const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;
if (!TASK_ID_RE.test(taskId)) return;
```

### Positive Findings
- **SQL Injection**: All database operations use prepared statements with `?` placeholders. No string interpolation in SQL queries. SAFE.
- **Input Validation**: Zod schemas enforce max lengths on strings, preventing memory exhaustion. Column whitelists (`UPDATABLE_COLUMNS`, `UPSERTABLE_COLUMNS`) prevent arbitrary column manipulation.
- **Error Handling**: JSON parsing is wrapped in try/catch blocks. Database errors are caught and returned as structured responses.
- **Hardcoded Secrets**: None found.
- **Type Safety**: Good use of `unknown` with narrowing; minimal unsafe type assertions.

### Context
The threat model assumes MCP tool callers may be untrusted or compromised. The path traversal issue is exploitable only if an attacker can invoke MCP tools, which limits but does not eliminate the risk.
