# Code Logic Review — TASK_2026_020

## Score: 7/10

## Acceptance Criteria Status

- [x] task-template.md includes an optional Model field with valid enum values
- [x] Auto-pilot reads the Model field from task.md and passes it to spawn_worker
- [x] Workers spawn with the correct model as specified in the task
- [x] Tasks without a Model field (or set to `default`) use the system default model
- [o] Registry shows which model was used for each completed task
- [x] Orchestrator-state Active Workers table includes the model column
- [x] get_worker_stats response includes the model name
- [x] /create-task prompts for model selection (optional, defaults to `default`)

---

## Findings

### BLOCKING

**1. Registry Model column is write-once at creation, never updated at completion.**

The acceptance criterion reads: "Registry shows which model was used for each completed task." The implementation populates the Model column in the registry at `/create-task` time (Step 5 of create-task.md) and in the auto-pilot state table at spawn time (SKILL.md Step 5d). However, no instruction anywhere tells the Build Worker or Review Worker to write the actual model used back into the registry row at completion. Workers update the registry Status column as their last action before exit — the model is already in the row at creation — but pre-existing tasks (TASK_2026_001 through TASK_2026_019) have `—` in the Model column because they predate this feature. Nothing closes that gap for tasks already in the registry when the feature shipped.

More critically: the Model column in the registry comes from `task.md`'s Model field at task-creation time. If `task.md` has `default`, the registry row records `default`, not the actual resolved model name (e.g., `claude-opus-4-6`). A user looking at the registry cannot tell whether `default` means "system default was used" or "no model was specified and we don't know what ran." The acceptance criterion says "which model was used," but `default` is a sentinel, not a model name. The registry does not record the resolved model.

Evidence from registry.md:
```
| TASK_2026_020 | COMPLETE | FEATURE | Per-Task Model Selection | 2026-03-24 | default |
```
The task itself ran on `claude-opus-4-6` (the DEFAULT_MODEL in spawn-worker.ts), but the registry shows `default` — an alias, not the actual model.

**Fix**: The auto-pilot SKILL.md Step 5d should instruct the supervisor to write the *resolved* model name (what was actually passed to `spawn_worker`, or `DEFAULT_MODEL` if omitted) back into the registry at spawn time, not the raw field value from task.md. The supervisor already has this information.

---

**2. SKILL.md Step 2 does not specify how to handle a missing Model field vs. the string `"default"` — two distinct cases that must produce identical behavior but are described only in Step 5c.**

Step 2 of the auto-pilot loop says: "Extract: Type, Priority, Complexity, **Model**, Dependencies list, File Scope list." It does not define what value is stored internally when `task.md` has no Model row at all (pre-existing tasks before this feature shipped). Step 5c handles the omit-or-default case: "omit this parameter entirely if the field is absent, set to `default`, or the task was created before model selection was added." This is correct behavior, but the extraction step (Step 2) doesn't say what the extracted Model value is in the absent case — `undefined`, empty string, or `null`? An LLM implementing Step 2 will assign something, and Step 5c must then match it.

The gap: Step 5c says "task was created before model selection was added" as a third case, but the supervisor has no reliable way to detect this. Tasks TASK_2026_001 through TASK_2026_019 simply have no Model row; the supervisor would parse that as absent (same as `default`). This works by coincidence — the absence-equals-default path happens to be correct — but it relies on the LLM correctly mapping "no field found" to the omit-parameter branch, which is not explicitly stated in Step 2.

**Fix**: Step 2 should define explicitly: "If the Model field is absent or not present in the Metadata table, treat it as `default`." This makes the extraction unambiguous and removes the need for the "task was created before model selection was added" special case in Step 5c.

---

### SERIOUS

**3. `get_worker_activity` and `get_worker_stats` use duplicated health assessment logic that is inconsistent.**

