# Code Style Review — TASK_2026_122

## Review Summary

| Metric          | Value                                         |
| --------------- | --------------------------------------------- |
| Overall Score   | 5/10                                          |
| Assessment      | NEEDS_REVISION                                |
| Blocking Issues | 3                                             |
| Serious Issues  | 4                                             |
| Minor Issues    | 3                                             |
| Files Reviewed  | 6                                             |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`handleNitroCortexConfig` in `init.ts:278-290` only checks `.mcp.json` for the
"already configured" early-exit. If the user chose `global` during a previous run,
`~/.claude.json` would contain the entry but `.mcp.json` would not exist, so the
guard never fires. Every subsequent `init` run will re-prompt and re-configure,
silently writing a duplicate entry into the global config. Six months from now
nobody will know why there are two nitro-cortex entries.

`configureMcp` has the same structural problem, but at least that function's
behaviour is unchanged by this PR.

### 2. What would confuse a new team member?

`auto-pilot/SKILL.md` now defines `cortex_available` in **two separate places** with
conflicting authority:
- Line ~1148: "nitro-cortex Availability Check" section — set it by inspecting the
  MCP tool list.
- Line ~1429: "Cortex availability detection" block inside Step 2 — set it by
  calling `get_tasks()`.

Both sections say "once per session, cached" but the detection method differs (tool
list inspection vs. a live call). A new worker reading the document cannot tell
which to follow. This is the kind of ambiguity that causes different workers to take
different code paths in production.

### 3. What's the hidden complexity cost?

`configureNitroCortex` in `mcp-configure.ts:89-128` is a near-verbatim copy of
`configureMcp` (lines 44-87). The only differences are: the error message text, the
call to `buildNitroCortexConfigEntry` instead of `buildMcpConfigEntry`, and the
**omission** of the portability warning for project-level config. This is 39 lines
of duplicated validation logic — path expansion, `realpathSync` try/catch,
entry-point existence check, `mergeJsonFile` call — that will diverge silently.
When someone fixes a bug in `configureMcp`, they must remember to fix the same bug
in `configureNitroCortex`. They won't.

Similarly, `buildMcpConfigEntry` and `buildNitroCortexConfigEntry` in
`mcp-setup-guide.ts` share identical structure, differing only in the server name
key. The return type `Record<string, unknown>` swallows any future type safety at
both call sites.

### 4. What pattern inconsistencies exist?

**Step numbering in orchestration SKILL.md**: The new step inserted at line 336 is
labelled `6a.` but the very next line is `6.` (the existing log-append step). The
review-general lesson at line 61 explicitly prohibits mixed step numbering
(`Step 5, 5b, 5c` pattern). This PR reproduces exactly that anti-pattern.

**`printSummary` duplicate step 4**: Lines 397-401 in `init.ts` can produce two
step-4 lines if both `!mcpConfigured && skipMcp` and `skipCortex` are true. The
user sees `4. Configure MCP server` and `4. Configure nitro-cortex MCP server`
back-to-back — the numbering is broken.

**`as` type assertions** in `handleNitroCortexConfig`: Lines 281 and 282 use `as
Record<string, unknown>`. The review-general rule is explicit: "No `as` type
assertions — if the type system fights you, the type is wrong." Both casts could be
replaced with a type guard function. The same pattern exists in `configureMcp`'s
`mergeJsonFile` (lines 17, 25-26), but that predates this PR.

### 5. What would I do differently?

1. Extract the shared path-validation + mergeJsonFile logic in `mcp-configure.ts`
   into a private helper `validateAndConfigureMcpServer(cwd, serverPath, location,
   entryBuilder, serverLabel)`. Both `configureMcp` and `configureNitroCortex` call
   it with different parameters. One implementation, zero duplication.

2. Consolidate `cortex_available` detection in auto-pilot SKILL.md to a single
   canonical definition with a cross-reference link rather than two competing
   paragraphs.

3. Fix `printSummary` to use sequential step numbers (4 and 5) when both conditions
   are true.

4. Fix the `6a.` / `6.` numbering in orchestration SKILL.md.

---

## Blocking Issues

### B1: `cortex_available` defined twice with different detection methods

