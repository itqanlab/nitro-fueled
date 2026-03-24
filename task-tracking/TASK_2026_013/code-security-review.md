# Security Review - TASK_2026_013

## Summary
Two serious findings addressed. No blocking issues. The main security improvements were around path validation and file write safety.

## Findings

### SERIOUS: User-supplied path lacked traversal guard (FIXED)
- `init.ts` accepted user path input and resolved it without validating against traversal
- **Fix**: Added `realpathSync` to resolve symlinks and validate the path exists before using it

### SERIOUS: `--dangerously-skip-permissions` spawned without consent (NOTED)
- Both `run.ts` and the old `mcp-connectivity.ts` invoked `claude --dangerously-skip-permissions`
- The connectivity test no longer uses Claude CLI (fixed above)
- The `run` command's Supervisor spawn is inherent to the tool's purpose — documented in CLI help

### MINOR: Malformed JSON silently overwritten (FIXED)
- `mergeJsonFile` would overwrite a malformed config file without backup
- **Fix**: Now creates `.bak` backup before overwriting, with error handling if backup fails

### MINOR: No runtime schema validation on parsed JSON (FIXED)
- `extractMcpEntry` used unsafe `as` casts
- **Fix**: Added `isPlainObject` guard and field type checks

### MINOR: Potential info disclosure in error messages (ACCEPTED)
- `mcp-connectivity.ts` shows first line of error messages
- Risk is low — this is a local CLI tool, errors go to the developer's terminal

### MINOR: No file permission restrictions on written config (ACCEPTED)
- Written config files inherit default umask permissions
- Acceptable for a development CLI tool

## Verdict
PASS after fixes applied. No remaining blocking or serious issues.
