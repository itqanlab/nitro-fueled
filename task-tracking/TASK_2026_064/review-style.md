# Style Review — TASK_2026_064

## Score: 7/10

## Verdict: PASS_WITH_NOTES

---

## Findings

### BLOCKING (must fix)

- **`task-tracking/registry.md` lines 52–53** — Two rows are missing the final table cell delimiter. Both TASK_2026_047 and TASK_2026_048 end with `| 2026-03-27 |` and the Model column cell is absent entirely (not even an empty `|`). Every other row closes with `| — |` or `| default |`. A row with a missing cell breaks any parser that counts pipe characters to assign columns. The rows truncate silently and a programmatic reader would misalign the Model column for everything that follows.

  Affected rows:
  ```
  | TASK_2026_047 | COMPLETE    | REFACTORING | ... | — | — | 2026-03-27 |
  | TASK_2026_048 | COMPLETE    | FEATURE     | ... | — | — | 2026-03-27 |
  ```
  Each must end with `| — |` to match the established COMPLETE-row pattern.

---

### MINOR (should fix)

- **`task-tracking/registry.md` lines 54–71 (CREATED rows), Dependencies column** — Five CREATED rows use the word `None` as the Dependencies value (e.g., TASK_2026_054, TASK_2026_055, TASK_2026_059, TASK_2026_063, TASK_2026_066). All other CREATED rows that have no dependencies also use `None`. The canonical format note in both `create-task.md` (Step 5) says Dependencies should be comma-separated Task IDs "or `None`", so `None` is the correct sentinel. However, COMPLETE/CANCELLED rows use `—` for both Priority and Dependencies. This creates two different "no value" sentinels in the same column (`None` for active tasks, `—` for terminal tasks). The distinction is intentional per the spec, but it is not documented anywhere in registry.md itself or the column header. A reader inspecting the table cannot determine from the table alone that this dual-sentinel pattern is by design rather than inconsistency. A single-line comment or a footer note in registry.md would prevent confusion.

- **`.claude/skills/auto-pilot/SKILL.md` line 34 (Primary Responsibilities section)** — Bullet 1 still reads: `"Read registry + task.md files -- build the dependency graph"`. Step 2 was rewritten so the Supervisor reads only the registry at startup and defers `task.md` reads to JIT. This bullet contradicts the actual behavior and will mislead anyone reading the responsibilities summary. It should read something like: `"Read registry — build the dependency graph (task.md read just-in-time, per task)"`

  The same stale bullet exists in `packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` line 34.

- **`.claude/skills/auto-pilot/SKILL.md` Step 2 (line 409)** — The phrase "from the new registry columns" in Step 2 sub-bullet 2 is implementation-era language: `"Priority, Dependencies (from the new registry columns — do NOT rely on the registry Status column..."`. Once this task is complete and the columns are established, "new" is misleading to future readers who have never seen the old schema. The parenthetical "(from the new registry columns)" should be dropped; the constraint about not relying on the Status column for routing is still valuable and should be kept.

  Same text exists verbatim in `packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` line 409.

- **`.claude/skills/auto-pilot/SKILL.md` Step 5-jit heading (line 516)** — The sub-step uses a non-standard heading format: `**5-jit. Just-in-Time Quality Gate (run before any other spawn logic):**`. All sibling sub-steps use `**5a. ...**` and `**5b. ...**` (letter suffixes). A hyphen-number suffix (`5-jit`) is inconsistent with the established lettered pattern and breaks the visual scan. The cross-reference in Step 2b (line 417) uses `Step 5: Spawn Workers → 5-jit. Just-in-Time Quality Gate`, which works but is verbose and will not survive a simple `Ctrl+F` search for `5a` in sequence. The step should either be renumbered to fit the lettered sequence (e.g., by inserting before `5a`) or the naming convention note in review-general.md applies here: mixed sub-step numbering schemes signal to future contributors that insertions should continue the same mixed pattern.

  Same heading exists in `packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`.

- **`.claude/commands/create-task.md` and `packages/cli/scaffold/.claude/commands/create-task.md` Step 5 (line 81)** — The canonical format note uses backtick-quoted column names inline: `` `Task ID | Status | Type | Description | Priority | Dependencies | Created | Model` ``. The columns `Priority` and `Dependencies` are new, but the note does not call out which columns are new vs pre-existing. Future maintainers who apply this format to regenerate the registry have no hint that these two columns are a recent addition and may not exist in registries from older installs. A one-line parenthetical "(Priority and Dependencies added in TASK_2026_064 — legacy rows use `—`)" would make the evolution legible.

---

### SUGGESTIONS (optional)

- **`task-tracking/registry.md` header comment (line 1)** — The file opens with `<!-- DO NOT EDIT — generated by nitro-fueled status -->`. Now that the file also serves as the canonical source for Priority and Dependencies (read directly by the Supervisor), the comment is partly misleading: the file IS regenerated by `nitro-fueled status`, but it is also read as authoritative input. The comment does not acknowledge this dual role. Consider updating to `<!-- Regenerated by nitro-fueled status — also read as source of truth by Supervisor for Priority and Dependencies -->`.

- **`.claude/skills/auto-pilot/SKILL.md` Step 2b (line 415–421)** — The section heading is `### Step 2b: Task Quality Validation — Deferred to Just-in-Time`. This is clear, but the section body includes both a present-tense behavior statement and a forward reference to Step 5-jit. For a document that agents execute sequentially, the forward reference (`see Step 5: Spawn Workers → 5-jit`) is helpful. However, the pre-flight note in the blockquote uses a passive voice hedge ("already ran task completeness and sizing checks") that is slightly ambiguous about whether this refers to a previous supervisor invocation or the current run's command entry point. Clarifying "before the Supervisor was invoked" would remove any ambiguity.
