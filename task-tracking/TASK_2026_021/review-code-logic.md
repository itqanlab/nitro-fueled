# Code Logic Review — TASK_2026_021

## Score: 6/10

## Summary

The happy path is solid. The three routing paths (claude, glm, opencode) are structurally correct, the env isolation approach for GLM is sensible, and the Provider/Model fields are plumbed through types, registry, MCP schema, and display outputs. However, there are several real failure modes that will bite in production: a silent credential-loss bug when `ZAI_API_KEY` is unset, an orphaned dead-code export, an opencode worker that gets incorrectly marked `completed` instead of `failed` on non-zero exit, the `isPrintProcessAlive` export that was never wired to the health checker, and a routing table that routes ALL reviews to Claude Opus with no override path for GLM — contradicting the stated goal of saving Claude quota.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

**GLM workers with no `ZAI_API_KEY` set silently inherit garbage credentials.**
In `print-launcher.ts` line 118:
```typescript
ANTHROPIC_AUTH_TOKEN: process.env['ZAI_API_KEY'],
```
When `ZAI_API_KEY` is not set, `process.env['ZAI_API_KEY']` is `undefined`. TypeScript's `NodeJS.ProcessEnv` accepts `string | undefined` for each key, so this compiles fine. At runtime the env var `ANTHROPIC_AUTH_TOKEN` is set to the string `"undefined"` on some Node versions, or the key is omitted entirely on others — behaviour is platform-dependent. In either case the worker starts, appears healthy, then fails with a cryptic auth rejection from Z.AI after the first real API call. No error is thrown at spawn time. The Supervisor sees the worker as `healthy` (process is alive) until it finally exits non-zero — possibly 2–5 minutes later. There is no guard or early-abort.

**OpenCode worker completion is indistinguishable from failure in the watcher.**
`jsonl-watcher.ts` marks a worker `completed` as soon as `isProcessAlive(pid)` returns false, regardless of the exit code. For opencode workers this means a worker that crashes with exit code 1 gets status `completed` in the registry. The Supervisor will then treat it as a successful build and spawn a Review Worker for broken code.

### 2. What user action causes unexpected behavior?

**Spawning a GLM worker without setting `ZAI_API_KEY` first.** The tool accepts the call, registers the worker, logs it as running, and only fails later with a confusing API auth error buried in a log file. No feedback reaches the MCP caller.

**Rapidly killing an opencode worker via `kill_worker` and then checking `list_workers`.** `killOpenCodeProcess` removes the pid from `childProcesses` and sends SIGTERM, but the status is immediately set to `killed` regardless of whether the process actually died. If the process ignores SIGTERM and the SIGKILL `setTimeout` fires 5 seconds later, there is a 5-second window where the registry says `killed` but the process is still consuming resources and potentially still writing output.

### 3. What data makes this produce wrong results?

**An unknown model string fed to `calculateCost`.** The fallback is `PRICING['claude-opus-4-6']`. So if a caller passes `provider=glm` and `model=glm-5-turbo` (a model listed in task.md but not in the PRICING table), cost will be calculated at Opus rates ($15/MTok input) instead of the GLM zero-cost rate. This inverts the whole point of the GLM provider — the user thinks they are saving money but the dashboard shows inflated Claude Opus costs.

**A model string with mixed case or trailing whitespace.** The PRICING lookup is a direct key match. `"GLM-5"` or `"glm-5 "` both miss the table and fall back to Opus pricing with no warning.

### 4. What happens when dependencies fail?

**`opencode` binary not on PATH.** `spawn('opencode', ...)` returns a child with no pid. The code correctly throws `Failed to spawn 'opencode' process...` — this is handled. However, the error is thrown before `registry.register()` is called, so no worker record is created. The MCP caller receives the error text, which is good. This case is handled correctly.

**`claude` binary not on PATH for a GLM worker.** Same path — error thrown before registry write. Also correctly handled.

**GLM API endpoint unreachable (network down, z.ai outage).** The `claude --print` process will start successfully (binary exists, env is set), then block on the first API call. The process stays alive indefinitely. `isProcessAlive` returns true. The watcher sees it as `healthy` until 120 seconds of inactivity triggers the `stuck` health state. The Supervisor then goes through two-strike detection before killing it — meaning a z.ai outage causes each affected worker to waste 4+ minutes before being killed and retried. There is no timeout on the child process itself. This is a pre-existing issue in the architecture but is now amplified because GLM workers are expected to be a primary cost-saving path, so many more workers will use this code path.

