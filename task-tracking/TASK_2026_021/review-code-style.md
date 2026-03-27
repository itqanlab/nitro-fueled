# Code Style Review — TASK_2026_021

## Score: 5/10

## Summary

| Metric          | Value                        |
|-----------------|------------------------------|
| Overall Score   | 5/10                         |
| Assessment      | NEEDS_REVISION               |
| Blocking Issues | 3                            |
| Serious Issues  | 5                            |
| Minor Issues    | 4                            |
| Files Reviewed  | 8                            |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `opencode` launcher (`src/core/opencode-launcher.ts`) is a near-exact duplicate of `print-launcher.ts` — same log directory logic, same stdout-buffer parsing loop, same SIGTERM/SIGKILL escalation, same `process.on('exit')` registration. When the buffer-flushing logic or kill escalation behaviour is improved in `print-launcher.ts`, the parallel copy in `opencode-launcher.ts` will silently diverge. Six months from now a maintainer will fix a bug in one and forget the other. The duplication is the primary long-term risk.

### 2. What would confuse a new team member?

`buildGlmEnv()` in `print-launcher.ts` (line 115) silently swallows a missing `ZAI_API_KEY` by producing `ANTHROPIC_AUTH_TOKEN: undefined`. Node.js `spawn` passes `undefined` env values as the string `"undefined"` on some platforms and omits them on others — the actual behavior is platform-dependent and not documented anywhere near the function. A new developer running a GLM worker without having set `ZAI_API_KEY` will receive a cryptic auth failure from the Z.AI API rather than a clear startup error.

### 3. What's the hidden complexity cost?

`index.ts` is now 313 lines — well over the 200-line handler limit from the project's own conventions. All five tool handlers live inline in a single file with no extraction. Each new provider that gets added will push this further. The complexity cost compounds every time the routing logic or spawn handling is touched.

### 4. What pattern inconsistencies exist?

`jsonl-watcher.ts` (pre-existing, not changed here) has explicit `if (worker.launcher === 'print')` and `if (worker.launcher === 'iterm')` branches, but there is no `'opencode'` branch. The new `opencode` launcher registers workers with `launcher: 'opencode'` and feeds messages via `feedMessage`, exactly as `print` does — but `jsonl-watcher.ts` never handles the `opencode` case in `autoCloseWorker` (line 118: falls through to `killPrintProcess` for any non-iterm launcher). This is technically correct today because `killOpenCodeProcess` is a separate export, but it means the `opencode` workers silently use the print process kill path. If that path ever changes it will break opencode workers. The `autoCloseWorker` method is also missing an `opencode` case.

### 5. What would I do differently?

Extract the shared subprocess boilerplate (log-dir setup, stdout-buffer parsing, SIGTERM/SIGKILL escalation, exit cleanup) into a single `spawnTrackedProcess` utility. Both `launchWithPrint` and `launchWithOpenCode` would call it with just the binary name and args as differences. This eliminates ~100 lines of duplication and gives the kill path, buffer logic, and cleanup a single implementation to maintain. Additionally, `buildGlmEnv` should throw (or at minimum warn) if `ZAI_API_KEY` is absent.

---

## Blocking Issues

### Issue 1: `ZAI_API_KEY` missing produces silent `undefined` in env

- **File**: `src/core/print-launcher.ts:118`
- **Problem**: `ANTHROPIC_AUTH_TOKEN: process.env['ZAI_API_KEY']` — when `ZAI_API_KEY` is not set, `process.env['ZAI_API_KEY']` returns `undefined`. `NodeJS.ProcessEnv` allows `undefined` values but Node.js `spawn` serializes them to the string `"undefined"` on some platforms, or drops them silently on others. Either way the GLM worker gets an invalid auth token and fails with a confusing API-level error.
- **Impact**: Silent runtime failure. The user gets an HTTP 401 from Z.AI with no indication that the env var is missing.
- **Fix**: Guard in `buildGlmEnv()` — throw `new Error('ZAI_API_KEY env var is required for GLM provider')` if `process.env['ZAI_API_KEY']` is `undefined`. Alternatively, check in `index.ts` before calling `launchWithPrint` when `provider === 'glm'`.

### Issue 2: `opencode` launcher not handled in `jsonl-watcher.ts` auto-close path

