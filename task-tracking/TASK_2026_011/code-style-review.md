# Code Style Review — TASK_2026_011

## Summary

The status command implementation is clean, well-structured, and consistent with sibling CLI commands (`run.ts`, `init.ts`). Import organization, naming, and TypeScript usage are solid. However, there are several style issues worth addressing: redundant type assertions on regex match groups, an unused variable in the column layout, inconsistent null-check style across the file, and a markdown table parser that is brittle and undocumented. Nothing here is blocking, but the accumulated minor issues add up to a file that could be tighter.

Score: 6.5/10 -- Acceptable with several areas to improve.

## Findings

### [MAJOR] Redundant `as string` assertions on regex capture groups (violates review-general.md)

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/status.ts:86-91`
- Also: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/registry.ts:42-49`
- Issue: The review-general.md rule is explicit: "No `as` type assertions -- if the type system fights you, the type is wrong." These lines use `as string` on values that are already `string | undefined` from regex match groups. The assertion adds no safety and suppresses the type checker.
- Example:
  ```typescript
  // status.ts:86
  workerId: cells[0] as string,  // cells[0] is already string
  // registry.ts:42
  const status = match[2] as string;  // match[2] is string | undefined
  ```
  In `registry.ts:42`, the assertion is actively misleading -- `match[2]` could be `undefined`, and `as string` hides that. The subsequent `.includes(status as TaskStatus)` check happens to guard against bad data, but the assertion communicates false confidence to future readers.
- Suggestion: For `status.ts` table cells, the values are already strings (filtered by `.filter((c) => c.length > 0)` and guarded by `cells.length >= 7`), so remove `as string` entirely. For `registry.ts`, use optional chaining or a null guard instead of asserting.

### [MAJOR] Inconsistent null-check style: `=== null` vs `!== null` vs optional chaining

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/status.ts` (throughout)
- Issue: The file mixes three null-checking styles:
  - Explicit `=== null` / `!== null` comparisons (lines 49, 134)
  - Optional chaining with nullish coalescing `?.trim() ?? ''` (lines 117-118, 139-141)
  - Ternary with `!== null` (lines 127-129)
  - `!== undefined` for map lookups (line 186)

  Each is defensible individually, but the mix within a single file increases cognitive load. The `run.ts` sibling also uses `=== null` / `!== null` consistently, suggesting that is the project convention for explicit checks, while `?.` should be reserved for deep access chains.
- Suggestion: Pick one style per pattern and be consistent. For regex match results, use `match?.[1]?.trim() ?? 'fallback'` everywhere. For `existsSync` / `Map.get` results, use explicit `=== null` / `=== undefined`.

### [MINOR] Unused `descWidth` constant used only for separator, not for column padding

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/status.ts:229`
- Issue: `descWidth` is defined as `45` and used to build the separator line (line 243) and to truncate descriptions (line 249), but the header column for "Description" is not padded to `descWidth` (line 235 just uses the bare string `'Description'`). This is inconsistent with the other three columns which are all padded via `.padEnd()`. The visual result is a separator line that extends 45 chars for the description column but a header that does not align.
- Suggestion: Either pad the Description header too (`'Description'.padEnd(descWidth)`) or drop `descWidth` from the separator since description is the last column and padding it is cosmetic.

### [MINOR] Magic number `7` for worker table column count

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/status.ts:84`
- Issue: `cells.length >= 7` is a magic number. The orchestrator-state.md table has a specific column schema, and this number is not documented. A future change to the table format will require someone to trace back what column 0, 1, 2, 3, 4, 6 map to (notably: column 5 is skipped, which is not explained anywhere).
- Suggestion: Add a comment explaining the expected column layout, e.g., `// Columns: Worker ID | Task | Type | Label | Status | PID | Health | Started`. Also document why index 5 (PID) is intentionally skipped.

### [MINOR] `RegistryRow.type` and `RegistryRow.description` are bare `string` -- not string literal unions

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/registry.ts:16-17`
- Issue: The review-general.md rule states "String literal unions for status/type/category fields -- never bare `string`." The `type` field has known valid values (FEATURE, BUG, CHORE, etc. per the task template) but is typed as `string`. Similarly `id` and `created` are bare strings when they have known formats (TASK_YYYY_NNN, YYYY-MM-DD).
- Suggestion: At minimum, add a `TaskType` string literal union for `type`. The `id` and `created` fields are less critical since they are display-only, but a branded type or template literal type (`\`TASK_${number}_${number}\``) would add safety for consumers that do matching.

### [MINOR] `parseActiveWorkers` and `parsePlan` are not exported -- untestable in isolation

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/status.ts:40,100`
- Issue: These functions contain non-trivial regex parsing logic (markdown table parsing, phase extraction) but are private to the module. If tests are added later, they cannot be tested without going through the full `registerStatusCommand` flow.
- Suggestion: Extract to `utils/` files (e.g., `utils/orchestrator-state.ts`, `utils/plan.ts`) and export them, consistent with how `parseRegistry` was extracted to `utils/registry.ts`. This would also reduce `status.ts` from 303 lines to roughly 100 lines of pure display logic.

### [NIT] Import grouping does not separate Node builtins from third-party

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/status.ts:1-5`
- Issue: Node builtins (`node:fs`, `node:path`) and third-party (`commander`) are in one block without a blank line separator. The project convention (from the Angular side) specifies blank lines between import groups. The sibling `run.ts` also lacks this separation, so this is a project-wide pattern rather than a one-off, but it is still technically a deviation from the stated import ordering rule.
- Suggestion: Add a blank line after the `node:*` imports and before the `commander` import.

### [NIT] `parseRegistry` regex does not handle descriptions containing `|`

- File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/registry.ts:39`
- Issue: The regex uses `(.+?)` for the description column. If a task description contains a pipe character `|`, the regex will break, capturing only the text before the pipe. This is an edge case but worth noting since descriptions are free-text.
- Suggestion: Document this limitation with a comment, or switch to a split-based parser like `parseActiveWorkers` uses.

## Verdict

**PASS_WITH_NOTES**

The code is functional, readable, and consistent with sibling commands. The `as string` assertions are the most notable style violation given the explicit rule in review-general.md. The inconsistent null-check style and the untestable parser functions are worth addressing but not blocking. The file is at 303 lines -- just barely over the 150-line component limit, though this is a CLI command file, not an Angular component, so the limit may not strictly apply. Still, extracting the parsers to utils would improve both testability and line count.
