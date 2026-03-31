# Code Style Review — TASK_2026_215

## Findings

### Finding 1 — `TaskCandidate.status` and `TaskCandidate.type` are bare `string`, not typed unions [Serious]

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:83-84`

`status` and `type` on `TaskCandidate` are typed as plain `string`. The project has `TaskStatus` and `TaskType` unions defined in `packages/mcp-cortex/src/db/schema.ts`. Using bare `string` defeats the type system: any caller can pass an arbitrary value and the compiler will not catch it. This also means `candidate.status === 'CREATED'` comparisons in `session-runner.ts` at lines 291 and 360 get no exhaustiveness help — a typo like `'Create'` compiles silently.

The `model` field on `TaskCandidate` has the same issue: the schema allows `TEXT` (nullable), and `model: string | null` is correct, but it represents a free-form model string; that is acceptable since model names are not enumerated. The `status` and `type` fields are not free-form.

**Recommendation**: Import and use `TaskStatus` from the schema package, or re-export it from `auto-pilot.types.ts`. Change `status: string` to `status: TaskStatus` and `type: string` to `TaskType`.

---

### Finding 2 — `CustomFlow.description` nullability inconsistency between interface and DB row type [Serious]

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:72` vs `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts:62`

`CustomFlow.description` is declared `string | null`. `CustomFlowRow.description` is also `string | null`. That is consistent. However, the `getCustomFlow()` mapping at `supervisor-db.service.ts:293` explicitly writes `description: row.description ?? null`. The double-null coalesce is harmless but redundant since `CustomFlowRow.description` is already typed as `string | null` — `row.description` cannot be `undefined` at this point. The pattern is inconsistent with how every other field in that method is mapped (direct assignment without coalescing). The noise is minor but signals the author was not certain about nullability, which is exactly what the type system should remove.

---

### Finding 3 — `CustomFlowStep` has no `description` or validation shape — the `agent` field is a raw string [Minor]

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:64-67`

```typescript
export interface CustomFlowStep {
  agent: string;
  label: string;
}
```

`agent` is a free-form string, but in the codebase `agent` names are the well-known nitro agent slugs (e.g., `nitro-planner`, `nitro-software-architect`). If the `custom_flows.steps` JSON blob contains a typo in the agent name, the worker receives a prompt with an invalid agent reference and fails silently — the supervisor logs a `CUSTOM_FLOW_APPLIED` event and considers the flow active. There is no validation layer between `getCustomFlow()` and `promptBuilder.buildWorkerPrompt()`. This is an inherently hard problem at the DB layer, but the interface should at minimum document which values are valid, or use a typed union.

---

### Finding 4 — `WorkerTokenStats`, `WorkerCost`, and `WorkerProgress` are duplicated across two files [Serious]

**File**: `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts:69-95` — these three interfaces are defined locally with a comment "(mirrors cortex schema.ts)".

The identical interfaces exist in `packages/mcp-cortex/src/db/schema.ts:36-62`. The review-lesson at `review-general.md` is explicit: "Shared interface files duplicated across packages must be kept byte-for-byte identical". This was existing technical debt, not introduced by this task. However, TASK_2026_215 added `CustomFlow` and `CustomFlowStep` correctly in `auto-pilot.types.ts` and imported them into `supervisor-db.service.ts` — demonstrating the correct pattern. The `WorkerTokenStats` / `WorkerCost` / `WorkerProgress` duplicates remain unfixed and represent drift risk. Not blocking for this task, but worth flagging since the task author clearly knows the right import pattern.

---

### Finding 5 — `idx_custom_flows_name` index is inserted in the wrong position in the `INDEXES` array [Minor]

**File**: `packages/mcp-cortex/src/db/schema.ts:220`

```
'CREATE INDEX IF NOT EXISTS idx_custom_flows_name ON custom_flows(name)',
```

This index is injected between `idx_sessions_status` (line 217) and `idx_handoffs_task` (line 218), breaking the visual grouping convention of the file. Every other table's indexes are grouped together: all `tasks` indexes first, then `workers`, then `sessions`, then `handoffs`, then `events`, then the newer tables (`phases`, `reviews`, `fix_cycles`). The `custom_flows` index is dropped in the middle of the session/handoff group. This is a readability issue — the next developer scanning the array for handoff indexes will see an unexpected `custom_flows` entry breaking the pattern. The index should appear after `idx_handoffs_task` and before `idx_events_session`, grouped with the `custom_flows` table's logical position (between `HANDOFFS_TABLE` and `EVENTS_TABLE` in the `initDatabase()` execution order).

---

### Finding 6 — `prompt-builder.service.ts` custom flow section silently produces a blank line when `customFlow` is null [Minor]

**File**: `apps/dashboard-api/src/auto-pilot/prompt-builder.service.ts:57-59`

```typescript
const customFlowSection = opts.customFlow
  ? `\nCUSTOM FLOW OVERRIDE...`
  : '';
