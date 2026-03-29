# Development Tasks - TASK_2026_122

**Total Tasks**: 14 | **Batches**: 4 | **Status**: 3/4 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `buildMcpConfigEntry` pattern in `mcp-setup-guide.ts`: Verified (line 43-53) — `buildNitroCortexConfigEntry` is a clean parallel addition.
- `mergeJsonFile` and `expandTilde` helpers in `mcp-configure.ts`: Verified (lines 6-42) — `configureNitroCortex` reuses these private helpers identically.
- `## MCP Requirement` section exists at line 1132 in auto-pilot SKILL.md: Verified — cortex availability check will be appended here.
- `apps/cli/scaffold/.claude/settings.json` does NOT exist: Verified — must be created.
- auto-pilot SKILL.md is ~3270 lines: Confirmed large file — targeted Edit calls are mandatory.

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| auto-pilot SKILL.md is ~3270 lines — full rewrites will destroy surrounding content | HIGH | Developer must use targeted Edit tool with exact old_string/new_string; read each section before editing |
| TASK_2026_107 and TASK_2026_112 may have changed SKILL.md text since plan was authored | HIGH | Developer must read the current SKILL.md text at each section before applying edits; semantic intent of each change is documented regardless of surrounding text |
| get_next_wave + claim_task double-claim risk | MED | Plan explicitly guards: claim_task in 5e-pre is skipped when get_next_wave was used |
| Status file must remain authoritative for subscribe_worker watchers | MED | All plan edits use "also call update_task" — never "instead call"; file writes preserved |

---

## Batch 1: auto-pilot SKILL.md — Steps 1-5 (Registry, Graph, Exclusion, Queue, Spawn) IN PROGRESS

**Developer**: nitro-systems-developer
**Tasks**: 5 | **Dependencies**: None

### Task 1.1: Replace Step 2 (Read Registry) with cortex preferred + fallback paths COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 49-100 (Step 1)
**Section to Find**: `### Step 2: Read Registry` (approximately line 1369)

**Implementation Details**:

Replace the current Step 2 section (which starts with `### Step 2: Read Registry` and contains 4 numbered items about reading registry.md and per-task status files) with the dual-path version from the plan that adds:
- Preferred path using `get_tasks()` MCP call
- Fallback path (original file-based logic preserved verbatim)
- `cortex_available` session flag detection logic (once per session, cached)

**Validation Notes**:

- RISK: Read the EXACT current text of Step 2 in SKILL.md before editing — it may have changed from the plan's snapshot due to TASK_2026_107/112.
- The fallback content must match the current SKILL.md text exactly (it is the old Step 2 content preserved inside the fallback block).

**Quality Requirements**:

- No stub text — full replacement block as specified in plan.md lines 67-96
- Fallback path content must be verbatim current SKILL.md text (not plan snapshot)
- Session flag `cortex_available` documented clearly

---

### Task 1.2: Prepend cortex fast path to Step 3 (Build Dependency Graph) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 104-144 (Step 2)
**Section to Find**: `### Step 3: Build Dependency Graph` (approximately line 1386)

**Implementation Details**:

The existing Step 3 content is preserved intact. The change is to PREPEND a new header block immediately before the existing `### Step 3: Build Dependency Graph` heading. The prepended block contains:
- Preferred path: use `get_tasks()` returned data directly (no additional file reads)
- BLOCKED write companion: both `update_task()` DB write AND status file write
- Fallback path label pointing to the existing content below

**Validation Notes**:

- RISK: Read the current Step 3 heading and opening lines before editing to confirm the insertion point.
- Do NOT replace the existing Step 3 content — only prepend. The existing classification tables, dependency validation, and orphan detection remain.

**Quality Requirements**:

- The heading `### Step 3: Build Dependency Graph` appears only once in the result (in the prepended block — the existing heading is removed since the new block replaces it with the full dual-path structure)
- Existing Step 3 body is intact and labeled as the fallback path

---

### Task 1.3: Replace Step 3d (Cross-Session Exclusion) with cortex atomic claim note COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 148-193 (Step 3)
**Section to Find**: `### Step 3d: Cross-Session Task Exclusion` (approximately line 1487)

**Implementation Details**:

Two edits in this task:

1. Replace the entire Step 3d body (from the heading to the closing `> **Staleness tolerance**` paragraph) with the two-bullet dual-path version:
   - cortex path: Step 3d removed (claim_task is atomic at DB level)
   - fallback path: original file-based active-sessions.md polling logic

