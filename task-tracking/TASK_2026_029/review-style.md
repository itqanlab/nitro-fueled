# Code Style Review - TASK_2026_029

## Review Summary

| Metric          | Value           |
| --------------- | --------------- |
| Overall Score   | 6/10            |
| Assessment      | NEEDS_REVISION  |
| Blocking Issues | 3               |
| Serious Issues  | 5               |
| Minor Issues    | 4               |
| Files Reviewed  | 8               |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `STACK_TO_TAGS` map in `packages/cli/src/utils/anti-patterns.ts:9-39` is a manually maintained parallel data structure to `AGENT_MAP` and the tag reference table in `anti-patterns-master.md`. There are three separate places that must agree: the master file's Tag Reference table, the `STACK_TO_TAGS` constant, and the framework detection in `stack-detect.ts`. When a contributor adds a new framework to `stack-detect.ts`, they must update all three. Currently `fastify` maps to `['nodejs']` in STACK_TO_TAGS (line 19) — correct — but `tauri` also maps to `['nodejs']` (line 21) despite Tauri being a Rust framework. A Rust project using Tauri would get nodejs rules, which is wrong. This cross-map drift is already present on day one.

The `filterMasterByTags` parser at `anti-patterns.ts:134-174` is a bespoke line-by-line state machine parsing HTML comment tags. If someone edits `anti-patterns-master.md` and puts content before the first `<!-- tags: ... -->` comment, or writes `<!-- tags: universal -->` with a trailing space, or embeds a comment inside a code fence, the parser silently produces wrong output. There is no validation that the filtered output is non-empty.

### 2. What would confuse a new team member?

The label-building code is duplicated verbatim in two places: `handleAntiPatterns()` in `init.ts:127-133` and `buildHeader()` in `anti-patterns.ts:183-187`. Both produce the "typescript + angular" style label string from a `DetectedStack[]`. A new contributor fixing one will not know to fix the other, and they will diverge. The duplication is unnecessary — `handleAntiPatterns` could use the already-computed header from `buildHeader`.

Also confusing: the `init.ts` step comment says "Step 5b: Ensure .nitro-fueled/ is gitignored" at line 314, while step numbering jumps from 5 to 5b to 5c, then resumes at 6 and 6b. This violates the review-general.md lesson about flat sequential numbering (documented from TASK_2026_043). A reviewer or future contributor cannot reference "Step 6" without ambiguity.

### 3. What's the hidden complexity cost?

`detectTailwind()` in `anti-patterns.ts:93-103` is a substring search on the entire `package.json` string: `content.includes('"tailwindcss"')`. This is slightly more brittle than the `detectDatabase` approach (which parses JSON), but more importantly it duplicates logic that `stack-detect.ts` already has. The stack detection module already reads `package.json` and parses dependencies. `anti-patterns.ts` now does a third separate read of `package.json` (after `detectDatabase` reads it at line 78 and `detectTailwind` reads it at line 98). Three reads of the same file in one code path is wasteful and means the JSON is parsed twice in `detectDatabase` but only string-searched in `detectTailwind` — an inconsistency that will silently produce different results if formatting differs.

Deeper: the `collectTags` function is not testable in isolation because `detectDatabase` and `detectTailwind` both hit the filesystem directly with no injectable seam. The entire anti-patterns generation depends on filesystem state with no way to inject mock data in tests.

### 4. What pattern inconsistencies exist?

**Inconsistency 1 — SKILL.md Reference Index contradicts the Exit Gate it sits in.**
At `SKILL.md:293`, the Reference Index row for `review-lessons/` says: "Accumulated review findings by role (replaces anti-patterns.md)" — marked as replacing anti-patterns.md. Yet the Build Worker Exit Gate just 110 lines later (line 403) requires reading `.claude/anti-patterns.md` with the note "Reviewed relevant sections; no violations in implementation." These two statements directly contradict each other. A new build worker reading the Reference Index may skip anti-patterns.md on the premise that review-lessons replaced it, then fail the Exit Gate.