### 5. What's missing that the requirements didn't mention?

**No validation that `provider` and `model` are compatible.** Nothing prevents `spawn_worker(provider='claude', model='glm-5')` or `spawn_worker(provider='opencode', model='claude-opus-4-6')`. The former will use the Claude subscription but specify a model name Claude's API won't recognize. The latter will pass `--model claude-opus-4-6` to `opencode run`, which may or may not handle it gracefully.

**No OpenCode-specific cost tracking.** OpenCode returns JSON output, but it is parsed identically to the Claude stream-json format. OpenCode's JSON schema is almost certainly different from Claude's `stream-json` format. If the fields don't match, `feedMessage` will parse the messages without error (the try/catch swallows parse failures on individual lines), but token counts and costs will remain at zero for all opencode workers.

**The routing table routes ALL Review Workers to `claude/claude-opus-4-6`** — including style reviewers, checklist reviewers, and unit test reviewers — directly contradicting the task.md routing table which specifies GLM for "medium orchestration (style review, test lead)" and OpenCode for "simple focused tasks (checklist review, unit tests)". The auto-pilot SKILL.md routing table is more conservative than what the task asked for, leaving the main quota-saving opportunity (offloading simple reviews from Claude) unimplemented.

---

## BLOCKING Issues

### BLOCKING-1: `ZAI_API_KEY` unset produces undefined/silent auth failure

**File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts`, line 118

When `ZAI_API_KEY` is absent from the environment, `process.env['ZAI_API_KEY']` is `undefined`. The resulting env object either omits `ANTHROPIC_AUTH_TOKEN` (silently using whatever was inherited) or sets it to the string `"undefined"`. The claude CLI then makes an API call to z.ai with a bad token, gets an auth error after several seconds of silence, and exits non-zero. The Supervisor sees the worker as healthy during this window.

A guard must be added before `spawn()` for GLM workers:
```typescript
if (opts.provider === 'glm' && !process.env['ZAI_API_KEY']) {
  throw new Error('ZAI_API_KEY is not set. Cannot spawn GLM worker.');
}
```
This converts a silent runtime failure into an immediate, actionable error at spawn time.

### BLOCKING-2: OpenCode workers always marked `completed` regardless of exit code

**File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts`, lines 57–77

The watcher tick checks `if (!isProcessAlive(pid))` and unconditionally calls `registry.updateStatus(worker.worker_id, 'completed')` for ALL dead processes. For iTerm and print workers this is acceptable because the claude CLI exits 0 on success. For opencode workers, a failed run (exit code 1, bad model, API error) also kills the process, and the worker lands in `completed` status. The Supervisor then attempts to spawn a Review Worker for a task that was never built.

The opencode launcher's `child.on('exit', ...)` handler already captures the exit code in the log — but the exit code is never propagated to the registry. The watcher needs a way to distinguish successful completion from process death due to failure for the `opencode` launcher mode.

---

## SERIOUS Issues

### SERIOUS-1: Unknown GLM/OpenAI models fall back to Claude Opus pricing

**File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/token-calculator.ts`, line 83

```typescript
const p = PRICING[model] ?? PRICING['claude-opus-4-6'];
```

Models not in the table (e.g., `glm-5-turbo`, `glm-4.6`, `glm-4.5-flash`, future OpenAI models) silently get charged at Opus rates. For GLM workers this means zero-cost usage is incorrectly billed as $15/MTok, corrupting the cost dashboard. The fallback should either be a zero-cost sentinel or throw a logged warning:
```typescript
if (!PRICING[model]) {
  console.warn(`[token-calculator] No pricing for model "${model}", cost will be $0`);
}
const p = PRICING[model] ?? { input_per_mtok: 0, output_per_mtok: 0, cache_creation_per_mtok: 0, cache_read_per_mtok: 0 };
```

### SERIOUS-2: `isPrintProcessAlive` exported but never imported or used anywhere

**File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts`, lines 156–162

The function `isPrintProcessAlive` is exported but `grep` shows it is imported nowhere. The health check in `index.ts` (line 297–298) and `jsonl-watcher.ts` both call `isProcessAlive` from `iterm-launcher.ts` — which happens to work identically (`process.kill(pid, 0)`) — but `isPrintProcessAlive` is dead code. This is a maintenance trap: the next developer who searches for "how does health checking work for print workers" may find this function and assume it is wired in, then spend time debugging why it has no effect.