2. In the Session Log table (near line 139), find the `Cross-session skip` row and replace it with the `Claim rejected (cortex)` row:
   - Find: `| Cross-session skip | ...CROSS-SESSION SKIP... |`
   - Replace: `| Claim rejected (cortex) | ...CLAIM REJECTED... |`

**Validation Notes**:

- RISK: Read both sections (Step 3d body and the Session Log table row) before editing — the table row is far from Step 3d in the file.
- The Session Log table is near the top of SKILL.md (~line 139). Verify the exact table row text before replacing.

**Quality Requirements**:

- Step 3d replacement is complete — no leftover references to file-based cross-session polling in the cortex path description
- Both edits applied (Step 3d body + Session Log table row)

---

### Task 1.4: Replace Step 4 (Order Task Queue) with get_next_wave preferred path COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 196-268 (Step 4)
**Section to Find**: `### Step 4: Order Task Queue` (approximately line 1510)

**Implementation Details**:

Replace the full Step 4 section content with the dual-path version:
- Preferred path: call `get_next_wave(session_id, slots)` which atomically claims and returns tasks
- Serialization check still applies on the cortex path (Serialized Reviews table in state.md)
- Fallback path: original two-queue construction + foreign_claimed_set filtering (preserved verbatim)

**Validation Notes**:

- RISK: Read the current Step 4 text before editing. The plan's old_string snapshot may not match if TASK_2026_107/112 changed this section.
- Confirm the fallback path text matches the current SKILL.md content exactly.

**Quality Requirements**:

- `get_next_wave(session_id, slots)` is clearly documented as claiming atomically (no separate claim_task needed on the cortex path)
- Serialization check note preserved for both paths
- Fallback path content is verbatim current SKILL.md Step 4 text

---

### Task 1.5: Add 5e-pre claim_task guard + replace 5h state write with update_session COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 272-321 (Step 5)
**Sections to Find**:
- `**5e. Call MCP \`spawn_worker\`:**` (approximately line 1629)
- `**5h. Write \`{SESSION_DIR}state.md\`**` (approximately line 1698)

**Implementation Details**:

Two insertions/replacements:

1. **5e-pre insertion**: Immediately before the `**5e. Call MCP \`spawn_worker\`:**` paragraph, insert the `**5e-pre. Claim task before spawning (cortex_available = true only):**` block with the claim_task guard logic and CLAIM REJECTED log format.

2. **5h replacement**: Replace the existing 5h paragraph (single sentence about writing state.md) with the dual-path version:
   - cortex path: `update_session()` to DB + also write state.md as snapshot
   - fallback path: write state.md only (original behavior)

**Validation Notes**:

- RISK: The 5e-pre block must clarify that it is SKIPPED when get_next_wave was used in Step 4 (anti-double-claim guard). Verify this note is included.
- Read both sections before editing to confirm exact surrounding text.

**Quality Requirements**:

- 5e-pre clearly states: skip this step if get_next_wave was used; only applies to fallback path spawns
- 5h dual-path: cortex writes both DB + file; fallback writes file only
- No placeholder text

---

**Batch 1 Verification**:

- All edits applied to `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
- File is syntactically coherent (markdown structure intact)
- nitro-code-logic-reviewer approved

---

## Batch 2: auto-pilot SKILL.md — Steps 6-9 (Monitoring, Completions, Compaction, MCP Section) COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 4 | **Dependencies**: Batch 1 complete

### Task 2.1: Update Step 6 state reads to use get_session COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 325-376 (Step 6)
**Sections to Find**:
- `#### Step 6 — MCP Empty Grace Period Re-Check (both modes)` (approximately line 1706)
- Step 6e polling mode state write (approximately line 1802)
- Event-driven mode Step 4 write (approximately line 1736)

**Implementation Details**:

Three targeted edits within Step 6:

1. Replace the `#### Step 6 — MCP Empty Grace Period Re-Check (both modes)` sub-section header and its reference to `{SESSION_DIR}state.md` with the dual-path version: cortex reads `mcp_empty_count` from `get_session(session_id)`; fallback reads state.md.

2. Replace the inline `{SESSION_DIR}state.md` write in Step 6e (polling mode) with the dual-path version: cortex calls `update_session()` with active_workers + mcp_empty_count AND writes state.md as snapshot; fallback writes state.md only.

3. Replace the event-driven mode Step 4 write with the dual-path version: cortex calls `update_session()` AND writes state.md snapshot; fallback writes state.md only.

**Validation Notes**:

- RISK: Read each of the three Step 6 sub-sections before editing. Line numbers are approximate.
- Monitoring logic (get_worker_activity, get_worker_stats, stuck detection) must remain unchanged — these are already MCP-based and are not touched.