- **File**: `.claude/skills/auto-pilot/SKILL.md`, line ~1148 and line ~1429
- **Problem**: "nitro-cortex Availability Check" (startup section) says detect by
  inspecting the MCP tool list for `get_tasks`. "Cortex availability detection" at
  Step 2 says detect by calling `get_tasks()` and checking whether it succeeds.
  These are different operations (static tool list inspection vs. live call). A
  supervisor reading both sections will see a contradiction: one says set the flag at
  pre-flight, the other says set it at Step 2. The "It is NOT re-checked per loop"
  constraint appears in both sections but refers to different moments in time.
- **Impact**: Workers will interpret this differently. Some will set `cortex_available`
  at startup and never call `get_tasks()` at Step 2; others will skip the pre-flight
  check and defer to Step 2. This produces inconsistent session initialisation in
  production.
- **Fix**: Remove the redundant "Cortex availability detection" block at line ~1429.
  The canonical definition is the pre-flight "nitro-cortex Availability Check"
  section. Add a single-line cross-reference at Step 2: "Use `cortex_available` flag
  set during pre-flight (see nitro-cortex Availability Check section)."

---

### B2: `configureNitroCortex` is a verbatim duplication of `configureMcp`

- **File**: `apps/cli/src/utils/mcp-configure.ts:89-128`
- **Problem**: 39 lines duplicated from lines 44-87. Every validation branch — path
  expansion, `realpathSync` try/catch, entry-point existence check, `mergeJsonFile`
  call, success log — is copy-pasted. The portability warning (`console.warn` at
  line 75) is absent from `configureNitroCortex`, which is already a silent
  divergence introduced by this PR. The next bug fix or feature addition in
  `configureMcp` will not be applied to `configureNitroCortex`.
- **Impact**: Technical debt immediately; production inconsistency eventually.
- **Fix**: Extract a shared helper:
  ```typescript
  async function configureGenericMcpServer(
    cwd: string,
    serverPath: string,
    location: 'project' | 'global',
    buildEntry: (resolvedPath: string) => Record<string, unknown>,
    serverLabel: string,
  ): Promise<boolean>
  ```
  Both public functions become thin wrappers that pass different `buildEntry` and
  `serverLabel` arguments.

---

### B3: `printSummary` produces duplicate step 4

- **File**: `apps/cli/src/commands/init.ts:396-401`
- **Problem**: When both `!mcpConfigured && skipMcp` and `skipCortex` are true, the
  user sees two lines labelled `4.` in the Next Steps output. The review-general
  lesson (step numbering must be flat and sequential) is violated.
- **Impact**: CLI UX confusion. Users who parse the output programmatically (in
  scripts that watch for "step 4") will execute the wrong action.
- **Fix**: Track a mutable `stepNum` counter starting at 4, increment after each
  conditional line:
  ```typescript
  let step = 4;
  if (!mcpConfigured && skipMcp) {
    console.log(`  ${step++}. npx nitro-fueled init --mcp-path <path>   Configure MCP server`);
  }
  if (skipCortex) {
    console.log(`  ${step++}. npx nitro-fueled init --cortex-path <path>   Configure nitro-cortex MCP server`);
  }
  ```

---

## Serious Issues

### S1: `handleNitroCortexConfig` "already configured" guard is incomplete

- **File**: `apps/cli/src/commands/init.ts:278-290`
- **Problem**: The guard reads only `.mcp.json` (project-level config). If the user
  previously ran `init` and chose `global`, the entry lives in `~/.claude.json` and
  the guard never fires. Re-running `init` without `--skip-cortex` will re-prompt
  and re-write, resulting in a duplicate entry in the global config.
- **Comparison**: `handleMcpConfig` uses `detectMcpConfig(cwd)` which checks both
  locations. The cortex handler does not use any equivalent dual-location check.
- **Recommendation**: Either (a) check `~/.claude.json` as a second guard, or (b)
  expose a `detectNitroCortexConfig(cwd)` helper analogous to `detectMcpConfig` that
  checks both locations. The asymmetry between the two handlers is a maintenance trap.

---

### S2: `6a.` / `6.` step numbering in orchestration SKILL.md

- **File**: `.claude/skills/orchestration/SKILL.md:336-345`
- **Problem**: The new step is numbered `6a.` and is immediately followed by the
  existing step `6.`. The review-general lesson explicitly forbids mixed numbering
  schemes (`Step 5, 5b, 5c` pattern). The session-init sequence is now `5, 6a, 6`
  which is ambiguous about execution order and makes cross-references fragile.