**Inconsistency 2 — planner.md Section 8 manual update vs automated generation.**
The planner's "How to Update" procedure (planner.md:358-364) instructs the Planner to manually append sections from `anti-patterns-master.md` to `anti-patterns.md` and manually update the header line. But the init CLI (`generateAntiPatterns`) produces a clean regenerated file. The planner's append approach will produce a file with a header claiming one stack but body content for a different stack — because the header only changes via find-replace, while content accumulates. After two planning sessions, you could have a header saying "typescript + react" over content that also includes angular and nodejs sections from different append operations. There is no deduplication guard.

**Inconsistency 3 — Tag parsing uses space-split but master uses space-separated tags inline.**
`filterMasterByTags` at line 147 splits tags with `/\s+/` which is fine. However the master file at line 79 uses `<!-- tags: nodejs express nestjs -->` (space-separated within a single comment). This works with the parser but the Tag Reference table (lines 9-24) only documents single-tag entries. A contributor who reads the reference table may write `<!-- tags: nodejs --><!-- tags: express -->` (two separate comments) believing that is the multi-tag pattern, which would cause the second comment to start a new section, discarding all content from the first.

**Inconsistency 4 — `anti-patterns.md` (fallback) still references "anti-patterns-master.md".**
`packages/cli/scaffold/.claude/anti-patterns.md:4` says: "See `.claude/anti-patterns-master.md` for the full tagged rule set." The fallback file is supposed to be a standalone universal set for projects where the master file is absent, but it references the master as if it exists. This is semantically wrong — the fallback file is used precisely when the master is missing.

### 5. What would I do differently?

- Extract the label-building logic to a single exported function in `anti-patterns.ts` and call it from both `buildHeader` and `handleAntiPatterns` in `init.ts`. Eliminate the duplication.
- Resolve the SKILL.md Reference Index contradiction. The row should say "Complements anti-patterns.md" not "replaces" it, OR the Exit Gate should be updated to reference review-lessons instead. Pick one and be consistent.
- Make `detectDatabase` and `detectTailwind` accept a pre-parsed `Record<string, string>` deps object instead of re-reading the filesystem, so callers can share a single parse of `package.json`.
- Add a non-empty output guard to `generateAntiPatterns` — if `filtered` is empty string after filtering, fall back to copying the universal `anti-patterns.md` instead of writing a file with only the header.
- Replace the planner's manual append procedure with an instruction to run or re-invoke `generateAntiPatterns` via the CLI, or at minimum add a deduplication guard.

---

## Blocking Issues

### Issue 1: SKILL.md Reference Index directly contradicts the Build Worker Exit Gate

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md:293` vs `:403`
- **Problem**: Line 293 in the Reference Index says `review-lessons/` "replaces anti-patterns.md". Line 403 in the Exit Gate requires workers to read `.claude/anti-patterns.md`. This is a direct contradiction within the same file. A worker following the Reference Index note will believe anti-patterns.md is deprecated, skip it, then fail the Exit Gate check — or worse, not realize there is a contradiction and internalize conflicting mental models.
- **Impact**: Workers may bypass the anti-patterns check entirely, defeating the primary goal of BUG-7 (Part C of this task). The entire point of the Exit Gate addition is nullified if the Reference Index contradicts it.
- **Fix**: Change line 293 from "replaces anti-patterns.md" to "Complements anti-patterns.md — read both". Or, if the intent is for review-lessons to be the primary source, update the Exit Gate to reference review-lessons instead and remove the anti-patterns check. One consistent answer, not two contradictory ones.

### Issue 2: Stack label-building logic duplicated between `init.ts` and `anti-patterns.ts`

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts:127-134` and `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/anti-patterns.ts:183-187`
- **Problem**: Both files contain nearly identical code to format a `DetectedStack[]` into a human-readable label string. The init.ts version at lines 127-133 produces `"typescript + angular, react"` and the anti-patterns.ts version at lines 183-187 produces the same format. They are not guaranteed to stay in sync — they are separate code paths that were written to look the same today.
- **Impact**: If the display format changes in `buildHeader` (e.g., to use ` / ` as separator), `handleAntiPatterns` will log a different label than what is written to the file header. The generated file and the console output will describe the same stack differently, confusing operators and making automated parsing of the log unreliable.
- **Fix**: Export a `formatStackLabel(stacks: DetectedStack[]): string` helper from `anti-patterns.ts` and call it from both `buildHeader` and `handleAntiPatterns` in `init.ts`.