**Quality Requirements**:

- Three distinct edits applied (grace period check, 6e polling write, event-driven write)
- Original monitoring logic untouched
- log.md append preserved for health events

---

### Task 2.2: Update Step 7 completions — state read, BLOCKED writes, release_task COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 380-439 (Step 7)
**Sections to Find**:
- `**7a. Read current task state:**` (approximately line 1804)
- Three `Write \`BLOCKED\`` locations (lines ~1796, ~1893, and in Step 3 dep validation ~1405)
- Step 7d terminal transition section (approximately line 1825)

**Implementation Details**:

Four edits:

1. **7a replacement**: Replace single-path state read with dual-path: cortex uses cached `get_tasks()` result or filters by task_id; if both DB and file differ, file takes precedence; fallback reads status file.

2. **BLOCKED write companions** (three locations): For each location that writes `BLOCKED` to the status file, add a companion line: `With cortex_available = true: also call update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))`.

3. **release_task after terminal transitions**: In Step 7d, after each validated state transition (IMPLEMENTED, COMPLETE), add `release_task(task_id, new_status)` call with the documented failure-tolerance behavior.

**Validation Notes**:

- RISK: Three BLOCKED write locations must all be found and updated. Check Step 3 dep validation section separately (it is at a different location from the Step 7 ones).
- release_task failure must be non-fatal: log and continue; status file is authoritative.

**Quality Requirements**:

- All three BLOCKED write locations updated with companion update_task call
- release_task added after BOTH IMPLEMENTED and COMPLETE transitions
- release_task failure handling: log + continue (non-fatal)
- 7a file-takes-precedence rule documented for conflict resolution

---

### Task 2.3: Replace compaction recovery bootstrap with get_session preferred path COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 443-495 (Step 8)
**Section to Find**: `**Compaction recovery bootstrap**:` (approximately line 1354)

**Implementation Details**:

Replace the existing 5-step file-based compaction recovery block with the dual-path version:
- Preferred path: call `get_session(session_id)` to restore full state; derive SESSION_DIR from session_id; reset mcp_empty_count to 0 (honor DB value only if confirmed by list_workers)
- Fallback path: original 5-step file-based recovery (active-sessions.md scan → SESSION_DIR extract → state.md read → mcp_empty_count reset)
- The fallback also retains the "scan task-tracking/sessions/ if active-sessions.md missing" contingency

**Validation Notes**:

- RISK: Read the exact text of the compaction recovery bootstrap before editing — it spans multiple lines and the old_string must match precisely.
- The fallback content must match the current SKILL.md text (not plan snapshot) since TASK_2026_107/112 may have modified it.

**Quality Requirements**:

- Preferred path clearly documents that session_id appears in log.md and active-sessions.md (so it survives compaction)
- Fallback path retains the missing active-sessions.md contingency
- mcp_empty_count handling documented for both paths

---

### Task 2.4: Add cortex availability check to MCP Requirement section + Session Log rows COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 499-533 (Step 9)
**Section to Find**: `## MCP Requirement (MANDATORY — HARD FAIL)` (line 1132)

**Implementation Details**:

Two edits:

1. After the existing MCP Requirement section text (the hard-fail block ending at ~line 1143), append the `### nitro-cortex Availability Check (optional — soft check)` subsection with:
   - Inspect tool list for `get_tasks`
   - Set cortex_available = true/false with corresponding log lines
   - Bootstrap note about `sync_tasks_from_files()` on first run

2. In the Session Log table (near line 139), add two new rows:
   - `| Cortex available | ...CORTEX AVAILABLE... |`
   - `| Cortex unavailable | ...CORTEX UNAVAILABLE... |`

**Validation Notes**:

- RISK: Read the Session Log table area before editing to find the exact insertion point for the two new rows.
- The MCP Requirement section ends — confirm the exact last line of the section before appending.
- The availability check is soft (no HARD FAIL) — preserve this distinction clearly.

**Quality Requirements**:

- Soft check clearly labeled "optional" vs the hard-fail MCP Requirement above it
- Bootstrap sync_tasks_from_files() note included
- Both Session Log table rows added

---

**Batch 2 Verification**:

- All edits applied to `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
- File markdown structure intact (no broken headings, tables, or code blocks)
- nitro-code-logic-reviewer approved

---

## Batch 3: orchestration SKILL.md + auto-pilot worker prompt templates — Step 10 COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 2 | **Dependencies**: Batch 2 complete

### Task 3.1: Update auto-pilot worker prompt templates for IN_PROGRESS + IMPLEMENTED cortex writes COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md lines 537-584 (Step 10a, 10b)
**Sections to Find**:
- First-Run Build Worker Prompt IN_PROGRESS write (approximately line 2199)
- First-Run Build Worker Prompt IMPLEMENTED write (approximately line 2213)
- Retry Build Worker Prompt — same patterns (approximately line 2274)

**Implementation Details**:

Four targeted replacements (two in First-Run prompt, two in Retry prompt):

1. IN_PROGRESS replacement (First-Run): After the existing `emit_event(worker_id=..., label="IN_PROGRESS", ...)` instruction, add the best-effort `update_task("TASK_YYYY_NNN", ...)` companion call with nitro-cortex availability check.

2. IMPLEMENTED replacement (First-Run): After step c (write status file), add the best-effort `update_task("TASK_YYYY_NNN", ...)` companion call.

3. IN_PROGRESS replacement (Retry prompt): Same as #1 above.

4. IMPLEMENTED replacement (Retry prompt): Same as #2 above.

All four additions are best-effort: if update_task fails, continue. Status file is authoritative.

**Validation Notes**:

- RISK: Read lines 2199-2220 and lines 2270-2290 to find the exact text before editing.
- The Retry prompt section must receive the identical additions — don't miss it.
- "best-effort" and "status file is authoritative" must be stated clearly in each addition.

**Quality Requirements**:

- All four locations updated (IN_PROGRESS + IMPLEMENTED in both First-Run and Retry prompts)
- Best-effort caveat explicit: "if it fails, continue"
- update_task call uses `fields=JSON.stringify({status: "..."})`

---

### Task 3.2: Update orchestration SKILL.md — Phase Event Emission note + Session setup COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md`
**Spec Reference**: plan.md lines 586-626 (Step 10c, 10d)
**Sections to Find**:
- `### Phase Event Emission (Supervisor Telemetry)` table (approximately line 366)
- `### Session Directory Setup (run once, on skill entry)` (approximately line 322)

**Implementation Details**:

Two additions in orchestration SKILL.md:

1. After the Phase Event Emission table (the `| status written as IMPLEMENTED | ... |` row), add the `**nitro-cortex companion writes** (Supervisor mode only, best-effort):` note block documenting the update_task companion calls for IN_PROGRESS and IMPLEMENTED.

2. After step 5 (`Register in active-sessions.md`) in the Session Directory Setup section, add step `6a` for nitro-cortex session registration (Supervisor mode only, best-effort): call `update_session(session_id, fields=JSON.stringify({loop_status: "running"}))` to confirm this worker's session is active.

**Validation Notes**:

- RISK: Read both sections in orchestration SKILL.md before editing (it is a different file from auto-pilot SKILL.md).
- Step 10c note is additive (after table) — do not modify the table itself.
- Step 10d is additive (new step 6a) — do not modify existing steps 1-5.

**Quality Requirements**:

- Note block clearly scoped: "Supervisor mode only, best-effort"
- 6a step clearly states: best-effort, if unavailable or error log and continue
- Neither addition modifies existing table rows or existing session setup steps

---

**Batch 3 Verification**:

- All edits applied to both SKILL.md files
- orchestration SKILL.md at `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md`
- auto-pilot SKILL.md worker prompt template edits verified
- nitro-code-logic-reviewer approved

---

## Batch 4: CLI Changes — Steps 11-14 COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 3 | **Dependencies**: Batch 3 complete (or can run in parallel with Batch 3 — no shared files)

### Task 4.1: Add buildNitroCortexConfigEntry to mcp-setup-guide.ts + configureNitroCortex to mcp-configure.ts COMPLETE

**Files**:
- `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/mcp-setup-guide.ts`
- `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/mcp-configure.ts`

**Spec Reference**: plan.md lines 630-711 (Steps 11, 12)

**Implementation Details**:

In `mcp-setup-guide.ts` (after line 53):

Add `buildNitroCortexConfigEntry(serverPath: string)` function that returns:
```typescript
{ mcpServers: { 'nitro-cortex': { type: 'stdio', command: 'node', args: [resolve(serverPath, 'dist', 'index.js')] } } }
```

In `mcp-configure.ts`:

1. Update the import on line 4 to import both `buildMcpConfigEntry` and `buildNitroCortexConfigEntry` from `./mcp-setup-guide.js`.

2. Add `configureNitroCortex(cwd, serverPath, location)` function after the existing `configureMcp` function (line 87). The function follows the identical pattern as `configureMcp`:
   - expandTilde + resolve path
   - existsSync check on resolvedServerPath
   - realpathSync
   - existsSync check on `resolve(realPath, 'dist', 'index.js')` entry point
   - `buildNitroCortexConfigEntry(realPath)` to build the entry
   - mergeJsonFile to `.mcp.json` (project) or `~/.claude.json` (global)
   - log success message