- **File**: `src/core/opencode-launcher.ts` (new file) + `src/core/jsonl-watcher.ts:118`
- **Problem**: `autoCloseWorker` has `if (worker.launcher === 'iterm') ... else { killPrintProcess(pid) }`. An opencode worker falls into the `else` branch and calls `killPrintProcess` instead of `killOpenCodeProcess`. While both functions use the same underlying `process.kill` mechanism, the opencode process is not in `print-launcher.ts`'s `childProcesses` Map, so the tracked-child fast path is bypassed and the fallback `process.kill(pid, SIGTERM)` is used. This also means the `opencode`-specific `childProcesses` Map in `opencode-launcher.ts` is never cleaned up on auto-close, which is a resource leak.
- **Impact**: Stale entries accumulate in `opencode-launcher.ts`'s `childProcesses` Map. For long-running supervisor sessions with many auto-close opencode workers, this leaks memory.
- **Fix**: Add `else if (worker.launcher === 'opencode') { killOpenCodeProcess(worker.pid); }` in `autoCloseWorker`. Import `killOpenCodeProcess` in `jsonl-watcher.ts`.

### Issue 3: `index.ts` exceeds the 200-line service/handler limit at 313 lines

- **File**: `src/index.ts` (313 lines)
- **Problem**: The project's own conventions (as documented in review-lessons) set a 200-line maximum for service/handler files. All five MCP tool handlers are defined inline in a single file. This file will grow with every new tool or provider.
- **Impact**: The file is already difficult to navigate. Any new routing logic added here (e.g., OpenCode routing table, per-provider auto-close handling) will push it further over the limit.
- **Fix**: Extract at minimum the `spawn_worker` handler into `src/tools/spawn-worker.ts`, following the pattern already established by the pre-existing `src/tools/get-worker-stats.ts` and `src/tools/get-worker-activity.ts` files. The existing tools directory is the correct home.

---

## Serious Issues

### Issue 1: Massive code duplication between `opencode-launcher.ts` and `print-launcher.ts`

- **File**: `src/core/opencode-launcher.ts` (entire file)
- **Problem**: Approximately 90 of the 137 lines are identical to `print-launcher.ts`: the log-dir creation, timestamp/label sanitization, stdout buffer accumulation, JSON-line parsing, stderr/error/exit logging, SIGTERM-then-SIGKILL kill function, and `process.on('exit')` cleanup. The only meaningful differences are: binary name (`opencode` vs `claude`), the args array shape, and the absence of a GLM env builder.
- **Tradeoff**: The duplication makes the immediate implementation obvious, but any bug fix or enhancement (e.g., buffer size cap from backend.md rule: "In-memory buffers need size caps") must be applied in two places.
- **Recommendation**: Extract shared logic into a `src/core/process-launcher.ts` utility. Both launchers become thin wrappers over it.

### Issue 2: `index.ts` uses inline `import()` type assertions at call sites

- **File**: `src/index.ts:90,131`
- **Problem**: `msg as import('./types.js').JsonlMessage` — inline dynamic import references in type assertions inside callbacks. `JsonlMessage` is already imported at the top of the file (`import type { Provider } from './types.js'` + `import type { HealthStatus } from './types.js'`). The `JsonlMessage` type should simply be added to the existing type imports at line 12/15.
- **Tradeoff**: This is a type-hygiene issue, not a runtime problem. But it is inconsistent with the rest of the file and suggests the code was written hastily.
- **Recommendation**: Add `JsonlMessage` to the import at line 12: `import type { Provider, JsonlMessage, HealthStatus } from './types.js';` and remove the inline `import()` casts.

### Issue 3: `token-calculator.ts` fallback to `claude-opus-4-6` silently covers GLM and OpenAI lookup misses

- **File**: `src/core/token-calculator.ts:83`
- **Problem**: `const p = PRICING[model] ?? PRICING['claude-opus-4-6'];` — a model name not in the PRICING table (e.g., `glm-5-turbo`, a future OpenAI model, or a typo) silently uses Opus pricing. For GLM models this produces non-zero cost output when GLM workers are actually subscription-priced at zero. For OpenAI models with no table entry it charges Opus rates, which are wrong by 3-7x.
- **Tradeoff**: Fails silently in the wrong direction — cost reports will be misleading.
- **Recommendation**: The fallback should be a zero-cost sentinel or should log a warning. At minimum: `const p = PRICING[model]; if (!p) { console.warn(\`[token-calculator] Unknown model: ${model}\`); return { input_usd: 0, output_usd: 0, cache_usd: 0, total_usd: 0 }; }`.