- **Recommendation**: Renumber to `6.` (new step) and `7.` (the existing log-append
  step), updating the subsequent "On finish" list if those reference step numbers.

---

### S3: Missing portability warning in `configureNitroCortex`

- **File**: `apps/cli/src/utils/mcp-configure.ts:119-121`
- **Problem**: `configureMcp` at line 74-76 emits a `console.warn` when
  `location === 'project'`, advising users that absolute paths are not portable.
  `configureNitroCortex` has no equivalent warning. Both write the same
  absolute-path format to `.mcp.json`, so the UX is inconsistent and the user loses
  the safety notice for the new server.
- **Recommendation**: Add the portability warning to `configureNitroCortex`, or
  extract it into the shared helper described in B2.

---

### S4: `as` type assertions in `handleNitroCortexConfig`

- **File**: `apps/cli/src/commands/init.ts:281-282`
- **Problem**: Two `as Record<string, unknown>` casts are used when reading
  `.mcp.json`. The review-general rule is explicit: no `as` assertions. If the JSON
  file contains a non-object root (e.g., an array or a string), the cast succeeds at
  compile time but crashes at runtime on `cfg['mcpServers']`.
- **Recommendation**: Use a type-guard:
  ```typescript
  function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }
  ```
  Then: `const parsed: unknown = JSON.parse(...); if (!isRecord(parsed)) { /* fall through */ }`.
  This pattern already exists implicitly in `mergeJsonFile` but is not exported.

---

## Minor Issues

### M1: `buildNitroCortexConfigEntry` and `buildMcpConfigEntry` return `Record<string, unknown>`

- **File**: `apps/cli/src/utils/mcp-setup-guide.ts:43-65`
- **Problem**: Both functions return `Record<string, unknown>`, which loses the
  structure at the call site. The callers in `mcp-configure.ts` immediately cast the
  `mcpServers` key back to `Record<string, unknown>` without type safety. A named
  interface `McpConfigEntry` would make the contract explicit and allow the compiler
  to catch shape mismatches.

---

### M2: `scaffold/.claude/settings.json` uses a `{{MUSTACHE}}` template token

- **File**: `apps/cli/scaffold/.claude/settings.json:6`
- **Problem**: `"{{NITRO_CORTEX_PATH}}/dist/index.js"` is a template placeholder that
  will be copied verbatim into target projects by `npx nitro-fueled init`. Nothing in
  the CLI replaces this token at copy time. This file will break Claude Code MCP
  loading in any project that uses it as-is.
- **Note**: This may be intentional if the intent is for users to manually edit the
  file. But if so, a comment or README note explaining the required substitution is
  missing.

---

### M3: `handleNitroCortexConfig` comment style differs from `handleMcpConfig`

- **File**: `apps/cli/src/commands/init.ts:277`
- **Problem**: `handleNitroCortexConfig` has an inline comment `// Check if already
  configured` before the guard block. `handleMcpConfig` (the parallel function) uses
  no inline comments, relying on code readability alone. Minor inconsistency in
  comment density between the two sibling functions.

---

## File-by-File Analysis

### `apps/cli/src/utils/mcp-configure.ts`

**Score**: 4/10
**Issues Found**: 1 blocking, 2 serious, 0 minor

The new `configureNitroCortex` function (lines 89-128) is a structural copy of
`configureMcp` with a minor label change. The portability warning is silently
dropped. This file already contained one instance of the duplication pattern (the two
`buildEntry*` functions in `mcp-setup-guide.ts`), but this PR adds a larger and more
dangerous duplication. Any future caller of `configureNitroCortex` will receive
subtly different behavior (no portability warning) without any indication in the
function signature or docstring.

---

### `apps/cli/src/utils/mcp-setup-guide.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

`buildNitroCortexConfigEntry` (lines 55-65) is structurally correct and mirrors the
existing pattern for `buildMcpConfigEntry`. The duplication is less dangerous here
since both functions are pure and side-effect-free. The return type weakness
(`Record<string, unknown>`) is a minor issue shared with the pre-existing function,
not introduced specifically by this PR, but worth noting because the PR adds a second
caller of the same weak type.

---

### `apps/cli/src/commands/init.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 2 serious, 0 minor