### Issue 3: Planner's manual append procedure will corrupt anti-patterns.md after multiple updates

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md:358-364`
- **Problem**: The "How to Update" steps instruct the Planner to append new tagged sections from the master file and then update the header line. There is no deduplication step. If the Planner adds React sections in session 1, and in session 3 the Planner detects React again and re-appends, the file accumulates duplicate sections. Additionally, the header-update step says "update the header line to reflect the expanded stack" but does not specify how — find-replace, rewrite, prepend? An LLM executing this will guess, and different sessions will guess differently.
- **Impact**: Over time `anti-patterns.md` becomes a corrupted accumulation of duplicate sections with a header that may not match the body. Workers consulting this file for rules will see contradictory or redundant entries and may dismiss the file as unreliable.
- **Fix**: Either (a) instruct the Planner to invoke `npx nitro-fueled init --overwrite` to regenerate the file cleanly from the master, or (b) add explicit deduplication: "before appending, grep for the section heading — if already present, skip." Add a "header rewrite" instruction that replaces the entire header block, not just one line.

---

## Serious Issues

### Issue 1: `tauri` maps to `['nodejs']` in STACK_TO_TAGS — semantically wrong

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/anti-patterns.ts:21`
- **Problem**: `tauri: ['nodejs']` causes a Rust/Tauri project to receive nodejs anti-patterns (resource cleanup, async error handling). Tauri is a Rust framework; nodejs rules about EventEmitter teardown and `Promise.allSettled` do not apply to Rust.
- **Tradeoff**: The tag set has no `tauri` or `rust` tags yet so this is somewhat intentional, but mapping to `['nodejs']` is actively wrong — it would be more correct to map to `[]` (empty) until Tauri-specific rules are added.
- **Recommendation**: Change `tauri: ['nodejs']` to `tauri: []` to avoid injecting inapplicable rules. Add a comment in the constant explaining that Tauri-specific tags will be added when Tauri anti-patterns are authored.

### Issue 2: `filterMasterByTags` produces empty string with no warning when master has no matching sections

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/anti-patterns.ts:134-174`
- **Problem**: If `stacks` contains only languages that map to empty tag sets (e.g., `python`, `go`, `rust`) and `detectDatabase`/`detectTailwind` also return false, `activeTags` will only contain `'universal'`. If the master file's universal sections are incorrectly tagged or accidentally removed, `filtered` will be an empty string. The function writes a file containing only the header with no rules, silently.
- **Tradeoff**: A generated file with only a header provides no value and no signal that something went wrong.
- **Recommendation**: After `filterMasterByTags`, check `filtered.trim() === ''`. If empty, log a warning (`console.warn('  Anti-patterns: no matching sections found in master file; check tag configuration')`) and return `false` so the caller falls back to copying the static universal file.

### Issue 3: Three separate reads of `package.json` in one invocation path

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/anti-patterns.ts:74-88` (`detectDatabase`) and `:94-103` (`detectTailwind`), plus the read already done by `stack-detect.ts`
- **Problem**: `collectTags` calls `detectDatabase(cwd)` and `detectTailwind(cwd)` sequentially. Both functions independently open, read, and parse/search `package.json`. This is a third and fourth filesystem operation on the same file within a single `init` run.
- **Tradeoff**: For a CLI tool this is not a performance disaster, but it means three separate error-handling branches for the same file, and the two functions use different reading strategies (JSON parse vs substring search), which is inconsistent.
- **Recommendation**: Consolidate into a single helper that reads and parses `package.json` once, then pass the parsed deps object to `detectDatabase` and `detectTailwind` as parameters.