### Issue 4: `isPrintProcessAlive` is exported from `print-launcher.ts` but never imported anywhere

- **File**: `src/core/print-launcher.ts:156`
- **Problem**: `export function isPrintProcessAlive` is defined and exported. A search across `src/` shows it is not imported or used anywhere — `isProcessAlive` from `iterm-launcher.ts` is used everywhere instead (which works because both use `process.kill(pid, 0)`). This is dead code per the review-general rule: "No unused imports or dead code — if exported but never imported, remove it."
- **Tradeoff**: Dead exports mislead future maintainers into thinking this is the preferred function for liveness checking of print workers.
- **Recommendation**: Remove `isPrintProcessAlive` from `print-launcher.ts`.

### Issue 5: Routing table in SKILL.md does not include an OpenCode row

- **File**: `.claude/skills/auto-pilot/SKILL.md` (Provider Routing Table around line 454)
- **Problem**: The routing table covers Claude/GLM cases but has no row for `opencode`. The task description explicitly included OpenCode as a routing option for "simple focused tasks". If the Supervisor encounters a task where OpenCode would be appropriate, there is no routing rule to select it — the table has no default/fallback row that covers the `opencode` provider. The table also has no fallback row for unrecognized condition combinations (violating the review-general rule: "Guidance/enum action tables must include a default/fallback row").
- **Tradeoff**: The Supervisor will never autonomously route to OpenCode without an explicit override in task.md, defeating part of the task's stated purpose.
- **Recommendation**: Add a row for OpenCode (e.g., `Build Worker + Complexity=Simple + Type=DOCUMENTATION|RESEARCH`) and add a catch-all fallback row.

---

## Minor Issues

1. **`opencode-launcher.ts` missing `isOpenCodeProcessAlive`** — `print-launcher.ts` exports `isPrintProcessAlive` (even if unused). `opencode-launcher.ts` exports no equivalent. The API surface between the two launchers is inconsistent, though the function would also be dead code given how `isProcessAlive` is used.

2. **`token-calculator.ts` has no GLM subscription-tier distinction** — all GLM models are priced at $0.00 with a comment `// Z.AI`. There is no note explaining whether this is correct (subscription plan, no per-token billing) or a placeholder. A future contributor may assume it is a placeholder and add incorrect per-token pricing.

3. **`task-template.md` comment block uses a run-on model list** — the Provider/Model comment (lines 31-41) lists models inline in the comment. As models are added, this list will drift from what `SKILL.md` and the routing table support. Consider referencing SKILL.md instead of maintaining the list here.

4. **`worker-registry.ts` register opts: `provider` is optional but `Worker.provider` is required** — `register(opts: { provider?: Provider; ... })` defaults to `'claude'` when absent. This is correct behavior, but the asymmetry between optional opts and required interface field is not noted. Consider making `provider` required in opts to force callers to be explicit.

---

## Passed

- `types.ts`: Clean addition of `Provider` type and `provider` field on `Worker`. The `LauncherMode` union correctly includes `'opencode'`.
- `worker-registry.ts`: Provider default (`opts.provider ?? 'claude'`) is consistent with the tool API default. No issues.
- `print-launcher.ts`: The env-swap approach for GLM (spreading `process.env` then overriding) is correct — it does not mutate the parent process env.
- `index.ts` provider/model plumbing: The `p: Provider = provider ?? 'claude'` pattern is clean and the three-way dispatch (iterm / opencode / print) is readable.
- `SKILL.md` step 5c/5d: Provider and model resolution is well-specified. The "never record the sentinel `default`" requirement is clearly stated.
- `task-template.md`: The Provider/Model fields and their inline documentation are clear and usable.

---

## File-by-File Analysis

### `src/types.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Clean. `Provider` type is correctly defined as a string literal union. `LauncherMode` already included `'opencode'` (or was updated here — consistent either way). `provider: Provider` on `Worker` is non-optional which is the right call given the registry always sets a default.

