# Code Style Review — TASK_2026_119

## Summary

The `/nitro-burn` command file is well-structured and covers its feature scope clearly. However, several style issues — a misleading document title, a broken step-numbering scheme, inconsistent command references in the empty-state output, ambiguous table column alignment, and missing duration-format coverage in the parsing spec — reduce clarity for an AI agent executing the command and will cause maintenance drift.

---

## Findings

### HIGH-1: Document title does not match the command name

**File**: `.claude/commands/nitro-burn.md` line 1 (both copies)

The H1 heading reads `# Burn — Token and Cost Analytics`. Every other command in `.claude/commands/` uses the full command name as its H1 (e.g., `# Status — Project Status Report`, `# Retrospective — Post-Session Analysis and Learning Loop`). An agent searching by heading or an operator skimming the scaffold will not find this file by the expected name. The title should be `# Nitro Burn — Token and Cost Analytics` to match the pattern and to match the output heading shown in Step 5 (`# Nitro Burn`).

Note: the *output* block at line 91 already uses `# Nitro Burn` — the document title and the output heading are inconsistent with each other and with the command family convention.

**Severity**: HIGH — naming inconsistency within the command family violates the "named concepts must use one term everywhere" lesson.

---

### HIGH-2: Step numbering skips Step 0 / Pre-Flight, breaking the "Step N" citation contract

**File**: `.claude/commands/nitro-burn.md` lines 17–42 (both copies)

Steps are numbered 1–5 with no Step 0. Every other multi-step command in the family (`nitro-retrospective`, `nitro-run`) uses a Step 0 for pre-flight validation (workspace existence, argument format). Here, argument validation is embedded inside Step 1 without an explicit pre-flight gate. This is not a blocking functional issue, but it means:

1. Any cross-reference that says "see Step 1" is doing double-duty (validation AND data sourcing), which makes the step ambiguous.
2. If a pre-flight step is ever added later, all downstream step numbers must be renumbered — a maintenance trap documented in the review-general lessons ("Step numbering in command docs must be flat and sequential").

**Severity**: HIGH — the lesson explicitly calls out mixed-responsibility steps as a maintenance defect.

---

### MEDIUM-1: Empty-state output references `/orchestrate` without the `nitro-` prefix

**File**: `.claude/commands/nitro-burn.md` line 83 (both copies)

The empty-state block reads:
```
Run /nitro-auto-pilot or /orchestrate TASK_ID to start generating data.
```

`/orchestrate` was renamed to `/nitro-orchestrate` in TASK_2026_116, which is listed as a dependency of this task. The un-prefixed reference is a stale pointer that will confuse users and any agent that parses the empty-state message to suggest next steps. It should read `/nitro-auto-pilot or /nitro-orchestrate TASK_ID`.

**Severity**: MEDIUM — user-facing text references a command that no longer exists by that name.

---

### MEDIUM-2: Duration parsing rule covers only `Nm` format; `Xh Ym` format is unspecified

**File**: `.claude/commands/nitro-burn.md` line 68 (both copies)

Step 4 says: "parse `Nm` format to minutes". But `session-analytics.md` files also contain durations already written in `Xh Ym` format (e.g., `1h 4m`). An agent following the spec literally will fail to parse those entries and either produce a wrong total or skip them silently. The parsing rule should state: "parse both `Nm` and `Xh Ym` formats; convert all to total minutes before summing."

This is an ambiguous algorithm spec — the review-general lesson applies: "Algorithm specs that count or aggregate discrete items must define the counting/parsing rule precisely."

**Severity**: MEDIUM — produces silent incorrect totals when any task ran longer than 60 minutes.

---

### MEDIUM-3: Merge table column alignment is inconsistent

**File**: `.claude/commands/nitro-burn.md` lines 48–58 (both copies)

The merge table in Step 3 has misaligned column separators. The header row uses `|-------|---------------|----------|` but the separator widths do not match the column header widths. While most Markdown renderers tolerate this, several AI agent parsers that parse raw pipe-table text (including the Glob/Read pipeline the command itself instructs) can produce off-by-one column assignments. Per review-general: "All table rows must have the same number of cells" and consistent pipe alignment is required.

Specific: the `Fallback` column header is 8 characters but its separator cell is `----------` (10 dashes), while `Primary Source` is 14 characters but its separator is `---------------` (15 dashes). The mismatch is cosmetic in renderers but is a latent parse defect.

**Severity**: MEDIUM — does not break rendered output but contradicts the documented table alignment rule.

---

### MEDIUM-4: `list_workers` tool name format is ambiguous — parentheses vs MCP call syntax

**File**: `.claude/commands/nitro-burn.md` lines 28, 55–58 (both copies)