### Issue 4: `anti-patterns.md` fallback file has a broken self-reference

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/scaffold/.claude/anti-patterns.md:4`
- **Problem**: The fallback file contains "See `.claude/anti-patterns-master.md` for the full tagged rule set." The fallback file is the output of last resort when the master is not found (or when the project is not JS/TS). If it is ever shown to a worker, the master file is by definition either absent or irrelevant. The reference is semantically broken.
- **Tradeoff**: The reference is harmless in the happy path (where the master file exists), but the fallback file is specifically designed for the case where the master is absent.
- **Recommendation**: Change line 4 to "This is the universal rule set. Run `nitro-fueled init` to regenerate a stack-specific version." This makes the fallback self-contained and actionable.

### Issue 5: Planner section 8 example shows header update with `| tags:` but `buildHeader` uses a different separator

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md:370-378`
- **Problem**: The "After" example in Section 8 shows the header as `Stack: **typescript + react** | tags: nodejs, react, typescript`. The `buildHeader` function in `anti-patterns.ts:194` constructs `${stackLabel}${tagSuffix}` where `tagSuffix` is ` | tags: ${tagList}`. These happen to match today, but the planner's example is a static string embedded in the agent definition. If `buildHeader` changes its format, the planner's example will be wrong and the Planner agent will produce misformatted headers during manual updates.
- **Recommendation**: Either remove the inline example from planner.md and say "copy the exact header line from the generated file", or make the planner reference the `buildHeader` function's output format explicitly and add a note that the format is defined there.

---

## Minor Issues

- `anti-patterns.ts:147`: Tag splitting uses `/\s+/` then `.map((t) => t.trim())` — the trim is redundant after a whitespace split. Minor but misleads readers into thinking `\s+` might not consume all surrounding whitespace.
- `init.ts:314`: Comment reads "Step 5b: Ensure .nitro-fueled/ is gitignored" — this is the mixed sub-step numbering pattern flagged in review-general.md (TASK_2026_043). Should be renumbered as step 6, with subsequent steps shifting up.
- `anti-patterns-master.md`: The Tag Reference table (lines 9-24) documents only single-tag examples and does not show or mention that multiple space-separated tags are valid within one comment. A contributor may assume one tag per comment and write two comments instead, accidentally splitting a section.
- `code-style-reviewer.md` and `code-logic-reviewer.md` Step 1: Both now start with `Read(.claude/anti-patterns.md)` but neither file mentions that the Step 4 Pattern Comparison or the MANDATORY review-lessons update still applies. The addition of anti-patterns as a first-class step is good, but the two agent files do not have a consistent description of the relationship between anti-patterns.md and review-lessons/. One reader may think anti-patterns.md replaces review-lessons for that review; they serve different purposes.

---

## File-by-File Analysis

### `packages/cli/src/utils/anti-patterns.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 3 serious, 2 minor

**Analysis**: The core parsing logic in `filterMasterByTags` is clean and the regex-based state machine is readable. However the file suffers from: (1) STACK_TO_TAGS encoding an incorrect mapping for `tauri`, (2) multiple filesystem reads of the same file, (3) no guard against producing an empty output file, and (4) no exported helper for label-building that would eliminate duplication with `init.ts`. The function signatures are typed correctly and JSDoc is present. File length (238 lines) is within the 300-line general limit but close; the Tailwind and database detection logic could be extracted to reduce coupling.

**Specific Concerns**:
1. Line 21: `tauri: ['nodejs']` — wrong tag mapping for a Rust framework.
2. Lines 78-103: Two separate `readFileSync` calls on `package.json` with different parsing strategies.
3. Lines 179-204: `buildHeader` duplicates the label-building logic present in `init.ts:127-133`.
4. Line 173: No warning or fallback when `includedBodies` is empty.

---

### `packages/cli/src/commands/init.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: The refactoring that separated `handleAntiPatterns` from `handleStackDetection` is a sound design decision — stack detection and anti-pattern generation now run independently of the `--skip-agents` flag, which is correct per the task requirements. The error handling pattern (catching `err: unknown`, checking `instanceof Error`) is consistent with the rest of the CLI codebase (`claude-md.ts`). The overwrite logic is correct.

