# Code Style Review — TASK_2026_181

## Review Summary

| Metric          | Value                                |
|-----------------|--------------------------------------|
| Overall Score   | 4/10                                 |
| Assessment      | NEEDS_REVISION                       |
| Blocking Issues | 1                                    |
| Serious Issues  | 2                                    |
| Minor Issues    | 1                                    |
| Files Reviewed  | 7                                    |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The new `docs/mcp-nitro-cortex-design.md` file (line 49 and lines 322–324) still uses
`session-orchestrator` as the project directory name and as the MCP server key in the
JSON configuration block. Any developer who copies that config snippet verbatim into
`.mcp.json` will wire up a server key named `session-orchestrator`, causing every
`mcp__nitro-cortex__*` tool call to fail at runtime. This is the same bug the task was
created to fix — it just moved from scaffold files to the design doc.

### 2. What would confuse a new team member?

A new contributor reading `docs/mcp-nitro-cortex-design.md` will see the server registered
as `"session-orchestrator"` in the MCP config block and the source folder named
`session-orchestrator/`. They will then look for that name in `.mcp.json` and find
`nitro-cortex` instead. No comment explains that the config block is historical or
intentionally unupdated. The contradiction is silent and requires archaeology to resolve.

Additionally, `docs/nitro-fueled-design.md` and `docs/task-template-guide.md` were not in
scope for this task but still contain live `session-orchestrator` references that a new
reader will encounter alongside the updated files. These are out of scope for this task
but create a confusing mixed state in the docs directory.

### 3. What's the hidden complexity cost?

The design doc was committed as a new file (370 lines), not a migration of an existing
file. The old `docs/mcp-session-orchestrator-design.md` still exists alongside it. Two
design docs now describe the same MCP server — one with the old name, one with the new
name but still containing old-name references. Future readers must reconcile two files
rather than one authoritative source.

### 4. What pattern inconsistencies exist?

Every other scaffold file updated in this task (`nitro-auto-pilot.md`, `SKILL.md`,
`worker-prompts.md`, `agent-calibration.md`) is clean — zero `session-orchestrator`
occurrences. The design doc breaks that pattern: it was placed in scope precisely to
carry the canonical, up-to-date configuration example, but it contains the stale name
in the project structure diagram (line 49) and the MCP config block (lines 322–324).

### 5. What would I do differently?

1. In `docs/mcp-nitro-cortex-design.md`, rename the directory in the Project Structure
   block from `session-orchestrator/` to `nitro-cortex/`, and update the MCP
   configuration server key and args path to use `nitro-cortex`.
2. Either archive `docs/mcp-session-orchestrator-design.md` (rename to
   `docs/mcp-session-orchestrator-design.ARCHIVED.md` or delete it) so there is one
   authoritative design document, not two contradictory ones.
3. As a follow-on, sweep `docs/nitro-fueled-design.md` and `docs/task-template-guide.md`
   for remaining `session-orchestrator` references (those are out of scope for this task
   but are user-visible docs).

---

## Blocking Issues

### Issue 1: Stale `session-orchestrator` name in the new design doc

- **File**: `docs/mcp-nitro-cortex-design.md`
  - Line 49: `session-orchestrator/` in the Project Structure block
  - Line 322: `"session-orchestrator":` as the MCP server key in the config block
  - Line 324: `/path/to/session-orchestrator/dist/index.js` as the binary path
- **Problem**: The task acceptance criterion is "zero occurrences of `session-orchestrator`
  in `apps/cli/scaffold/`". The scaffold is clean, but the primary deliverable of this
  task — the new `docs/mcp-nitro-cortex-design.md` — ships three stale occurrences. The
  MCP config block is the most dangerous: it is the canonical copy-paste snippet for
  wiring up the MCP server, and it registers the server under the wrong name, which would
  produce the exact runtime failure this task was created to eliminate.
- **Impact**: Any developer who follows the design doc to configure `.mcp.json` will
  register the server as `session-orchestrator`, then wonder why all `nitro-cortex`
  tool calls are missing. The bug is in the primary documentation artifact, not just
  a comment.
- **Fix**: In `docs/mcp-nitro-cortex-design.md`, replace:
  - `session-orchestrator/` → `nitro-cortex/` (Project Structure block, line 49)
  - `"session-orchestrator":` → `"nitro-cortex":` (MCP Configuration block, line 322)
  - `/path/to/session-orchestrator/dist/index.js` → `/path/to/nitro-cortex/dist/index.js`
    (line 324)

---

## Serious Issues

### Issue 1: Duplicate design docs for the same server

- **Files**: `docs/mcp-nitro-cortex-design.md` (new, 370 lines) and
  `docs/mcp-session-orchestrator-design.md` (existing, identical structure)
- **Problem**: Two design documents now describe the same MCP server in the same
  repository. The old file was not archived or deleted as part of this task. Neither
  file references the other or explains the relationship. A developer looking for MCP
  server documentation will find two files and have no indication which is authoritative.
- **Tradeoff**: Keeping both may feel safe ("preserve history"), but it creates a
  permanent maintenance burden — any future change to the server design must be applied
  to two files or they drift again immediately.
- **Recommendation**: Delete or archive `docs/mcp-session-orchestrator-design.md` in
  a follow-on task. At minimum, add a deprecation notice at the top of the old file
  pointing to the new one.

### Issue 2: Stale `session-orchestrator` in sibling docs not in scope

- **Files**: `docs/nitro-fueled-design.md` (line 57, 157, 234) and
  `docs/task-template-guide.md` (line 158)
- **Problem**: These files were not in task scope and were not updated. They now present
  the old name alongside updated files, creating an inconsistent docs directory. A reader
  who lands on `docs/nitro-fueled-design.md` will see `session-orchestrator` and be
  unsure whether the rename is complete.