`handleNitroCortexConfig` follows the structural pattern of `handleMcpConfig` closely,
which is good. The `as` assertions and incomplete already-configured guard are the
main problems. The `printSummary` duplicate step-4 issue is subtle — it only
manifests when both flags are true simultaneously — but is a real UX defect. The
`InitFlags` interface is updated correctly and consistently.

---

### `apps/cli/scaffold/.claude/settings.json`

**Score**: 5/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

The permissions list is comprehensive and matches the MCP tool list from context.md.
The `{{NITRO_CORTEX_PATH}}` template token is the concern — without a clear mechanism
to substitute it, every installed project will have a non-functional path. If this
file is meant as a template that `init` fills at copy time, the substitution code is
missing from `scaffoldFiles`. If it's a static example, it needs a comment header.

---

### `.claude/skills/orchestration/SKILL.md`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

The cortex companion writes section (added ~line 395) is clearly written and the
best-effort framing is correct. The `update_task` call being fire-and-forget is the
right design for a non-blocking integration. The only defect is the `6a.` numbering,
which violates an explicit project-wide rule.

---

### `.claude/skills/auto-pilot/SKILL.md`

**Score**: 4/10
**Issues Found**: 1 blocking, 0 serious, 0 minor

The dual-definition of `cortex_available` is the primary concern. The individual
step changes (Steps 3, 4, 5, 6, 7) are well-structured, consistently apply the
"preferred path / fallback path" pattern, and the file/DB dual-write with file as
authoritative is sound design. But the contradictory detection definitions in the
pre-flight section and Step 2 are a specification defect that will produce divergent
worker behavior.

---

## Pattern Compliance

| Pattern                           | Status | Concern                                                                |
| --------------------------------- | ------ | ---------------------------------------------------------------------- |
| No `as` type assertions           | FAIL   | `init.ts:281-282` — two casts on JSON read                             |
| DRY / no duplication              | FAIL   | `mcp-configure.ts:89-128` — near-verbatim copy of `configureMcp`      |
| Sequential step numbering         | FAIL   | `orchestration/SKILL.md:336` — `6a.` before `6.`                      |
| Single canonical definition       | FAIL   | `auto-pilot/SKILL.md` — `cortex_available` defined twice               |
| Consistent UX across parallel features | FAIL | `configureNitroCortex` missing portability warning present in `configureMcp` |
| Type safety                       | PASS   | No `any` types introduced                                              |
| Error handling (no swallowed errors) | PASS | All catch blocks log or fall through with comment                    |
| Naming conventions                | PASS   | `configureNitroCortex`, `buildNitroCortexConfigEntry` follow camelCase |

---

## Technical Debt Assessment

**Introduced**:
- `configureNitroCortex` duplication will require double-maintenance on every future
  change to the MCP configure path (path validation, error messaging, global config
  location changes).
- `cortex_available` dual-definition in SKILL.md will require coordinated edits in
  two locations whenever the detection strategy changes.

**Mitigated**:
- The `as` cast pattern already existed in `mergeJsonFile`; this PR adds two more
  instances but does not make it worse architecturally.

**Net Impact**: Slight increase in debt. The duplication issues are the most
compound-able risk.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `configureNitroCortex` is a 39-line copy-paste of `configureMcp`
that already silently differs (missing portability warning). Extract the shared
logic before this merges. The dual `cortex_available` definition in SKILL.md is a
close second — two workers reading the same document will take different code paths.

## What Excellence Would Look Like

A 9/10 implementation would:
1. Extract `configureGenericMcpServer` so both public functions are 5-line wrappers.
2. Expose `detectNitroCortexConfig` (checking both `.mcp.json` and `~/.claude.json`)
   so `handleNitroCortexConfig` uses the same dual-location guard as `handleMcpConfig`.
3. Consolidate `cortex_available` to a single definition in the pre-flight section
   with a cross-reference at Step 2.
4. Renumber step `6a.` to `6.` in orchestration SKILL.md.
5. Emit a `console.warn` for the portability note in `configureNitroCortex`.
6. Fix the duplicate step-4 in `printSummary`.
7. Replace `as` casts with an `isRecord` type guard.
8. Add a substitution note or runtime replacement for the `{{NITRO_CORTEX_PATH}}`
   token in the scaffold settings.json.
