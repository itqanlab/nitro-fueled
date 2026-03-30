# Code Style Review — TASK_2026_123

## Review Summary

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| Overall Score   | 7/10                                 |
| Assessment      | NEEDS_REVISION                       |
| Blocking Issues | 2                                    |
| Serious Issues  | 4                                    |
| Minor Issues    | 6                                    |
| Files Reviewed  | 16                                   |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The scoring guide in `hard-01-cross-cutting-change/task.md` says "All 12 console calls replaced" in the 9-10 band, but the actual setup files total 12 calls only if every comment annotation is believed. An evaluator who counts differently (e.g., `cancelOrder` and `refundPayment` have no log calls and don't count toward the 12) will produce inconsistent scores. The number "12" is asserted in the scoring guide without a derivation trace; if a setup file is amended to add or remove a call, the scoring band text becomes wrong and silently produces bad benchmark results.

### 2. What would confuse a new team member?

`easy-02-add-utility-function/task.md` says "Initialize a minimal TypeScript project" in Setup Instructions but provides NO setup files whatsoever — no `tsconfig.json`, no `package.json`. There is no `setup/` directory for this task at all. Every other task that says "Setup Required: yes" has a `setup/` directory; this task says "Setup Required: no" but the Setup Instructions tell the model to initialize a project from scratch. The mismatch between the Metadata table ("no") and the instruction prose ("initialize...") will confuse both human operators and automated runners.

### 3. What's the hidden complexity cost?

The `medium-02-refactor-extract-module` task hands the model a `monolith.ts` where `ExecutionResult` is defined between the scheduling and execution blocks (line 62), not with the other types at the top. The Scoring Guide rewards "all types moved to `types.ts`" for a 9-10, but a model that faithfully preserves interface order during extraction will trivially achieve this. However, the task spec says the barrel export must expose "the same public API as the original `monolith.ts`" — yet `parseTasks`, `scheduleTasks`, and `executeTasks` are NOT exported from the original monolith. Only `runTasks` is. The spec's Completeness checklist item ("barrel export preserves the original public API surface") conflicts with the Description which names these internal functions as extraction targets. A model that exports them breaks the original contract; one that hides them fails the Completeness checklist description.

### 4. What pattern inconsistencies exist?

All five task.md files share the same four-section structure (Metadata, Description, Setup Instructions, Requirements Checklist, Scoring Guide). Sections are consistent. However, scoring table column headers differ between files in whitespace and use of em-dashes vs double hyphens:

- `easy-01`, `easy-02`, `medium-01`, `medium-02`: column header `1-3 (Failing)` etc. use `|` row alignment with relatively equal padding.
- `hard-01`: the scoring table has significantly wider cells (because entries are longer). The column header pattern is preserved but the visual table width makes the Markdown source hard to diff and the rendered table harder to scan. This is not blocking but reduces readability of the hardest task, which is also the one most likely to be edited.

Additionally, `easy-01` task.md line 56 states: "Functions handle `null`/`undefined` input without throwing (if TypeScript strict mode allows)". The parenthetical "if TypeScript strict mode allows" is a hedge that does not appear anywhere else in the five tasks. It weakens the requirement and makes it unclear whether an evaluator should penalize a model for not adding null guards. Every other error-handling checklist item is unconditional.

### 5. What would I do differently?

1. Count setup file console calls explicitly in the task description and cross-reference them in the Scoring Guide (e.g., "user-service: 3, order-service: 4, payment-service: 5 = 12 total"). This makes the "12" in the scoring band self-documenting.
2. Resolve the `easy-02` Setup Required contradiction: either add a `setup/` directory with a minimal `tsconfig.json` + `package.json`, or change the Setup Instructions to omit the "initialize" instruction.
3. Clarify in `medium-02` which functions should be exported from the barrel. The safest fix is: export only what the original monolith exported (`runTasks` and the four types), and remove the internal functions from the Completeness checklist's API-preservation criterion.
4. Remove the "if TypeScript strict mode allows" hedge in `easy-01` line 56 — either make null-guard a hard requirement or drop it from the checklist.

---

## Blocking Issues

### Issue 1: `easy-02` Setup Required metadata contradicts Setup Instructions

- **File**: `benchmark-suite/tasks/easy-02-add-utility-function/task.md:10` (Metadata table) and `task.md:27` (Setup Instructions)
- **Problem**: The Metadata table says `Setup Required: no`. The Setup Instructions section says "Initialize a minimal TypeScript project (`tsconfig.json` + `package.json`)". No `setup/` directory exists for this task. Every other task in the suite that provides a `setup/` directory marks "Setup Required: yes". The Evaluation Supervisor reads the `setup/` directory to prepare the worktree; a missing directory that is simultaneously required by the instructions will cause the runner to skip setup, leaving the model with no `tsconfig.json` and producing a TypeScript compilation failure regardless of code quality.
- **Impact**: Automated benchmark runs will fail or produce misleading scores for this task. Models that attempt compilation will get errors unrelated to their implementation quality.
- **Fix**: Either (a) create a minimal `setup/` directory with `tsconfig.json` and `package.json` and change Metadata to "Setup Required: yes", or (b) remove "Initialize a minimal TypeScript project" from Setup Instructions and keep "Setup Required: no".

### Issue 2: `hard-01` Scoring Guide references unverifiable console-call count

- **File**: `benchmark-suite/tasks/hard-01-cross-cutting-change/task.md:90` (Scoring Guide, Correctness column)
- **Problem**: The 9-10 Correctness band states "All 12 console calls replaced". The Description says user-service has 3, order-service has 4, payment-service has 5 — which sums to 12. However, the setup files show a mix of direct `console.*` calls and calls through the imported `log`/`warn`/`error` aliases. The task description uses the phrase "console calls" to mean both patterns, but the Scoring Guide uses "console calls" which in common usage means only direct `console.*` invocations. An evaluator reading the Scoring Guide without the Description will interpret "12 console calls" as 12 direct `console.*` calls — but payment-service line 29 and order-service line 32 use the imported `log` alias (not `console.log`), and those would not be counted as "console calls" by a literal reader. The count breakdown in the Correctness requirement checklist (`task.md:56-59`) also uses the phrase "console calls" inconsistently — line 57 says "All `console.log` calls replaced with appropriate `logger.info` or `logger.debug` calls" but `log` alias calls are not `console.log` calls in source code.
- **Impact**: Different evaluators (human or model) will produce different scores for the same submission depending on whether they count alias calls. Benchmark results become non-reproducible.
- **Fix**: Replace "console calls" with "logging calls (both direct `console.*` and imported alias calls)" throughout the Scoring Guide and Requirements Checklist. Add a callout in the Description: "12 total logging calls: 3 in user-service, 4 in order-service, 5 in payment-service — including both imported alias calls and direct `console.*` calls."

---

## Serious Issues

### Issue 3: `medium-02` public API surface specification is contradictory

- **File**: `benchmark-suite/tasks/medium-02-refactor-extract-module/task.md:42` and `task.md:53`
- **Problem**: The Description says the model must extract internal functions `parseTasks`, `scheduleTasks`, `executeTasks` into separate modules. The Completeness checklist item at line 42 says "The barrel export (`index.ts`) exposes the same public API as the original `monolith.ts`". The original `monolith.ts` does NOT export `parseTasks`, `scheduleTasks`, or `executeTasks` — they are module-private functions. A model that exports only `runTasks` and the four types (matching the original API) will fail the Completeness description at line 42 if the evaluator reads "same public API" as meaning only what was public before. A model that also exports the three extracted functions passes the spirit of the task but breaks the "same public API" criterion.
- **Impact**: Two evaluators scoring the same submission against this task will disagree on Completeness band. Reproducibility of benchmark scores is undermined.
- **Fix**: Clarify explicitly: "The barrel `index.ts` must export at minimum the original public API (`runTasks`, `Task`, `TaskConfig`, `ExecutionResult`, `TaskStatus`). Additionally exporting `parseTasks`, `scheduleTasks`, and `executeTasks` is acceptable but not required."

### Issue 4: `easy-01` Error Handling requirement has a hedged, unevaluable condition

- **File**: `benchmark-suite/tasks/easy-01-single-file-bugfix/task.md:56`
- **Problem**: The line reads: "Functions handle `null`/`undefined` input without throwing (if TypeScript strict mode allows)". The parenthetical is a conditional exception that makes this requirement impossible to score objectively. The setup `tsconfig.json` does not exist for this task (no `setup/` directory), so an evaluator cannot check whether strict mode is enabled. The scoring table's Error Handling 9-10 band (`task.md:66`) says "All edge cases handled gracefully; `truncate` with maxLength <= 3 returns truncated string without '...'" — it does not mention null/undefined at all. There is a divergence between the checklist and the scoring guide on what constitutes full Error Handling coverage.
- **Impact**: Evaluators will either always count this item or always skip it, introducing systematic scoring bias.
- **Fix**: Either (a) remove the null/undefined checklist item entirely and align with the scoring guide which already omits it, or (b) add a matching row to the Error Handling scoring band: "9-10: null/undefined inputs return empty string or throw with clear message."

### Issue 5: `medium-02` monolith.ts has `ExecutionResult` defined mid-file, creating an extraction ambiguity

- **File**: `benchmark-suite/tasks/medium-02-refactor-extract-module/setup/src/monolith.ts:62`
- **Problem**: The four exported types (`TaskStatus`, `Task`, `TaskConfig`, `ExecutionResult`) are not all defined together at the top of the file. `ExecutionResult` is defined between the scheduling and execution functions at line 62, with a comment "Result type -- defined here between parsing and scheduling (poor organization)". The task description says this is intentional as a refactoring smell. However, the `Completeness` checklist says "All type definitions moved to `types.ts`" — a model that misses `ExecutionResult` because it was defined mid-file next to the execution logic (rather than with the other types) will receive a reduced Completeness score for what is essentially a navigation challenge, not a conceptual failure. The task does not explicitly flag `ExecutionResult` as a type to extract; a model skimming for `export interface` near the top may miss it.
- **Impact**: This is a reasonable difficulty multiplier, but since it is undocumented, it will cause inconsistent scoring — some evaluators will treat the miss as a Completeness failure, others as a minor gap.
- **Fix**: Add a sentence to the Description or Setup Instructions explicitly noting that `ExecutionResult` is defined mid-file and must also be moved to `types.ts` along with the other three types.

### Issue 6: `config.md` does not specify how custom task difficulty affects weighted aggregate

- **File**: `benchmark-suite/config.md:68`
- **Problem**: The config states: "Custom task results are reported in a separate 'Custom Dimensions' section so they do not affect the generic task aggregate." The difficulty weights table at lines 18-22 lists weights for easy/medium/hard but custom tasks are not listed. A custom task marked `difficulty: hard` in its Metadata will have weight 2.0 by the prefix table rules (line 64 says "difficulty read from the task.md Metadata table"), but the weight table itself does not include custom tasks as a row. If a custom task is marked `difficulty: easy`, the Evaluation Supervisor must look up the weight from the generic difficulty table — which works — but the documentation path is non-obvious: the reader must connect three separate paragraphs. This is particularly risky when custom tasks are described as being in a "separate section" — readers may assume they have no weight at all.
- **Impact**: Implementors of the Evaluation Supervisor may apply weight 1.0 (default) to all custom tasks regardless of stated difficulty, or may omit weighting entirely, leading to incorrect aggregate scores for suites that include custom tasks.
- **Fix**: Add a row to the Difficulty Weights table for `custom` with the note "weight determined by difficulty field in task.md Metadata (same as corresponding tier weight)."

---

## Minor Issues

1. **`easy-01/task.md:40`** — The slugify test case description says "handles accented characters gracefully -- the e in Cafe has an acute accent". The ASCII double-dash `--` is used as an em-dash substitute inconsistently. All five task.md files use `--` throughout, which is fine as a convention, but `config.md` uses `--` in the same way. The convention is consistent within files but worth noting as a documentation choice that differs from typical Markdown style.

2. **`easy-01/setup/src/string-utils.test.ts:73`** — The test uses the Unicode escape `\u00e9` for the accented e but the task description (task.md line 22 and 40) uses the actual rendered character `é`. This is not a bug but creates a minor inconsistency: someone reading the task description sees `é`, then opens the test file and sees `\u00e9`. Consistent representation (either both rendered or both escaped) would be clearer.

3. **`medium-01/task.md:30`** — The `size()` method description says "Returns the count of non-expired entries (triggers lazy expiration check)". This is the only method description in the entire benchmark suite that documents a side effect parenthetically. The side effect (lazy expiration during `size()`) is a meaningful implementation constraint that belongs in the Requirements Checklist as an explicit item, not only in the description prose. The Correctness checklist item at line 52 says "`size` does not count expired entries" but does not say it must trigger expiration. A model could implement `size()` by filtering without removing — satisfying the count requirement but not the lazy expiration contract.

4. **`hard-01/task.md:84`** — The Error Handling 9-10 band says "invalid level defaults or throws descriptive error". The word "or" means either behavior gets full marks, which is fine for flexibility. However, the 4-6 band says "invalid level not addressed" and the 7-8 band says "invalid level handled but edge cases remain" — neither band specifies what "edge case" means for an invalid level. The progression from 4-6 to 7-8 to 9-10 is unclear for this specific sub-criterion. A model that throws a descriptive error immediately would score 9-10, but a model that silently defaults without throwing would also score 9-10, yet a "partial" implementation that emits a warning before defaulting might be 7-8. The distinction between bands is fuzzy for this one sub-criterion.

5. **`medium-01/setup/package.json:1`** — The `name` field is `"benchmark-medium-01"`. None of the other setup files include a `package.json` (only this one does), so there is no naming inconsistency across files, but the format `benchmark-{difficulty}-{nn}` differs from the task directory naming convention `medium-01-multi-file-feature`. If more setup `package.json` files are added, the naming convention should be documented in `config.md`.

6. **`medium-02/task.md:62`** — The Scoring Guide Correctness 4-6 band says "3 of 5 functions work correctly". The Description defines 5 extracted files (parser, scheduler, executor, types, index) but only 3 functions (`parseTasks`, `scheduleTasks`, `executeTasks`) plus the barrel export. The number "5" in the scoring band refers to the 5 correctness checklist items, not 5 functions. This is technically consistent but a quick reader of the scoring band will think "5 functions" before checking. Changing "3 of 5 functions" to "3 of 5 correctness checks" would remove the ambiguity.

---

## File-by-File Analysis

### `benchmark-suite/config.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**:
The config is clean and well-organized. The prefix-based discovery mechanism is clearly documented. The serious gap is the missing `custom` row in the Difficulty Weights table — the prose explains that custom task weights are inherited from the standard tiers, but a reader or implementor of the Evaluation Supervisor has to infer this from three separate paragraphs rather than from the table itself.

**Specific Concerns**:
1. Line 18-22: Difficulty Weights table has no `custom` row. Prose on lines 63-66 explains the rule, but the canonical reference point is the table.
2. Line 64: "custom- -- project-specific task, difficulty read from the task.md Metadata table" in the discovery section does not cross-reference the weights table. The two sections need to be linked.

---

### `easy-01-single-file-bugfix/task.md`

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**:
The best-written task in the suite. The bug descriptions are precise, each bug has a clear root cause stated, and the scoring table uses observable, countable criteria ("All 7 test assertions pass"). The hedged null/undefined item in the Error Handling checklist is the one crack.

**Specific Concerns**:
1. Line 56: "if TypeScript strict mode allows" hedge makes the item unscoreable. Serious issue.
2. Line 40: Uses rendered `é` while the test file uses `\u00e9`. Minor inconsistency.

---

### `easy-01-single-file-bugfix/setup/src/string-utils.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
The bugs are well-chosen — they are subtle (off-by-one, multiple-space collapse, regex matching) rather than trivially obvious. Each bug is annotated with a `// BUG:` comment explaining the problem, which makes grading transparent without making the bugs too easy to spot for a model. The file is 46 lines, well under any reasonable limit. Single-quotes and semicolons used consistently throughout.

**Specific Concerns**:
1. The `// BUG:` comments are informative for evaluators reading the source but are present in the file that gets handed to the model. If the intent is that the model should discover the bugs independently, having `// BUG:` comments pointing directly at the lines somewhat reduces the difficulty. This is a design choice that should be deliberate — the task description does tell the model what the bugs are, so the comments are consistent with the transparency approach. No issue, just flagging.

---

### `easy-01-single-file-bugfix/setup/src/string-utils.test.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**:
The test helpers are clean and self-contained (no external framework dependency). Each test is commented to indicate whether it passes or fails with the buggy code, which helps an evaluator manually verify scoring. The `assertEqual` function provides a useful diff output format. Import uses single quotes, no semicolon inconsistencies.

**Specific Concerns**:
1. Line 73: `\u00e9` escape vs rendered `é` in task.md. Minor.
2. The test file uses `console.log('All tests passed!')` on line 78. This passes if and only if no assertion throws. However, there is no catch-all to report which specific assertion failed and continue — a single failure throws and stops all subsequent tests. This is a deliberate simplification (noted by "no external test framework required") but means a model that fixes two of three bugs will only see the first failing test, not all failures. This could reduce the diagnostic signal available to a model. Worth noting but not a scoring issue.

---

### `easy-02-add-utility-function/task.md`

**Score**: 4/10
**Issues Found**: 1 blocking, 1 serious, 0 minor

**Analysis**:
The function specifications are precise and the scoring table is well-calibrated. However, the blocking Setup Required contradiction undermines the task's usability in automated runs. Additionally, the Requirements Checklist at line 54 says "`chunk` throws or returns `[]` for `size <= 0`" — both behaviors are accepted, which is appropriate for flexibility. But the Scoring Guide 9-10 Error Handling band at line 66 also says "throws or returns `[]`", making full marks achievable regardless of which approach the model takes. This is intentional and correct. The serious gap is the missing setup directory combined with the instruction to initialize a TypeScript project.

**Specific Concerns**:
1. Line 10: "Setup Required: no" — blocking contradiction with line 27.
2. Line 27: "Initialize a minimal TypeScript project (`tsconfig.json` + `package.json`)" — no setup/ directory to scaffold from. Serious.

---

### `medium-01-multi-file-feature/task.md`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**:
The Cache spec is the most detailed of the five tasks and shows strong requirements engineering. The lazy expiration contract is explicit in the Description and the Correctness checklist. The multi-file structure requirement (types/cache/index) mirrors real-world module organization. The single gap is that the `size()` side-effect constraint is only in the description prose, not represented as a distinct checklist item.

**Specific Concerns**:
1. Line 30: `size()` must trigger lazy expiration — this is a behavioral constraint, not just a count constraint. The checklist item at line 52 ("size does not count expired entries") is necessary but not sufficient to enforce this.
2. Line 74: `maxSize` of 0 or negative "throws or defaults to unlimited" — both accepted. This flexibility is fine but the Scoring Guide 9-10 band does not unambiguously distinguish between the two. No blocking issue.

---

### `medium-01-multi-file-feature/setup/src/index.ts`

**Score**: 10/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
Minimal and correct. A two-line placeholder with a useful comment. Nothing to fault.

---

### `medium-01-multi-file-feature/setup/package.json`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**:
Correct and minimal. TypeScript as a devDependency is appropriate. No scripts defined, which is fine for a scaffold. The name `benchmark-medium-01` deviates from the task directory naming convention.

**Specific Concerns**:
1. Line 2: Name is `benchmark-medium-01`; task directory is `medium-01-multi-file-feature`. Convention not documented.

---

### `medium-02-refactor-extract-module/task.md`

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**:
The refactoring task is well-structured for difficulty but has two serious specification gaps: the public API ambiguity and the un-flagged mid-file type definition. Both will cause inconsistent evaluator scoring. The Scoring Guide is otherwise well-calibrated with specific observable criteria.

**Specific Concerns**:
1. Line 42 vs monolith.ts exports: Public API ambiguity — serious.
2. monolith.ts line 62: Mid-file `ExecutionResult` definition not flagged — serious.
3. Line 62 Scoring Guide: "3 of 5 functions" should be "3 of 5 correctness checks" — minor.

---

### `medium-02-refactor-extract-module/setup/src/monolith.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
High-quality seed code. Kahn's algorithm implementation is correct. The intentional disorganization (types mid-file, inline comment calling it out) is appropriate for a refactoring task — it gives the model a real smell to address. The `!` non-null assertions at lines 104-105 are intentional patterns in the buggy code and are fair game for a model to clean up. File is 190 lines, under the 200-line file size limit from project conventions.

**Specific Concerns**:
1. Lines 104-105: `queue.shift()!` and `taskMap.get(current)!` — non-null assertions. These are technically sound (the algorithm guarantees these are non-null at this point) but would not survive a strict TypeScript `no-non-null-assertion` lint rule. This is not a problem for the seed file's purpose.

---

### `hard-01-cross-cutting-change/task.md`

**Score**: 6/10
**Issues Found**: 1 blocking, 1 serious, 1 minor

**Analysis**:
The hardest task has the most complex scoring guide, and the complexity exposes the call-count reproducibility problem. The task description is thorough and the annotation of each logging call in the service files (via inline comments) is excellent. The scoring guide's Correctness band references "12 console calls" using a definition that conflicts with the description's mixed-terminology use of "console calls" and "logging calls".

**Specific Concerns**:
1. Line 90: "12 console calls" — blocking ambiguity between direct `console.*` and imported alias calls.
2. Line 84: "invalid level handled but edge cases remain" (7-8 band) — unclear what edge case means here. Serious.
3. Line 93: Wide table makes diffs hard; consider splitting long cell text with prose footnotes. Minor.

---

### `hard-01-cross-cutting-change/setup/src/logger.ts`

**Score**: 10/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
A well-crafted naive implementation. The three export patterns (`export const log = console.log`, the wrapper factory) deliberately mix idioms to create the "cross-cutting change" challenge. The file is intentionally minimal — 14 lines — so a model cannot take shortcuts by extending it.

---

### `hard-01-cross-cutting-change/setup/src/user-service.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
Three logging calls as advertised, mixing imported aliases (line 16) with direct console calls (lines 27, 31). Business logic is simple and correct. The inline comments (`// console call 1 (via imported log)`) are present on all three calls, which aids evaluators but also guides models directly to the call sites — a conscious simplification appropriate for a hard task focused on the logger replacement, not on call-site discovery.

---

### `hard-01-cross-cutting-change/setup/src/order-service.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
Four logging calls correctly annotated. Mix of imported aliases and direct console calls. `cancelOrder` function (lines 51-57) has no logging, which is intentional and correctly omitted from the call count.

---

### `hard-01-cross-cutting-change/setup/src/payment-service.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
Five logging calls annotated. The `refundPayment` function (lines 56-63) has no logging, which is consistent with the specification. `authorizePayment` mixes all three import patterns (imported alias `log`, imported alias `error`, direct `console.warn`, direct `console.error`) — making it the strongest test of whether a model catches all patterns. This is good difficulty calibration for a hard task.

---

### `hard-01-cross-cutting-change/setup/tsconfig.json`

**Score**: 10/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**:
Strict mode enabled. All relevant strict flags active via `"strict": true`. `ES2020` target is appropriate. This is the only `tsconfig.json` in the benchmark suite, which means it covers only the hard task. This is consistent with the other tasks not having setup directories with TypeScript config, but see the blocking issue in `easy-02` for the consequence of that absence.

---

## Pattern Compliance

| Pattern                              | Status | Concern                                                                   |
| ------------------------------------ | ------ | ------------------------------------------------------------------------- |
| task.md structure consistency        | PASS   | All 5 tasks follow Metadata/Description/Setup/Requirements/Scoring order  |
| Scoring bands observable (not vague) | PASS   | All bands use counts or specific named criteria                           |
| TypeScript style (quotes/semis)      | PASS   | Single quotes, semicolons consistent across all .ts files                 |
| Markdown table alignment             | PASS   | Column headers consistent across all scoring tables                       |
| Setup Required metadata accuracy     | FAIL   | easy-02 metadata says "no" but instructions require project initialization |
| Scoring guide internal consistency   | FAIL   | hard-01 uses "console calls" ambiguously; easy-01 checklist diverges from scoring guide on null handling |
| Cross-reference integrity            | FAIL   | config.md weights table missing custom tier; medium-02 API spec contradicts monolith exports |

---

## Technical Debt Assessment

**Introduced**:
- The "console calls" ambiguity in `hard-01` will require a correction commit before the Evaluation Supervisor can use this task reliably. Every downstream evaluator (human or model) reading the Scoring Guide will face the same ambiguity.
- The `easy-02` Setup Required contradiction will require either adding a `setup/` directory or rewriting the Setup Instructions. If the Evaluation Supervisor already has logic to check for `setup/` directories based on the Metadata field, this task will silently skip setup and cause compilation failures.

**Mitigated**:
- The inline `// BUG:` and `// console call N` annotations in the setup source files eliminate a class of scoring ambiguity by making call sites explicit. This is good.
- Scoring bands using discrete counts ("3 of 5 test cases pass", "all 7 test assertions pass") eliminate subjectivity for the majority of scoring dimensions.

**Net Impact**: Net negative until the two blocking issues are resolved. The suite is approximately 85% ready for automated evaluation use. The blocking issues affect one task's automated execution (`easy-02`) and one task's scoring reproducibility (`hard-01`).

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The `easy-02` Setup Required contradiction is a runtime blocker — automated benchmark runners will fail or skip setup for that task, producing nonsense scores. The `hard-01` console-call ambiguity will produce non-reproducible scores until the terminology is unified. Both are straightforward to fix but cannot be deferred.

---

## What Excellence Would Look Like

A 10/10 benchmark suite for this context would additionally include:

1. A `schema.md` or inline comment block in `config.md` that formally defines every field in the task.md template (data type, allowed values, required vs optional) — so task authors cannot silently introduce new fields or misuse existing ones.
2. An explicit "Evaluator Notes" section in each task.md that flags intentional difficulty traps (e.g., "mid-file type definition is intentional", "mixed import alias and direct console patterns are intentional") separately from the Requirements Checklist — so evaluators do not confuse deliberate design choices with implementation gaps.
3. A self-test script that validates all task directories against the manifest in `config.md` — catching missing setup directories, missing task.md files, and Metadata field mismatches at CI time rather than at benchmark runtime.
4. Explicit "out of scope" clauses in the Requirements Checklist for each task, documenting what a model should NOT do (e.g., "do not add a test runner dependency" for easy-02, "do not change function signatures" for easy-01) — currently implicit in the scoring guide prose but not surfaced as explicit constraints.
