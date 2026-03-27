# Task: Move session-orchestrator into Monorepo

## Metadata

| Field      | Value              |
|------------|--------------------|
| Type       | REFACTORING        |
| Priority   | P1-High            |
| Complexity | Simple             |
| Model      | default            |
| Testing    | skip               |

## Description

Move the session-orchestrator MCP server from its standalone sibling repo (`/Volumes/SanDiskSSD/mine/session-orchestrator/`) into the nitro-fueled monorepo as `packages/session-orchestrator`. The separate repo will be abandoned after this move — no bidirectional sync needed.

Steps:
1. Copy `src/`, `package.json`, and `tsconfig.json` from the session-orchestrator repo into `packages/session-orchestrator/`.
2. The root `package.json` already has `"workspaces": ["packages/*"]` — no changes needed there.
3. Update the MCP server config (`~/.claude/settings.json` or equivalent) to point `session-orchestrator` at the new workspace path (`packages/session-orchestrator/dist/index.js`) instead of the old sibling repo path.
4. Verify the package builds (`npm run build --workspace=packages/session-orchestrator`).

## Dependencies

- None

## Parallelism

🚫 **Do NOT run in parallel with TASK_2026_059** — that task modifies session-orchestrator source code; this task is moving that source into the monorepo. Running concurrently would cause conflicts on the same files.

🚫 **Do NOT run in parallel with TASK_2026_060** — same reason; TASK_2026_060 also touches session-orchestrator internals.

**Must complete before TASK_2026_059 and TASK_2026_060 can start.** Those tasks should treat `packages/session-orchestrator/src/` as their source root after this task completes.

Wave: Run first, unblocks TASK_2026_059 and TASK_2026_060.

## Acceptance Criteria

- [ ] `packages/session-orchestrator/` exists with `src/`, `package.json`, and `tsconfig.json`
- [ ] `npm run build --workspace=packages/session-orchestrator` completes without errors
- [ ] MCP config updated to point at `packages/session-orchestrator/dist/index.js`
- [ ] Claude Code can connect to the MCP server from the new path (manual verification)

## References

- Source repo: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Root `package.json` workspaces config: `/Volumes/SanDiskSSD/mine/nitro-fueled/package.json`
- MCP config: `~/.claude/settings.json` (or `settings.local.json`)

## File Scope

- `packages/session-orchestrator/src/` (new — copied from sibling repo)
- `packages/session-orchestrator/package.json` (new)
- `packages/session-orchestrator/tsconfig.json` (new)
- `~/.claude/settings.json` (MCP path update)
