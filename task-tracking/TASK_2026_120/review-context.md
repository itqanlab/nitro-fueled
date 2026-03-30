# Review Context — TASK_2026_120

## Task Scope
- Task ID: 2026_120
- Task type: FEATURE
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - `packages/mcp-cortex/package.json` (created)
  - `packages/mcp-cortex/tsconfig.json` (created)
  - `packages/mcp-cortex/project.json` (created)
  - `packages/mcp-cortex/src/index.ts` (created)
  - `packages/mcp-cortex/src/db/schema.ts` (created)
  - `packages/mcp-cortex/src/tools/tasks.ts` (created)
  - `packages/mcp-cortex/src/tools/wave.ts` (created)
  - `packages/mcp-cortex/src/tools/sync.ts` (created)
  - `.mcp.json` (modified — needs manual update, permission denied during build)
  - `.gitignore` (modified)
  - `package.json` (modified — added packages/* to workspaces)

## Git Diff Summary

Implementation commit: `f66277a` — `feat(cortex): implement TASK_2026_120 — MCP tools, build fixes, zod 4 compat`

Files changed:
- `packages/mcp-cortex/package.json` — upgraded `@modelcontextprotocol/sdk` ^1.12.1→^1.28.0, `zod` ^3.24.4→^4.3.6, `typescript` ^5.8.3→^5.9.3
- `packages/mcp-cortex/src/db/schema.ts` — removed accidental `#!/usr/bin/env node` shebang from non-entrypoint file
- `packages/mcp-cortex/src/index.ts` — migrated `server.tool()` → `server.registerTool()` API; moved Zod schemas inline; removed separate schema exports from tools; `update_task` now accepts `fields` as JSON string (avoids `z.record()` TS2589 deep type error with SDK 1.28 + Zod 4)
- `packages/mcp-cortex/src/tools/tasks.ts` — removed exported schema objects (`getTasksSchema`, `claimTaskSchema`, `releaseTaskSchema`, `updateTaskSchema`); removed `zod` and type imports no longer used
- `packages/mcp-cortex/src/tools/wave.ts` — removed exported `getNextWaveSchema` and `zod` import

### Key Implementation Details

**index.ts** (82 lines):
- Uses `server.registerTool()` with inline Zod schemas
- `update_task` handler does `JSON.parse(args.fields) as Record<string, unknown>` to reconstruct typed fields
- `get_next_wave` `slots` schema uses `z.number()` (no `.int().min(1).max(20)` validation — was present in removed schema)
- Logs diagnostics to `console.error` (correct for MCP stdio servers)
- Graceful shutdown on SIGINT/SIGTERM

**tasks.ts** (120 lines):
- `handleGetTasks` — parameterized SQL with whitelist filters; dependency filtering post-query
- `handleClaimTask` — uses `db.transaction()` (SQLite WAL journal mode); SELECT-then-UPDATE pattern; sets status to `IN_PROGRESS` automatically on claim
- `handleReleaseTask` — clears claim, sets `new_status` directly (no validation of status value)
- `handleUpdateTask` — column whitelist enforced; serializes object values to JSON

**wave.ts** (55 lines):
- `handleGetNextWave` — wrapped in `db.transaction()`; resolves dependency graph; does NOT set status to `IN_PROGRESS` on claim (inconsistency with `handleClaimTask`)

**sync.ts** (145 lines):
- File system scanner with regex `TASK_ID_RE = /^TASK_\d{4}_\d{3}$/`
- Parses task.md for metadata via regex; parses status file
- Uses upsert (INSERT OR UPDATE); wrapped in transaction
- `acceptance_criteria` field is in schema but NOT populated by sync (not in the INSERT)
- Error accumulation per task; returns summary

**schema.ts** (80 lines):
- Three tables: `tasks`, `sessions`, `workers`
- `TaskType` union includes `'BUG'` but task tracking system uses `'BUGFIX'`
- WAL journal mode + foreign keys enabled
- Indexes on `tasks.status`, `tasks.session_claimed`, `workers.session_id`, `workers.task_id`

## Project Conventions

From CLAUDE.md relevant to TypeScript packages:
- TypeScript files in `packages/` follow standard TS conventions
- No `any` type — use `unknown` + type guards
- No `as` type assertions — if the type system fights you, fix the type
- Conventional commits with scopes
- Agent files are markdown; skill files use pipe-table log format (not applicable here — this is a TypeScript package)

## Style Decisions from Review Lessons

Relevant rules from review-general.md:

**TypeScript Conventions:**
- **No `any` type ever** — use `unknown` + type guards, or proper generics
- **No `as` type assertions** — if the type system fights you, the type is wrong
- **String literal unions for status/type/category fields** — never bare `string`
- **No unused imports or dead code** — if exported but never imported, remove it
- **Falsy checks skip zero values** — use `!== undefined` or `!= null`

**File Size Limits:**
- Services/repositories: max 200 lines (sync.ts is 145 — OK; tasks.ts is 120 — OK)

**Error Handling:**
- **Never swallow errors** — at minimum, log them
- **Delete/update on non-existent ID must return indicator** — never silent void success
- **Error messages must be human-readable** — wrap at boundaries

**TypeScript Cross-Package:**
- **Enum/union types must be synchronized across all consumers** — `TaskType` has `'BUG'` but system uses `'BUGFIX'`

## Scope Boundary (CRITICAL)

Reviewers MUST only flag and fix issues in these files:
- `packages/mcp-cortex/package.json`
- `packages/mcp-cortex/tsconfig.json`
- `packages/mcp-cortex/project.json`
- `packages/mcp-cortex/src/index.ts`
- `packages/mcp-cortex/src/db/schema.ts`
- `packages/mcp-cortex/src/tools/tasks.ts`
- `packages/mcp-cortex/src/tools/wave.ts`
- `packages/mcp-cortex/src/tools/sync.ts`
- `.gitignore`
- `package.json`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 8
- Serious: 8
- Minor: 10

Blocking issues (cross-reviewer, deduped):
1. `session_claimed`/`claimed_at` in `UPDATABLE_COLUMNS` bypasses atomic claim protocol (Security H-1)
2. Unhandled `JSON.parse` in `update_task` handler crashes tool on bad input (Security H-2 / Logic HIGH-1)
3. `TaskType` enum has `'BUG'` but project uses `'BUGFIX'` — CHECK constraint will reject all BUGFIX task imports (Style BLOCKER / Logic HIGH-3)
4. `as` assertion in `index.ts:59` — `JSON.parse(args.fields) as Record<string, unknown>`
5. `as` assertion in `tasks.ts:30` — `.all() as Array<Record<string, unknown>>`
6. `as` assertion in `tasks.ts:37` — nested assertions on dependency JSON
7. `as` assertions in `tasks.ts:54-55` — claim/existing row fetch
8. `handleGetNextWave` does not set `status = IN_PROGRESS` on claimed tasks (Logic HIGH-2)

---

## Notable Issues to Investigate

1. **`as` type assertions** in index.ts (`as Record<string, unknown>`) and tasks.ts (`as Array<Record<string, unknown>>`, `as { session_claimed: string | null }`)
2. **Lost validation** on `slots` parameter: `z.number()` vs previous `z.number().int().min(1).max(20)` — no bounds checking
3. **`new_status` unvalidated** in `handleReleaseTask` — caller can set any string, bypassing the CHECK constraint (SQLite will reject at DB level but returns an unhandled error)
4. **Inconsistency**: `handleClaimTask` sets `status = IN_PROGRESS`; `handleGetNextWave` does NOT set status — claimed tasks remain CREATED
5. **`acceptance_criteria` missing from sync upsert** — schema column exists but sync never populates it
6. **`TaskType` enum mismatch**: schema has `'BUG'` but the project uses `'BUGFIX'` in task files
7. **Unhandled JSON.parse** in index.ts `update_task` handler — `JSON.parse(args.fields)` can throw on malformed input; no try/catch
8. **`db.transaction()` vs `BEGIN EXCLUSIVE`** — task spec called for `BEGIN EXCLUSIVE` in `claim_task`; `db.transaction()` in better-sqlite3 uses `BEGIN` by default (not EXCLUSIVE), which may not prevent race conditions at high concurrency