**Specific Concerns**:
1. Lines 127-133: Duplicates label-building logic from `anti-patterns.ts:buildHeader`. This is the same code written twice.
2. Lines 310-314: Mixed step numbering (Step 5, Step 5b) contradicts the review-general.md convention lesson.

---

### `packages/cli/scaffold/.claude/anti-patterns-master.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

**Analysis**: The master file is well-organized. The tag system covers the important frameworks. The multi-tag syntax on line 79 (`<!-- tags: nodejs express nestjs -->`) is functional but undocumented in the Tag Reference table. The content of the tagged sections is accurate and actionable.

**Specific Concerns**:
1. Lines 9-24 (Tag Reference table): Does not document multi-tag syntax. Contributor discovering the space-separated format must infer it from reading existing comments rather than from the documented spec.
2. No comment or rule about what happens when a section has no matching tags — is it silently dropped? A brief note about untagged content behavior would prevent misuse.

---

### `packages/cli/scaffold/.claude/anti-patterns.md`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: This file is the right content for a universal fallback. The five sections (Silent Failures, Race Conditions, Error UX, Code Size, Input Validation) are genuinely universal. However the broken self-reference to `anti-patterns-master.md` undermines its purpose as a standalone fallback. The header correctly reads "Generated by nitro-fueled init. Stack: universal" which is accurate.

**Specific Concerns**:
1. Line 4: References `anti-patterns-master.md` in a file designed for use when the master is unavailable.

---

### `.claude/agents/planner.md` (Section 8 only)

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious, 0 minor

**Analysis**: Section 8 establishes the right intent — the Planner should be responsible for keeping anti-patterns.md updated when tech choices are made during planning. The trigger conditions (lines 349-353) are well-defined and the "do not run proactively" guard at line 381 prevents noise. However, the "How to Update" procedure has a fundamental flaw: append-without-dedup will corrupt the file over multiple planning sessions. The example in lines 367-378 is useful for format reference but creates a static copy of `buildHeader`'s format that will drift.

**Specific Concerns**:
1. Lines 358-364: No deduplication guard in the append procedure. Multiple planning sessions will produce duplicate sections.
2. Lines 367-378: The example format string is a static copy of `buildHeader` output format, creating drift risk.

---

### `.claude/agents/code-style-reviewer.md` (Step 1 change only)

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The change adds `Read(.claude/anti-patterns.md)` as the first step before reading task context, and adds clear prose making anti-patterns a first-class review criterion. The framing — "Anti-patterns are first-class review criteria. Any rule in `.claude/anti-patterns.md` that applies to the implementation's tech stack is a blocking issue if violated" — is correct and strong. The note about skipping non-applicable stack sections is a good practical clarification.

**Specific Concerns**:
1. The added anti-patterns step and the MANDATORY review-lessons update instruction are both present but their relationship is not described. A reviewer may wonder: are anti-patterns violations tracked in review-lessons? The agent file is silent on this.

---

### `.claude/agents/code-logic-reviewer.md` (Step 1 change only)

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Same assessment as code-style-reviewer.md. The change is minimal, targeted, and well-framed. The distinction between anti-patterns relevant to logic ("Silent Failures, Race Conditions, and any database/concurrency sections") is a useful narrowing.

**Specific Concerns**:
1. Same as code-style-reviewer.md: no guidance on whether anti-patterns violations feed into review-lessons updates.

---

### `.claude/skills/orchestration/SKILL.md` (Exit Gate addition only)

**Score**: 4/10
**Issues Found**: 1 blocking, 0 serious, 0 minor

**Analysis**: The Exit Gate addition correctly places the anti-patterns check as a required step with a clear human-verification note ("This check cannot be automated — it requires you to read the file and compare against your implementation"). The check description is unambiguous. However the Reference Index at line 293 directly contradicts this addition by stating review-lessons "replaces anti-patterns.md". This contradiction is a blocking issue for the entire Part C goal of this task. A worker reading top-to-bottom in the Reference Index will internalize the "replaced" framing before reaching the Exit Gate.