### `src/core/print-launcher.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious, 0 minor

The GLM env-swap logic is correct in principle but `buildGlmEnv` silently passes `undefined` for the API key (blocking issue 1). `isPrintProcessAlive` is dead code (serious issue 4).

### `src/core/opencode-launcher.ts`

**Score**: 4/10
**Issues Found**: 1 blocking, 1 serious, 0 minor

The `jsonl-watcher.ts` auto-close path calls `killPrintProcess` for this launcher (blocking issue 2). The file is 90% a copy of `print-launcher.ts` with no abstraction (serious issue 1).

### `src/core/worker-registry.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Provider defaulting is clean. Minor: opts.provider being optional while Worker.provider is required is a small API inconsistency worth noting.

### `src/core/token-calculator.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

Fallback-to-Opus on unknown model is silently wrong for GLM/OpenAI miss cases. The zero-cost GLM rows are correct for subscription pricing but are undocumented.

### `src/index.ts`

**Score**: 4/10
**Issues Found**: 1 blocking, 1 serious, 0 minor

File is 313 lines — 57% over the handler/service limit (blocking issue 3). Inline `import()` type assertions at lines 90 and 131 should be top-level imports (serious issue 2).

### `packages/cli/scaffold/task-tracking/task-template.md`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Provider/Model fields are well-explained. The inline model list in the comment block will drift from SKILL.md over time (minor issue 3).

### `.claude/skills/auto-pilot/SKILL.md`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

Provider Routing Table is missing an OpenCode route and a catch-all fallback row (serious issue 5). The explicit-override path (step 5c) is correct.

---

## Pattern Compliance

| Pattern                      | Status | Concern |
|------------------------------|--------|---------|
| File size limits             | FAIL   | `index.ts` at 313 lines exceeds 200-line limit |
| No dead code                 | FAIL   | `isPrintProcessAlive` exported but unused |
| No inline `import()` in type positions | FAIL | Lines 90 and 131 of `index.ts` |
| Env var guard at boundaries  | FAIL   | `ZAI_API_KEY` not validated before use |
| Process lifecycle consistency | FAIL  | `opencode` launcher not handled in `jsonl-watcher.ts` auto-close |
| DRY principle                | FAIL   | ~100 lines duplicated between launchers |
| Named type unions for fields | PASS   | `Provider` and `LauncherMode` are proper unions |
| Routing table completeness   | FAIL   | No OpenCode route, no fallback row |

---

## Technical Debt Assessment

**Introduced**:
- A full duplicate of the subprocess management code (~100 lines). Every future fix to buffer handling, kill escalation, or log format must be applied twice.
- A `spawn_worker` handler in `index.ts` that is already too large and will be the target of every future provider addition.
- A silent env-var failure mode that will surface only at runtime under GLM.

**Mitigated**:
- The `Provider` type is properly centralized in `types.ts` — no string literals scattered across call sites.
- The routing table in SKILL.md gives the Supervisor a clear decision framework instead of ad-hoc provider selection.

**Net Impact**: Small increase in debt. The duplication is the largest concern.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: Three issues need resolution before merge: the silent `ZAI_API_KEY` failure, the missing `opencode` branch in `jsonl-watcher.ts` auto-close, and `index.ts` exceeding the line limit. The `isPrintProcessAlive` dead export and inline `import()` type assertions are quick fixes that should be bundled in the same revision pass.

## What Excellence Would Look Like

A 10/10 implementation would:
1. Extract shared subprocess boilerplate into `src/core/process-launcher.ts` so both launchers are ~30 lines of thin wrapper code.
2. Guard `buildGlmEnv()` with a hard throw when `ZAI_API_KEY` is absent, surfacing the misconfiguration at spawn time rather than at API auth time.
3. Move the `spawn_worker` handler to `src/tools/spawn-worker.ts`, keeping `index.ts` as a thin registration file under 100 lines.
4. Add `JsonlMessage` to the top-level type imports and remove the inline `import()` assertions.
5. Add an OpenCode routing row and a fallback row to the Provider Routing Table in SKILL.md.
6. Remove `isPrintProcessAlive` (dead export).
7. Add a `console.warn` in `calculateCost` for unknown model names instead of silently falling back to Opus pricing.