Either wire it in as the canonical checker for print/opencode workers, or delete it and add a comment noting that `isProcessAlive` from `iterm-launcher` is used universally.

### SERIOUS-3: Routing table in SKILL.md routes ALL review workers to Claude Opus — defeats the stated quota-saving goal

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, lines 454–458

The implemented routing table:
```
| Review Worker (any type) | claude | claude-opus-4-6 | Deep reasoning needed |
| Build Worker + Complex   | claude | claude-opus-4-6 | ...                   |
| Build Worker + Medium    | glm    | glm-5           | ...                   |
| Build Worker + Simple    | glm    | glm-4.7         | ...                   |
```

The task.md routing table specified:
```
| Deep code review (logic reviewer)          | Claude | Opus    |
| Medium orchestration (style review, tests) | GLM    | GLM-4.7 |
| Simple focused task (checklist, unit tests)| OpenCode | GPT-4.1-mini |
```

The SKILL.md collapses all review workers into a single `claude/opus` row, eliminating the GLM and OpenCode savings for the review pipeline. A logic reviewer and a style reviewer both get Opus. The task explicitly says medium reviews (style, test lead) should use GLM and simple reviews (checklist) should use OpenCode. The routing table needs a worker-type dimension (Build vs Review) AND a task-type or complexity dimension for the review path.

### SERIOUS-4: OpenCode output format assumed to match Claude stream-json — almost certainly wrong

**File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts`, lines 88–91

```typescript
onMessage: (msg) => {
  if (workerRef.id) {
    watcher.feedMessage(workerRef.id, msg as import('./types.js').JsonlMessage);
  }
},
```

`feedMessage` is designed for Claude's `stream-json` format (`type: 'assistant'`, `message.usage`, etc.). OpenCode's `--format json` output is its own schema. If the fields do not match, every `feedMessage` call will parse without error (the JSON is valid) but token accumulation will stay at zero because the `type` field won't be `'assistant'` and `message.usage` won't be present. This means all opencode workers show 0 tokens, 0 cost, and 0 tool calls — making monitoring useless for that provider. The task says `get_worker_stats` must include provider and model, but the content (token counts) will be meaningless.

---

## MINOR Issues

### MINOR-1: `process.on('exit', ...)` registered once per module load in two files

**Files**: `print-launcher.ts` line 166, `opencode-launcher.ts` line 133

Both modules register a `process.on('exit', ...)` handler at module load time. If either module is ever imported more than once (e.g., during testing or future refactoring), the handler accumulates. Use `process.once` or register at the server startup level instead. This is low risk in the current single-entry-point design but worth noting.

### MINOR-2: `childProcesses.delete(pid)` in `killOpenCodeProcess` called before SIGKILL fires

**File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/opencode-launcher.ts`, lines 110–115

```typescript
child.kill('SIGTERM');
setTimeout(() => {
  try {
    if (!child.killed) child.kill('SIGKILL');
  } catch { /* already dead */ }
}, 5000);
childProcesses.delete(pid);  // <-- removed from map immediately
return true;
```

The map entry is deleted before the SIGKILL fires. If `kill_worker` is called a second time within 5 seconds (e.g., by the Supervisor), the child falls through to `process.kill(pid, 'SIGTERM')` again — duplicating the signal. Not a crash, but slightly wasteful. Same pattern exists in `print-launcher.ts`.

### MINOR-3: No validation that `provider=opencode` is not combined with `use_iterm=true`

**File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts`, line 43

The `use_iterm` branch runs before the provider check. If a caller passes `provider=opencode, use_iterm=true`, the code spawns an iTerm session using `launchInIterm` — which runs the `claude` binary, not `opencode`. The provider field in the registry will say `opencode` but the worker will be running Claude. This combination is probably a mistake and should be rejected with a clear error.

### MINOR-4: Task template comment says "Omit both Provider and Model" but table always has both rows

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/scaffold/task-tracking/task-template.md`, lines 12–13

The template includes `Provider` and `Model` rows unconditionally. The comment says to "omit both... or set to `default`". Having them present with value `[model name or default]` means every new task file will have these rows, and workers will parse `[model name or default]` as a literal value. Workers should be instructed to delete the rows entirely if using defaults, or the default value in the table cell should be the literal string `default` — not a meta-description inside brackets.