**Specific Concerns**:
1. Line 293: "replaces anti-patterns.md" contradicts line 403 which requires reading anti-patterns.md. Must be corrected.

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                                           |
| -------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Type safety (no `any`, no `as`)  | PASS   | All types are explicit; `as` assertions are limited to `JSON.parse` cast with inline type annotation |
| Consistent error handling        | PASS   | `catch {}` blocks all return safe defaults (false/empty), never swallow silently  |
| Single responsibility per file   | PARTIAL | `anti-patterns.ts` does tag filtering, header building, database detection, and Tailwind detection — four responsibilities |
| Import organization              | PASS   | Node core imports first, third-party absent, local imports follow                 |
| Naming conventions               | PASS   | `camelCase` functions, `SCREAMING_SNAKE` constant — wait, `STACK_TO_TAGS` uses SCREAMING_SNAKE but review-general.md specifies `SCREAMING_SNAKE_CASE` for domain objects, consistent with existing pattern |
| File size limits                 | PASS   | All TypeScript files under 300 lines; markdown agent files over 400 lines but agent files have no documented limit |
| No filesystem reads without guards | PARTIAL | `readFileSync(masterPath)` at line 226 is only reached after `existsSync` check; but the two inner reads in `detectDatabase`/`detectTailwind` would throw if called concurrently |
| Cross-file consistency           | FAIL   | SKILL.md Reference Index contradicts Exit Gate; planner.md example drifts from buildHeader format |

---

## Technical Debt Assessment

**Introduced**:
- A third parallel data structure (STACK_TO_TAGS) that must be kept in sync with AGENT_MAP and the master file's tag reference table. When the framework list grows, all three must be updated manually with no enforcement.
- A bespoke markdown parser for HTML comment tags. This will need maintenance whenever the master file format conventions change.
- The planner append procedure creates unbounded corruption risk with no recovery path if a session ends mid-append.

**Mitigated**:
- BUG-6: Workers no longer receive irrelevant Angular/Tailwind rules on non-Angular/Tailwind projects. This is the primary intent and is correctly implemented.
- BUG-7: Workers are now required to consult anti-patterns before committing. The Exit Gate check is in the right place with the right framing.

**Net Impact**: Net positive — the bugs are addressed. However the three new debt items (parallel STACK_TO_TAGS, bespoke parser, planner append procedure) will each require maintenance. The SKILL.md contradiction is the most immediate risk.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The SKILL.md Reference Index at line 293 directly contradicts the Exit Gate that was just added at line 403. If left as-is, build workers reading the Reference Index will believe anti-patterns.md has been replaced by review-lessons and may skip the anti-patterns check — completely defeating the goal of BUG-7. Fix this contradiction before this ships.

---

## What Excellence Would Look Like

A 9/10 implementation would include:

1. **No parallel STACK_TO_TAGS constant** — instead, tag inference would be derived from the existing `AGENT_MAP` data structure or from a shared schema, so the framework list only has one source of truth.
2. **Single `package.json` read** — `collectTags` would accept a pre-parsed `PackageJson` object, sharing the parse result already computed by `stack-detect.ts`.
3. **Non-empty output guard** — `generateAntiPatterns` returns a descriptive result enum (`'generated' | 'empty' | 'master-not-found'`) instead of a boolean, so callers can distinguish the empty-filter case from the missing-master case.
4. **No label-building duplication** — an exported `formatStackLabel` helper eliminates the code in `init.ts:127-133`.
5. **Planner procedure without drift risk** — the procedure would either reference the CLI command for regeneration, or include an explicit "if section heading already present, skip" guard.
6. **SKILL.md internal consistency** — the Reference Index and Exit Gate would agree on whether anti-patterns.md is active, deprecated, or complementary to review-lessons.
7. **Multi-tag syntax documented** — the master file's Tag Reference table would include a row or note explaining the space-separated multi-tag format.