The `assessHealth` function in `get-worker-stats.ts` (line 59–68) and the inline health logic in `get-worker-activity.ts` (lines 25–30) are separate implementations. They were already flagged in review-general.md as a duplication anti-pattern (TASK_2026_019). This task added `Model: ${w.model}` to both files, but did not extract the shared health logic. The inconsistency is now also visible in enum case: `get-worker-stats.ts` returns lowercase `'finished'`, `'compacting'`, `'high_context'` etc., while `get-worker-activity.ts` returns `'finished'`, `'COMPACTING'`, `'HIGH_CONTEXT'`, `'STARTING'`, `'STUCK'`, `'healthy'`. Mixed cases cause the supervisor to pattern-match against inconsistent health strings from different tools. If the supervisor calls `get_worker_activity` and checks for `'compacting'`, it will silently miss the `'COMPACTING'` response.

The task's scope was to add model reporting, not to fix this pre-existing bug, but the task touched both files and had an opportunity to fix it. The inconsistency now affects any new code that consumes both tools (e.g., the supervisor logic in Step 6 that escalates from activity to stats based on health string matching).

**Fix**: Extract the health assessment into a shared utility function and normalize the case to match the `HealthStatus` type definition in `types.ts` (which uses lowercase). This is a cross-file concern that any change to these two files should address.

---

**4. The `model` field is not included in `list_workers` output.**

`get_worker_stats` and `get_worker_activity` both now surface the model. But `list_workers` (`list-workers.ts`, lines 24–33) does not include the model in its output. The supervisor uses `list_workers` in Step 1 (MCP validation check) and for reconciliation of active workers on restart. If a user calls `list_workers` directly to inspect running workers, they cannot see the model.

This is minor relative to the acceptance criteria (which only mention `get_worker_stats`), but it's an inconsistency introduced by partial surfacing: two of three read-facing tools show the model, one does not.

---

**5. SKILL.md Step 5d stores `"default"` in orchestrator-state.md when no model is passed — but the example in the Active Workers table shows `default` without quotes.**

The instruction in Step 5d says: "model (the model passed to spawn_worker, or `"default"` if none was specified)." The existing orchestrator-state.md Active Workers table row (line 21) shows:

```
| 1aaf7dc2 | TASK_2026_023 | Build | ... | default | -- |
```

This is the sentinel string `default`, not the resolved model. For reporting accuracy, and to satisfy the "shows which model was used" criterion, the supervisor should write the resolved model name. Storing `default` is ambiguous — the worker may have used `claude-opus-4-6` or any other model the server's `DEFAULT_MODEL` env var resolves to at spawn time.

The spawn-worker.ts line `const model = args.model ?? DEFAULT_MODEL;` does the resolution, and it returns the response including the resolved model in the worker record. The supervisor could read the worker_id response back and use the actual model from the registry — but there is no instruction to do so. The supervisor writes its state before knowing what model the server resolved to.

---

### MINOR

**6. task-template.md comment says the system default is "currently claude-opus-4-6" — this hardcodes an assumption that will drift.**

Line 34 of task-template.md:
```
default — Uses the system default model (currently claude-opus-4-6). Omit this field or set to "default" to use the system default.
```

The system default is controlled by `DEFAULT_MODEL` env var in spawn-worker.ts (`process.env['DEFAULT_MODEL'] ?? 'claude-opus-4-6'`). If the environment variable is changed or the fallback is updated, the template comment becomes incorrect. The template is the document users reference when picking a model — an incorrect default claim misleads cost estimation.

**Fix**: Remove the parenthetical `(currently claude-opus-4-6)` or replace it with "determined by the session-orchestrator DEFAULT_MODEL environment variable."

---

**7. /create-task Step 5 stores the raw Model field value from the user's input — it should normalize `default` to `default` and validate against the enum.**

create-task.md Step 6a validates Type, Priority, and Description, but there is no validation that the Model value the user typed is one of the four valid enum values. If a user types `claude-opus-4-5` (an outdated model name), it gets written to the registry and to task.md without any warning. The sizing validation in Step 6b and the auto-pilot readiness check in Step 6a have no model validation row.