```

When `customFlow` is null/undefined, `customFlowSection` is `''`. It is then interpolated at line 64:

```
${modeHeader}
${customFlowSection}
AUTONOMOUS MODE ...
```

When the flow is null, this becomes `${modeHeader}\n\nAUTONOMOUS MODE` — a double blank line. When a flow is present, it becomes `${modeHeader}\n\nCUSTOM FLOW OVERRIDE...\nAUTONOMOUS MODE` — which is also a double blank line before the section plus the section itself ending in `\n`. The extra newlines are cosmetic and the worker ignores them, but the inconsistent whitespace around the section varies depending on whether a custom flow is present. Given the prompt is passed verbatim to a worker, clean structural whitespace has value. The `\n` prefix on the custom flow string and the template literal blank line between `modeHeader` and `customFlowSection` interact inconsistently.

---

### Finding 7 — `getCustomFlow()` does not log a warning when `steps` JSON is malformed [Minor]

**File**: `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts:284-298`

`parseJson<CustomFlowStep[]>(row.steps, [])` silently returns `[]` if `steps` is malformed JSON or is a non-array value. The caller in `session-runner.ts` receives a `CustomFlow` with zero steps, logs `CUSTOM_FLOW_APPLIED` with `stepCount: 0`, and passes it to the prompt builder. The prompt builder's `steps.map(...)` produces an empty string for the step list, injecting a custom flow override block with no steps. The worker sees the `CUSTOM_FLOW OVERRIDE` header but no step instructions, which is confusing. A zero-step flow should either return `null` (treating it as a missing flow) or log a warning before returning. The `parseJson` fallback pattern is used throughout the file, but this is a case where the fallback semantics are harmful rather than graceful.

---

### Finding 8 — `spawnForCandidate` is 107 lines; approaching the 150-line handler limit [Minor]

**File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:359-466`

The method runs from line 359 to line 466. The anti-patterns rule sets 50 lines as the single-function limit. This method handles: status-based provider routing, custom flow resolution with logging, task claiming, label construction, prompt building (build vs. review branch), and worker spawning with error handling. That is five distinct concerns. The custom flow block (lines 385-401) adds 17 lines to an already dense function. The function is below the file-level limit but violates the 50-line function rule from the anti-patterns doc. Worth extracting the custom flow resolution into a private `resolveCustomFlow(candidate)` helper.

---

### Finding 9 — `WorkerType` in `auto-pilot.types.ts` is `'build' | 'review'` but `supervisor-db.service.ts` imports it and uses it for a broader set [Minor]

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:12` vs `packages/mcp-cortex/src/db/schema.ts:29`

`WorkerType` in `auto-pilot.types.ts` is `'build' | 'review'`. In `schema.ts`, `WorkerType` is `'build' | 'prep' | 'implement' | 'review' | 'cleanup'`. `supervisor-db.service.ts` imports `WorkerType` from `auto-pilot.types.ts` (the narrower definition) and uses it in `WorkerRow.worker_type` and `ActiveWorkerInfo.workerType`. If a DB row has `worker_type = 'prep'`, the cast at line 383 (`row.worker_type` as `WorkerType`) will produce a value not in the TypeScript union. This is pre-existing, not introduced by TASK_2026_215, but the task added an import of `WorkerType` from this file at line 17 without noting the mismatch. The handhoff notes mention a potential unused `WorkerType` import warning — this is the right concern but the underlying type divergence is the real issue.

---

## Summary

The custom flow routing feature is structurally sound. DB schema, TypeScript interfaces, service method, and prompt injection all follow the established patterns. The DB migration approach (ALTER TABLE ADD COLUMN without FK enforcement) is documented and justified in the handoff. The fallback path for missing flows is handled correctly before `claimTask()` is called.

The issues found fall into two clusters:

1. **Type discipline gaps** — `TaskCandidate.status` and `.type` should use the project's typed unions rather than bare `string`. `WorkerType` divergence between the two packages is a pre-existing issue surfaced by this task's import. These are serious because they allow impossible values to compile without error.
2. **Code quality minors** — index array insertion position breaks visual grouping, duplicate whitespace in the prompt template, zero-step flow fallback semantics are potentially misleading, `spawnForCandidate` is approaching the function length limit.

No blocking issues. Two serious issues (bare `string` on `TaskCandidate`, `WorkerType` union mismatch). Six minor issues.

| Verdict | PASS |
|---------|------|
