# Completion Report - TASK_2026_013

## Task: MCP Server Dependency Handling

## Summary
Implemented MCP session-orchestrator dependency handling across the CLI: configuration detection, connectivity testing, setup guidance, and interactive init configuration. All review findings fixed.

## What Was Built

### Configuration Detection (`mcp-config.ts`)
- Detects MCP session-orchestrator across 4 config locations: `.mcp.json`, `.claude/settings.json` (project), `~/.claude.json`, `~/.claude/settings.json` (global)
- Runtime structural validation of config entries (verifies `command` for stdio, `url` for http)

### Connectivity Testing (`mcp-connectivity.ts`)
- Direct MCP server binary invocation via `spawnSync` with JSON-RPC `initialize` handshake
- Zero API token cost, sub-second execution, deterministic results
- Graceful handling of ENOENT, timeout, and protocol errors

### Setup Guide (`mcp-setup-guide.ts`)
- Step-by-step instructions displayed when MCP is not configured
- Shows both project-level and global configuration options

### Init Integration (`init.ts`)
- Interactive MCP configuration during `npx nitro-fueled init`
- `--mcp-path` and `--skip-mcp` CLI options
- Tilde expansion, path traversal guard (realpathSync), permission error handling
- JSON file merge with backup on parse failure

### Preflight Integration (`preflight.ts`)
- MCP config check integrated into the preflight pipeline
- Blocks `run` command with helpful guidance when MCP not configured

### Run Integration (`run.ts`)
- Connectivity check before spawning Supervisor (skippable with `--skip-connectivity`)
- FAILED tasks now shown in summary display
- Concurrency validation rejects zero

## Review Findings Fixed
- Replaced Claude CLI connectivity test with direct MCP protocol handshake
- Added structural validation of MCP config entries
- Added try/catch around file writes with backup on parse failure
- Added tilde expansion and path traversal guard
- Eliminated duplicate MCP entry construction (now uses `buildMcpConfigEntry`)
- Fixed concurrency zero acceptance
- Added FAILED tasks to summary count
- Updated setup guide to remove placeholder URL

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| CLI detects if MCP session-orchestrator is configured | PASS |
| CLI tests MCP connectivity before starting Supervisor | PASS |
| Clear setup instructions displayed when MCP is not configured | PASS |
| `init` offers to configure MCP server | PASS |
| Graceful error message on connection failure (not a crash) | PASS |
| Works with both global and project-level MCP settings | PASS |

## Files Modified
- `packages/cli/src/utils/mcp-config.ts` — config detection with validation
- `packages/cli/src/utils/mcp-connectivity.ts` — direct MCP protocol connectivity test
- `packages/cli/src/utils/mcp-setup-guide.ts` — setup instructions and config builder
- `packages/cli/src/utils/preflight.ts` — MCP preflight integration
- `packages/cli/src/commands/init.ts` — interactive MCP setup with error handling
- `packages/cli/src/commands/run.ts` — connectivity check and summary display fixes
- `.claude/review-lessons/review-general.md` — 5 new lessons under MCP section
