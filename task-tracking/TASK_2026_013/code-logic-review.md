# Code Logic Review - TASK_2026_013

## Summary
Several significant logic issues found and fixed. The most critical was the connectivity test implementation which spawned a full Claude CLI session (consuming API tokens) with fragile substring matching.

## Findings

### CRITICAL: Connectivity test spawned full Claude CLI session (FIXED)
- `mcp-connectivity.ts` used `execSync('claude --dangerously-skip-permissions ...')` to test connectivity
- This consumed API tokens on every `run` invocation, took 10-30 seconds, and used fragile substring matching
- **Fix**: Replaced with direct MCP server binary invocation using `spawnSync`. Sends an MCP `initialize` JSON-RPC request over stdio. Zero API cost, sub-second, deterministic.

### CRITICAL: mergeJsonFile crashed on permission errors (FIXED)
- `init.ts:writeFileSync` had no try/catch, crashing with stack trace on EACCES
- Violated acceptance criterion "Graceful error message on connection failure (not a crash)"
- **Fix**: Wrapped in try/catch, `mergeJsonFile` now returns boolean, backs up malformed files

### SERIOUS: Init early-return when MCP configured (NOTED)
- `init.ts:95-98` returns when MCP already configured, blocking future scaffolding steps
- **Fix**: Added comment documenting the architectural constraint. When TASK_2026_009 adds scaffolding, the early return should be removed and replaced with a "skip MCP step" approach.

### SERIOUS: No structural validation of MCP config entries (FIXED)
- `mcp-config.ts:extractMcpEntry` used unsafe `as` cast without runtime validation
- Corrupted config files would report "found" but with unusable entries
- **Fix**: Added `isPlainObject` guard and field validation (command for stdio, url for http)

### SERIOUS: Concurrency accepted zero (FIXED)
- `run.ts` validated with `/^\d+$/` which matched "0"
- **Fix**: Changed to `/^[1-9]\d*$/` for concurrency

### SERIOUS: FAILED tasks missing from summary (FIXED)
- `displaySummary` in `run.ts` counted BLOCKED and CANCELLED but not FAILED
- **Fix**: Added separate `failed` counter and display line

### MODERATE: Dead code `buildMcpConfigEntry` (FIXED)
- `mcp-setup-guide.ts` exported `buildMcpConfigEntry` but `init.ts` duplicated the logic inline
- **Fix**: `init.ts` now imports and uses `buildMcpConfigEntry`

### MODERATE: No tilde expansion in interactive path input (FIXED)
- User entering `~/path/to/server` in the prompt would resolve to `./~` instead of home dir
- **Fix**: Added `expandTilde` helper in `init.ts`

### MODERATE: Absolute path written to project-level config (NOTED)
- Project-level `.mcp.json` gets absolute paths that aren't portable
- **Fix**: Added warning message when user selects project-level config

## Acceptance Criteria Coverage

| Criterion | Status |
|-----------|--------|
| CLI detects if MCP session-orchestrator is configured | PASS (with structural validation) |
| CLI tests MCP connectivity before starting Supervisor | PASS (direct MCP protocol test) |
| Clear setup instructions when MCP not configured | PASS |
| init offers to configure MCP server | PASS |
| Graceful error message on connection failure | PASS (after try/catch fixes) |
| Works with both global and project-level settings | PASS |

## Verdict
PASS after fixes applied.