---

## Acceptance Criteria Check

- [x] print-launcher supports `provider` param: `claude`, `glm`, `opencode` — yes, but `opencode` is passed through but immediately routed to the opencode-launcher branch in index.ts, not in print-launcher itself. print-launcher only handles `claude` and `glm`. This is the correct architecture but the criterion as stated is misleading.
- [x] GLM workers spawn `claude --print` with Z.AI env vars — correct, env swap is implemented
- [x] Claude and GLM workers can run concurrently without env conflicts — YES. The env is built per-spawn, not mutated globally. Safe.
- [x] OpenCode workers spawn `opencode run --model X --format json` — correct
- [x] `spawn_worker` MCP tool accepts `provider` parameter — yes, Zod enum validated
- [ ] `ZAI_API_KEY` env var used for GLM auth — PARTIAL. It is read, but there is no guard when it is absent. Silent failure.
- [ ] Routing table in auto-pilot skill selects best-fit provider — PARTIAL. Table exists but collapses all review types into `claude/opus`, missing the GLM/OpenCode savings for medium and simple review workers.
- [x] Explicit Provider/Model in task.md overrides routing — yes, SKILL.md step 5c handles this correctly
- [x] Registry and orchestrator-state show provider + model per worker — yes, both `list_workers` and `get_worker_activity` output Provider and Model
- [x] `get_worker_stats` includes provider and model — yes, line 207 of index.ts
- [x] Task template includes optional Provider and Model fields — yes, added with descriptive comments

---

## Passed

- **Env isolation is correct.** `buildGlmEnv()` spreads `process.env` and overrides — it does not mutate the parent env. Concurrent Claude and GLM workers cannot interfere with each other's environment.
- **Zod enum validation** on `provider` in the MCP schema prevents invalid provider strings from reaching the launcher.
- **Provider is plumbed end-to-end**: types.ts, register opts, Worker object, list output, stats output, activity output. No gaps in the data model.
- **OpenCode launcher is structurally clean**: same spawn/buffer/close pattern as print-launcher, same kill logic. Easy to understand.
- **Registry defaults `provider` to `'claude'`** when not provided, matching MCP tool default behavior. Consistent.
- **SKILL.md step 5c** correctly describes the override semantics: explicit task.md Provider wins, routing table is only used when Provider is `default` or absent. The `provider` omit-if-claude optimization (line 467) is a nice touch — avoids redundant parameter.
- **State.md active workers table** specification (line 473) correctly says to record the resolved provider, never the sentinel `"default"`. The right invariant is stated.
- **`killPrintProcess` and `killOpenCodeProcess`** both implement SIGTERM + 5-second SIGKILL escalation. Correct kill sequence.

---

## Review Lessons to Append

The following patterns from this review are new and should be appended to `.claude/review-lessons/backend.md`:

- **Validate required env vars at spawn time for provider-specific workers** — when a launcher reads a secret from the environment (e.g., `ZAI_API_KEY` for GLM), guard before `spawn()`. If the var is absent, throw a named error immediately. Silent startup followed by a delayed API auth failure is undebuggable at 3 AM. (TASK_2026_021)
- **Process exit code must reach the registry for non-Claude launchers** — marking any dead process `completed` regardless of exit code is safe for claude CLI (which exits 0 on success) but not for third-party CLIs (opencode, future providers) where non-zero exit means failure. Capture exit code in the launcher's `exit` handler and expose it so the watcher can distinguish `completed` from `failed`. (TASK_2026_021)
- **Pricing table fallbacks must not default to the most expensive model** — a missing-key fallback of `PRICING['claude-opus-4-6']` silently inflates cost for any model not in the table. Always fallback to zero-cost or log a named warning. (TASK_2026_021)
- **Provider/model cross-validation at the MCP boundary** — when a tool accepts both `provider` and `model` parameters, validate that the model is compatible with the provider before spawning. Mismatched pairs (glm provider + claude model) produce confusing runtime failures that are hard to trace back to the call site. (TASK_2026_021)
- **Mutually exclusive flags need explicit rejection** — when two options are semantically incompatible (`use_iterm=true` + `provider=opencode`), reject the combination with a clear error at the tool boundary rather than silently preferring one over the other. (TASK_2026_021)
