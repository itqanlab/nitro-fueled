# Code Style Review — TASK_2026_020

## Score: 7/10

## Findings

### BLOCKING

None.

---

### SERIOUS

- **`claude-haiku-4-5-20251001` is a non-standard model ID** — The Haiku model ID used everywhere (`task-template.md` line 12, `task-template.md` line 33, `TASK_2026_021/task.md` line 22) is `claude-haiku-4-5-20251001`. The standard Anthropic API model ID for Claude Haiku 3.5 is `claude-haiku-3-5-20251022`. There is no published model named `claude-haiku-4-5-20251001`. The session-orchestrator's `token-calculator.ts` uses this same invented ID as a pricing key, which means any real spawn using that string will receive no cost tracking (the calculator falls through to the Opus default: `const p = PRICING[model] ?? PRICING['claude-opus-4-6']`). Either the correct ID must be confirmed against the Anthropic API and corrected in all locations, or this needs a prominent caveat in the template comment explaining that users must verify current model IDs.

- **`orchestrator-state.md` Active Workers table header misalignment** — The header has 11 columns (`Worker ID | Task ID | Worker Type | Label | Status | Spawn Time | Last Health | Stuck Count | Expected End State | Model | Cost`) but the separator row has only 10 pipe-separated cells (the `Stuck Count` and `Expected End State` columns collapse — there is no separator cell between `Last Health` and `Model`). This means any Markdown renderer will misalign every data row. This file is read by the supervisor to restore state after compaction, so a broken table is an operationally critical formatting error. The separator row at line 20 is: `|-----------|----------|-------------|-------|---------|-------------|-------------|-------------------|-------|-------|` — it has 10 dashes segments, not 11.

- **`get-worker-stats.ts` alignment inconsistency in the Model line** — Line 28 uses two spaces after `Model:` (`"Model:  ${w.model}"`) while every other header-section line (`Status:`, `Elapsed:`, etc.) uses one space or a tab-aligned pad matched to column width. The doubled space is inconsistent with the surrounding report format and stands out visually in the raw output. The pattern established by `Status: ${w.status} | Health: ${health}` and `Elapsed: ${elapsed}m` is single-space. This should match.

---

### MINOR

- **`orchestrator-state.md` has duplicate `Session Cost` table blocks** (lines 57–66 and lines 67–73) and duplicate `Session Log` blocks (lines 76–89 and lines 91–112), plus a dangling orphan log entry at line 116. This is a pre-existing state-file mess from a crashed session, not introduced by this task. However, the task did add the `Model` column to the Active Workers table, and that edit landed on top of an already-corrupt file. The task should have cleaned up the duplicate blocks as part of the edit, or noted the pre-existing corruption in a comment.

- **`task-template.md` comment says `default` is "currently claude-opus-4-6"** (line 34) but this is a dated claim baked into a template that is meant to be long-lived. If the system default ever changes, this comment becomes silently wrong. The comment should say "Uses the system default model (see session-orchestrator DEFAULT_MODEL env var)" rather than naming the model explicitly.

- **`get-worker-activity.ts` health enum case inconsistency** — Lines 26–30 use mixed casing: `'COMPACTING'`, `'HIGH_CONTEXT'`, `'STARTING'`, `'STUCK'` are uppercase but `'finished'` and `'healthy'` are lowercase. The `get-worker-stats.ts` counterpart delegates to `assessHealth()` which returns typed `HealthStatus` values, all lowercase. The `get_worker_activity` output is parsed by the supervisor as a text summary (not a structured type), but if a future consumer ever tries to match these strings they will find inconsistency. This inconsistency predates this task but was not introduced by it — just noting it for completeness since both files were touched.

- **`SKILL.md` Step 2 extraction list omits `Priority` and `Complexity`** from what is explicitly listed** — Step 2, item 3 says: "Extract: Type, Priority, Complexity, Model, Dependencies list, File Scope list" — `Priority` and `Complexity` are listed here, which is correct. `Model` is now correctly included. No issue with the list itself, but there is no guidance on what to do if the `Model` field is absent from a task.md written before this feature was added. Step 5c handles this (`omit this parameter entirely if the field is absent, set to default, or the task was created before model selection was added`) but Step 2 does not mention that `Model` is optional/may be absent. A reader implementing Step 2 from scratch would need to infer this.

- **`registry.md` uses `—` (em dash) for tasks without a model value** — Most rows use `—` but tasks TASK_2026_022 and TASK_2026_025 through TASK_2026_028, TASK_2026_033, TASK_2026_043, TASK_2026_045, TASK_2026_046 all use `—` while newer tasks use `default`. The convention is ambiguous: `—` could mean "no model set" or "predates the feature." If the intent is that `—` means "uses system default," it should be documented in the registry header or a legend, or all pre-feature tasks should be backfilled to `default` for consistency. Currently a reader cannot tell if `—` and `default` have the same runtime behavior.

---

### POSITIVE

- **Step 5c and 5d in SKILL.md are precise and unambiguous.** The instruction to omit the `model` parameter entirely (rather than pass the string "default") when no explicit model is set is exactly correct given how `spawn_worker` resolves the default server-side. This distinction would be easy to get wrong.

- **The task-template.md comment block is well-structured.** Each model option is annotated with a cost/complexity rationale, and the `default` sentinel is explained both as a value and as the omit-equivalent. This reduces ambiguity for task authors.

- **`create-task.md` registry row format is explicitly documented** (Step 5 and Important Rules item 3), reducing drift risk when future commands add columns.

- **TypeScript changes are minimal and correct.** Both `get-worker-stats.ts` and `get-worker-activity.ts` access `w.model` which is a properly typed field on the `Worker` interface (confirmed in `worker-registry.ts` and the register opts). No type assertions, no `any`, no optional chaining needed because `model` is always set at registration time.