The command references the MCP call as `list_workers(status_filter: "all")` in prose (Step 2, bullet 1) but as bare `MCP list_workers` in the merge table (line 55). Two formats for the same tool reference in the same document trains agents to treat them as different tools. Other commands in the family consistently use either the MCP call syntax or the bare tool name — never both. Pick one and use it throughout.

The review-general lesson applies: "Named concepts must use one term everywhere."

**Severity**: MEDIUM — an agent parsing the merge table may not recognize `MCP list_workers` as the same tool as `list_workers(status_filter: "all")`.

---

### LOW-1: "Scope" line in the output template uses `|` as separator inside a non-table context

**File**: `.claude/commands/nitro-burn.md` line 93 (both copies)

```
{Scope: all tasks | tasks since YYYY-MM-DD | TASK_ID only}
```

The `|` character is used here as an "or" separator inside a template variable, but `|` is also the Markdown table cell delimiter. An agent outputting this line verbatim would produce a broken table row if the output block is ever interpreted in a table context. A cleaner separator that avoids ambiguity is `/` or the word `or`:

```
{Scope: all tasks / tasks since YYYY-MM-DD / TASK_ID only}
```

**Severity**: LOW — cosmetic but a latent source of Markdown parse confusion.

---

### LOW-2: "Cost Note" section uses inconsistent quotation wrapping

**File**: `.claude/commands/nitro-burn.md` lines 116–120 (both copies)

The three Cost Note variants are wrapped in double-quotes (`"..."`) inside the fenced code block. The two multi-line variants break across lines mid-sentence, which means an agent outputting the block verbatim produces quoted strings with embedded newlines. The single-line variant has no line break. This inconsistency makes the format ambiguous — are the quotes part of the output or just template delimiters? Other output templates in the file (e.g., the Per-Task table) use no quotation marks. Remove the quotes and format all three variants as unquoted text.

**Severity**: LOW — agent may output literal quotation marks or may strip them inconsistently.

---

### LOW-3: `Generated:` timestamp format is underspecified

**File**: `.claude/commands/nitro-burn.md` line 92 (both copies)

`Generated: {YYYY-MM-DD HH:MM}` does not specify the timezone. An agent running in UTC will produce a different value than one running in the user's local timezone. Given the `--since` filter compares against `Start Time` values in `session-analytics.md`, a timezone mismatch could cause boundary tasks to appear/disappear depending on the runner's locale. The spec should state: "Use local time" or "Use UTC (append Z)."

**Severity**: LOW — edge case only when tasks run near midnight, but ambiguity in the spec will cause divergence between implementations.

---

### LOW-4: File identity check — both copies are byte-for-byte identical

**File**: `.claude/commands/nitro-burn.md` vs `apps/cli/scaffold/.claude/commands/nitro-burn.md`

A diff confirms both files are identical. This satisfies the acceptance criterion. No divergence found.

**Severity**: PASS — no issue.

---

## 5 Critical Questions

### 1. What could break in 6 months?

The duration parsing spec (MEDIUM-2) will produce silent wrong totals as more tasks accumulate and `Xh Ym` durations become common. The `/orchestrate` stale reference (MEDIUM-1) will become increasingly confusing as new contributors onboard and encounter the empty-state message without knowing the old name.

### 2. What would confuse a new team member?

The document title `# Burn` vs the command name `/nitro-burn` vs the output heading `# Nitro Burn` — three different forms for the same concept in the same file. A new contributor asked to update the command will struggle to find it by heading.

### 3. What's the hidden complexity cost?

The merge table's dual reference to `list_workers` (as a function call and as a bare label) means any future agent that parses the table to build a data-source map will need special-case logic to unify the two forms. This is a small but real parsing tax on every consumer of the spec.

### 4. What pattern inconsistencies exist?

- Title format does not match the rest of the command family (HIGH-1).
- Step 0 pre-flight omitted when every comparable command includes one (HIGH-2).
- Tool name written two different ways in the same document (MEDIUM-4).

### 5. What would I do differently?

Rename the H1 to `# Nitro Burn — Token and Cost Analytics`. Extract argument validation into an explicit Step 0. Use a single consistent tool reference style (the MCP call syntax with parameters, matching the rest of the codebase). Fix the `/orchestrate` stale reference. Add the `Xh Ym` parsing rule to Step 4.

---

## Verdict

**PASS_WITH_NOTES**

The command is functionally complete and the two copies are in sync. The issues found are style, naming-consistency, and spec-precision problems — none block execution for the common case. However, HIGH-1 (title mismatch) and HIGH-2 (Step 0 omission / mixed-responsibility step) should be addressed before this command is treated as a stable template, because the same patterns will be copied into every project that runs `npx nitro-fueled init`.