**Validation Notes**:

- RISK: Read the full `configureMcp` function in mcp-configure.ts to confirm the `mergeJsonFile` helper is module-private (not exported) and accessible to `configureNitroCortex`.
- The import update must not break the existing `buildMcpConfigEntry` usage.

**Quality Requirements**:

- `buildNitroCortexConfigEntry` export is clean parallel to `buildMcpConfigEntry` — same shape
- `configureNitroCortex` error messages reference 'nitro-cortex' (not 'session-orchestrator')
- Import line updated to named imports for both functions

---

### Task 4.2: Update init.ts to add cortex-path flag and handleNitroCortexConfig COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/init.ts`
**Spec Reference**: plan.md lines 715-793 (Step 13)

**Implementation Details**:

Four changes in init.ts:

1. **Imports**: Add `readFileSync` to the existing `node:fs` import (line 1). Add `import { configureNitroCortex } from '../utils/mcp-configure.js';` to the imports section.

2. **InitFlags interface** (approximately line 21-27): Add two fields:
   - `'cortex-path': string | undefined;`
   - `'skip-cortex': boolean;`

3. **flags static definition** (approximately line 361-368): Add two entries:
   - `'cortex-path': Flags.string({ description: 'Path to nitro-cortex server (packages/mcp-cortex in this repo)' })`
   - `'skip-cortex': Flags.boolean({ description: 'Skip nitro-cortex MCP configuration', default: false })`

4. **handleNitroCortexConfig function** (after `handleMcpConfig`, approximately line 266): Add the full function body from plan.md lines 739-779:
   - Skip if `opts['skip-cortex']`
   - Check if already configured by reading `.mcp.json` and inspecting `mcpServers['nitro-cortex']`
   - Prompt for serverPath if not provided via flag
   - Prompt for location (global/project) unless `opts.yes`
   - Call `configureNitroCortex(cwd, serverPath, location)`

5. **run() method call** (after `await handleMcpConfig(cwd, opts);`, approximately line 490): Add `await handleNitroCortexConfig(cwd, opts);`

**Validation Notes**:

- RISK: Read the current init.ts to verify line numbers before editing. The file has been modified by prior tasks.
- Confirm the exact import line for `node:fs` to avoid duplicating the import.
- The prompt() helper is already used by handleMcpConfig — confirm it is in scope for handleNitroCortexConfig.

**Quality Requirements**:

- No duplicate imports
- handleNitroCortexConfig is `async function` (not arrow function) consistent with handleMcpConfig style
- Already-configured check reads `.mcp.json` for `mcpServers['nitro-cortex']` key
- prompt() for serverPath accepts empty string as "skip" signal

---

### Task 4.3: Create apps/cli/scaffold/.claude/settings.json COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/scaffold/.claude/settings.json`
**Action**: CREATE
**Spec Reference**: plan.md lines 796-845 (Step 14)

**Implementation Details**:

First verify the parent directory exists:
```
/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/scaffold/.claude/
```

Create `settings.json` with the full content from plan.md lines 806-838:
- `mcpServers.nitro-cortex` entry with `type: "stdio"`, `command: "node"`, `args: ["{{NITRO_CORTEX_PATH}}/dist/index.js"]`
- `permissions.allow` array listing all 16 `mcp__nitro-cortex__*` tool names

**Validation Notes**:

- Verify the scaffold `.claude/` directory exists before creating — if not, create parent dirs.
- The `{{NITRO_CORTEX_PATH}}` placeholder is intentional (replaced at project setup time).
- The permissions.allow list must contain all 16 nitro-cortex tool names from the plan exactly.

**Quality Requirements**:

- Valid JSON (no trailing commas, proper quoting)
- All 16 `mcp__nitro-cortex__*` permission entries present
- Placeholder `{{NITRO_CORTEX_PATH}}` preserved as-is (not resolved to an actual path)

---

**Batch 4 Verification**:

- `mcp-setup-guide.ts` has `buildNitroCortexConfigEntry` exported
- `mcp-configure.ts` has `configureNitroCortex` exported with correct import update
- `init.ts` has cortex-path flag, skip-cortex flag, handleNitroCortexConfig, and run() call
- `apps/cli/scaffold/.claude/settings.json` created with valid JSON and all 16 permissions
- Build passes: `npx nx build cli`
- nitro-code-logic-reviewer approved
