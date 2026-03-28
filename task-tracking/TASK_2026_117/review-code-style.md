# Code Style Review — TASK_2026_117

**Reviewer**: nitro-code-style-reviewer
**Scope**: `apps/cli/scaffold/.claude/commands/*.md` (17 files)
**Verdict**: ⚠️ CONDITIONAL PASS — 2 blocking issues, 7 serious issues, 3 minor issues

---

## Findings Summary

| Severity | Count |
|----------|-------|
| Blocking | 2 |
| Serious  | 7 |
| Minor    | 3 |

---

## Blocking Issues

### B-1 — Old command name in H1 title (`nitro-evaluate-agent.md`, L1)

**Rule**: Named concepts must use one term everywhere (Rule 1)

The H1 title explicitly embeds the pre-rename command name:

```
# `/evaluate-agent` — Agent Calibration Loop
```

The Usage line on L3 correctly uses `/nitro-evaluate-agent`, creating a direct contradiction within the same file. The heading is a user-visible label and a named reference — it must use the canonical `nitro-` form.

**Expected**: `# \`/nitro-evaluate-agent\` — Agent Calibration Loop`

---

### B-2 — Old command name in prose (`nitro-orchestrate-help.md`, L3)

**Rule**: Named concepts must use one term everywhere (Rule 1)

The file description on L3 reads:

```
Quick help guide for the `/orchestrate` command workflow system.
```

The body of the file correctly uses `/nitro-orchestrate` (L8), but the summary sentence references the pre-rename name. A reader scanning the top of the file gets the wrong command name.

**Expected**: `Quick help guide for the \`/nitro-orchestrate\` command workflow system.`

---

## Serious Issues

### S-1 — Stale legacy validate-* command references (`nitro-orchestrate-help.md`, L107–L112)

**Rule**: Named concepts must use one term everywhere (Rule 1); implementation-era language removed before merge (Rule 5)

The "Validate Specific Phase" section lists five commands with no `nitro-` prefix:

```
/validate-project-manager TASK_CMD_009
/validate-architect TASK_CMD_009
/validate-developer TASK_CMD_009
/validate-tester TASK_CMD_009
/validate-reviewer TASK_CMD_009
```

These commands do not exist in the scaffold (no corresponding `*.md` files in scope). The task ID format `TASK_CMD_009` is also a legacy format — current format is `TASK_YYYY_NNN`. This entire section is dead content that was not cleaned up during the rename.

---

### S-2 — Agent name `code-reviewer` doesn't match any `nitro-*` agent (`nitro-review-code.md`, L3)

**Rule**: Named concepts must use one term everywhere (Rule 1)

Line 3 reads:

```
**Agent Integration**: This command is executed by the code-reviewer agent as Phase 1 of the systematic triple review protocol.
```

The agent catalog (referenced from `nitro-orchestrate.md`) lists agents as `nitro-code-style-reviewer` and `nitro-code-logic-reviewer`. There is no `code-reviewer` agent in the `nitro-*` namespace. This reference is inconsistent with the project's agent naming convention.

---

### S-3 — Agent name `code-reviewer` doesn't match any `nitro-*` agent (`nitro-review-logic.md`, L3)

Same as S-2. Line 3 reads:

```
**Agent Integration**: This command is executed by the code-reviewer agent as Phase 2 of the systematic triple review protocol.
```

---

### S-4 — Agent name `code-reviewer` doesn't match any `nitro-*` agent (`nitro-review-security.md`, L3)

Same as S-2. Line 3 reads:

```
**Agent Integration**: This command is executed by the code-reviewer agent as Phase 3 of the systematic triple review protocol.
```

---

### S-5 — Mixed step numbering: top-level "Step 5b/5c" collides with sub-steps inside Step 5 (`nitro-create-agent.md`, L77–L100)

**Rule**: Step numbering must be flat and sequential — no mixed schemes (Rule 8)

Step 5 contains inner sub-step labels `**5a.**`, `**5b.**`, `**5c.**`, `**5d.**`. Immediately after, two sibling H3 headings are also labeled `Step 5b` and `Step 5c`:

```
### Step 5: Update Agent Catalog
  **5a.** Capability Matrix…
  **5b.** Development Agents Section…  ← inner sub-step
  **5c.** Agent Category Summary…       ← inner sub-step
  **5d.** Header Count…

### Step 5b: Update Orchestrate Command   ← top-level step with same number
### Step 5c: Validate Catalog Updates      ← top-level step with same number
```