The task-template.md defines the enum, and the create-task.md says "extract valid values from the template" for Type, Priority, Complexity — but Model is listed separately in the prompt gathering section without a corresponding validation check. This is inconsistent with how other enum fields are handled.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Model field absent from task.md (pre-existing task) | YES | Step 5c: omit param, server uses default | Works, but Step 2 extraction is ambiguous |
| Model field set to `default` | YES | Step 5c: omit param | Correct behavior, resolved by spawn-worker |
| Model field set to invalid string | NO | Not caught | Written to registry and passed to spawn_worker; server may reject or ignore |
| Task created before this feature, Model column missing from registry row | PARTIAL | Registry row has `—` sentinel | Supervisor reads task.md at runtime, not registry Model column, so spawn works — but registry shows `—` forever |
| User queries list_workers to see model | NO | list-workers.ts does not include model | Silent gap in tooling parity |
| DEFAULT_MODEL env var changes between runs | NO | template comment hardcodes assumption | Documentation drift |

---

## The 5 Paranoid Questions

**1. How does this fail silently?**
The registry Model column records `default` instead of the resolved model name. A task that ran on `claude-haiku-4-5-20251001` because the operator set `DEFAULT_MODEL=claude-haiku-4-5-20251001` will show `default` in the registry — indistinguishable from a task where the user explicitly set `default` intending Opus. Cost auditing on the registry is impossible without the resolved model name.

**2. What user action causes unexpected behavior?**
A user types `claude-sonnet-4-6-20250919` (a versioned alias not in the enum) into the Model prompt during `/create-task`. The value passes through to task.md, the registry, and ultimately to `spawn_worker`. spawn-worker.ts passes it verbatim to the launcher. Whether the Claude CLI accepts or rejects the model string depends on the CLI version — there is no validation layer in the Nitro-Fueled side.

**3. What data makes this produce wrong results?**
A task.md with a Model field that reads `Default` (capital D) would not match the literal `default` check in Step 5c. Step 5c says 'set to `default`' (lowercase). An LLM parsing the SKILL.md may correctly case-normalize it, but the spec does not say to normalize — it says match the literal. This is a single-character difference that could cause the model string `Default` to be passed to spawn_worker instead of being omitted.

**4. What happens when dependencies fail?**
If spawn_worker rejects the model string (e.g., unsupported model name), the error surfaces as an MCP error and Step 5e handles it: "Leave task status as-is, will retry next loop iteration." The task will retry indefinitely up to the retry limit with the same invalid model string, hitting the same error each time, then be marked BLOCKED. There is no pre-spawn model validation. The BLOCKED reason in the registry will say "exceeded N retries" not "invalid model name," which will confuse the user.

**5. What's missing that the requirements didn't mention?**
Model validation at the boundary (before spawn). The task spec describes surfacing and passing the model field, but does not require validation that the string is a valid model identifier. Without validation, an invalid model causes retry exhaustion and BLOCKED status with a misleading error message. The right place to catch this is either in `/create-task` Step 6a (validate the model enum) or in the supervisor's Step 2b task quality check (add model validation to the validation table).

---

## What Robust Implementation Would Include

1. **Resolved model name stored in registry** — supervisor writes `DEFAULT_MODEL` resolution to the registry at spawn time, not the sentinel `default`.
2. **Model validation in /create-task** — Step 6a should include a Model row in the validation table, extracting valid values from task-template.md.
3. **Model validation in Step 2b** — supervisor's task quality check should reject tasks with unrecognized model strings before spawning, logging a clear reason.
4. **Shared health assessment utility** — extract duplicated health logic from get-worker-stats.ts and get-worker-activity.ts into a shared function, normalizing case to match the `HealthStatus` type.
5. **Model in list_workers output** — complete tooling parity so all three read-facing tools (list, activity, stats) surface the model.
6. **Case-insensitive model field matching in SKILL.md** — Step 5c should explicitly say "normalize the Model field to lowercase before comparing."