- **Tradeoff**: Out-of-scope changes can expand task surface area, but in this case
  the files are pure documentation (not code) and the change is a mechanical rename.
  Leaving them creates ongoing confusion at low cost to fix.
- **Recommendation**: Create a follow-on task to sweep the remaining docs references.
  Not blocking this task, but it should be tracked.

---

## Minor Issues

- `docs/mcp-nitro-cortex-design.md` references `~/.claude/mcp_config.json` (line 318)
  which is not the standard location used elsewhere in the project (the project uses
  `.mcp.json` in the project root). This appears to be copied verbatim from the original
  design doc and may mislead developers about where to put the config.

---

## File-by-File Analysis

### `.claude/commands/nitro-auto-pilot.md`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean. No `session-orchestrator` occurrences. All MCP references use
`nitro-cortex`. The `+1 -1` diff correctly replaced the single stale reference.
The comment style, heading hierarchy, and parameter table format are consistent
with the rest of the command files.

---

### `CLAUDE.md`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean. No `session-orchestrator` occurrences. The `+1 -1` diff
updated the key docs reference correctly. All cortex MCP tool names use `nitro-cortex`.

---

### `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Scaffold copy is consistent with the canonical version in `.claude/`.
No stale references. The `+1 -1` change is correct and mirrors the canonical file.

---

### `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean. All MCP references name `nitro-cortex`. No `session-orchestrator`
occurrences. Hard rules, data access table, and compaction recovery section all use
the correct server name.

---

### `apps/cli/scaffold/.claude/skills/auto-pilot/references/worker-prompts.md`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean. Worker prompt templates reference `nitro-cortex` MCP tools correctly
(e.g., `update_task`, `emit_event`, `get_task_context`, `read_handoff`). No stale
tool names of the form `mcp__session-orchestrator__*`.

---

### `apps/cli/scaffold/.claude/skills/orchestration/references/agent-calibration.md`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean. This file does not reference the MCP server by name (agent
calibration is a record-keeping schema, not an MCP integration document). No
`session-orchestrator` or `nitro-cortex` tool calls appear here — which is correct.

---

### `docs/mcp-nitro-cortex-design.md` (new file, 370 lines)

**Score**: 3/10
**Issues Found**: 1 blocking, 1 serious, 1 minor

**Analysis**: The file was committed as a renamed copy of the original design doc
but was not fully updated. Three `session-orchestrator` occurrences remain: the
project directory name in the structure block, the MCP server key, and the binary
path in the config snippet. These are not in innocuous prose — they appear in a
copy-paste configuration block that developers are expected to use verbatim. The
file also does not supersede the old design doc (`mcp-session-orchestrator-design.md`),
which remains in the repo with no deprecation notice, creating a two-source-of-truth
problem.

**Specific Concerns**:
1. Line 49: `session-orchestrator/` — project structure block names the folder after
   the old server name.
2. Lines 322–324: MCP config block registers the server as `"session-orchestrator"`
   with an args path to `session-orchestrator/dist/index.js`. This is the highest-risk
   occurrence — it is the canonical config example.
3. Line 318: Config file path `~/.claude/mcp_config.json` does not match the
   project convention (`.mcp.json` in project root).

---

## Pattern Compliance

| Pattern                                      | Status | Concern                                        |
|----------------------------------------------|--------|------------------------------------------------|
| Zero `session-orchestrator` in scaffold       | PASS   | Scaffold directory is clean                    |
| Zero `session-orchestrator` in `.claude/`     | PASS   | Canonical command and skill files are clean    |
| Zero `session-orchestrator` in new design doc | FAIL   | 3 occurrences remain in docs/mcp-nitro-cortex-design.md |
| Backward-compat fallback preserved            | PASS   | `apps/cli/src/utils/mcp-config.ts` not touched |
| Single authoritative design doc               | FAIL   | Old `mcp-session-orchestrator-design.md` still exists alongside new file |

---

## Technical Debt Assessment

**Introduced**:
- Two design docs for the same MCP server with no relationship between them.
- A new design doc that contradicts its own title by retaining the old server name in
  the config block — the most reader-visible section of the file.

**Mitigated**:
- All scaffold files (`apps/cli/scaffold/.claude/`) are clean, resolving the primary
  runtime risk for freshly initialized projects.

**Net Impact**: Mixed. The scaffold regression is fixed (net positive), but a new
documentation inconsistency was introduced in the primary deliverable.

---

## Verdict

| Verdict | FAIL |
|---------|------|
| Overall | FAIL |

**Recommendation**: REVISE — fix the 3 stale occurrences in
`docs/mcp-nitro-cortex-design.md` before this task is considered complete. The
scaffold changes are correct and can be kept as-is.

**Confidence**: HIGH — the stale references are mechanically verifiable via grep.

**Key Concern**: The MCP config snippet in `docs/mcp-nitro-cortex-design.md` at
lines 322–324 registers the server under `"session-orchestrator"`, which is the
exact class of bug this task was created to eliminate. It migrated from scaffold
files to the design doc.

---

## What Excellence Would Look Like

A 10/10 implementation would:
1. Contain zero `session-orchestrator` occurrences across all files in scope AND the
   new design doc.
2. Either delete or add a top-of-file deprecation banner to
   `docs/mcp-session-orchestrator-design.md` so there is one authoritative source.
3. Update the MCP config path in the design doc from `~/.claude/mcp_config.json` to
   `.mcp.json` to match project convention.
4. Include a `grep -r session-orchestrator apps/cli/scaffold/ docs/` check in the
   handoff notes to prove the acceptance criterion is met across all affected paths.