The same number label (5b, 5c) is used for both a top-level H3 step and an inner bullet point. This produces ambiguous references and violates the flat sequential rule.

---

### S-6 — Mixed step numbering: Roman numeral sub-suffix `4c-ii` (`nitro-auto-pilot.md`, L123)

**Rule**: Step numbering must be flat and sequential — no mixed schemes (Rule 8)

All other sub-steps in this file use single-letter suffixes (3a, 3b, 3c, 3d; 4a, 4b, 4c, 4d…). The heading on L123:

```
**4c-ii. Validation B-ii: Orphan BLOCKED Task Detection (Warning)**
```

introduces a hyphenated Roman numeral suffix to represent a sub-step of 4c. The scheme mixes letter suffixes and Roman numeral suffixes. To be consistent, this should use a letter suffix (e.g., `4d`) and renumber subsequent sub-steps, or adopt a uniform nested scheme.

---

### S-7 — Tombstone step uses implementation-era language (`nitro-create-task.md`, L156)

**Rule**: Implementation-era language must be removed before merge (Rule 5)

Step 6b reads:

```
**6b.** *(Removed — sizing validation now runs in Step 3c before writing any files.)*
```

This is a migration artifact — a deleted step preserved with an inline explanation of why it was removed. Steady-state documentation must not preserve step tombstones. The step should be removed entirely; the sequencing rationale (if important) belongs in a code comment in the skill file, not a visible step placeholder.

---

## Minor Issues

### M-1 — `nitro-initialize-workspace.md` has no H1 heading or command identity

Unlike all 16 other command files, `nitro-initialize-workspace.md` contains no H1 heading and no Usage section. It begins directly with `Analyze this codebase…` — the raw prompt body without any command metadata wrapper. This is a structural inconsistency with the file pattern established by every other command in the scaffold. Not a naming issue, but a uniformity gap.

---

### M-2 — `nitro-orchestrate-help.md` L95–L96: `!cat` shell syntax in code blocks

The "Check Status" code block uses interactive shell bang syntax:

```
!cat task-tracking/registry.md | grep "IN_PROGRESS\|BLOCKED\|FAILED"
!cat task-tracking/TASK_CMD_009/progress.md
```

`!cmd` is a Jupyter/REPL convention, not standard shell. Also references the legacy `TASK_CMD_009` task ID. These code examples are inconsistent with the rest of the scaffold, which uses `bash` fenced code blocks with standard shell commands.

---

### M-3 — `nitro-create-agent.md` Step 4b top-level numbering (`nitro-create-agent.md`, L78)

`### Step 4b: Validate Generated Agent` is a top-level H3 step labeled with a sub-step suffix. All other top-level steps use integer labels (Step 1, 2, 3, 4, 5, 6). The `4b` label suggests it is subordinate to Step 4, yet it is formatted as a peer H3. This is inconsistent — it should either be a sub-section inside Step 4 or be renumbered (e.g., Step 5, shifting subsequent steps). Less severe than S-5 because there is no collision with inner sub-steps in this case.

---

## File Verdicts

| File | Verdict | Issues |
|------|---------|--------|
| `nitro-auto-pilot.md` | ⚠️ Serious | S-6 |
| `nitro-create-agent.md` | ⚠️ Serious | S-5, M-3 |
| `nitro-create-skill.md` | ✅ Pass | — |
| `nitro-create-task.md` | ⚠️ Serious | S-7 |
| `nitro-create.md` | ✅ Pass | — |
| `nitro-evaluate-agent.md` | ❌ Blocking | B-1 |
| `nitro-initialize-workspace.md` | ⚠️ Minor | M-1 |
| `nitro-orchestrate-help.md` | ❌ Blocking | B-2, S-1, M-2 |
| `nitro-orchestrate.md` | ✅ Pass | — |
| `nitro-plan.md` | ✅ Pass | — |
| `nitro-project-status.md` | ✅ Pass | — |
| `nitro-retrospective.md` | ✅ Pass | — |
| `nitro-review-code.md` | ⚠️ Serious | S-2 |
| `nitro-review-logic.md` | ⚠️ Serious | S-3 |
| `nitro-review-security.md` | ⚠️ Serious | S-4 |
| `nitro-run.md` | ✅ Pass | — |
| `nitro-status.md` | ✅ Pass | — |
