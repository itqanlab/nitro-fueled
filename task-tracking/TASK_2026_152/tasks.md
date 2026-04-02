# Development Tasks — TASK_2026_152

## Batch 1: SKILL.md HARD RULES and Protocol Updates — COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Update HARD RULES Rule #1 — Banned Bash patterns

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

Added explicit examples of banned Bash patterns under Rule #1:
- `for task in ...; do cat task.md` — looping over task folders
- `cat task-tracking/TASK_*/status` — reading status files via Bash
- `head -1 status` or `tail -5 log.md` — partial file reads via Bash
- `grep -r "CREATED" task-tracking/` — searching task files via Bash
- Any Bash command that outputs file content from `task-tracking/`

### Task 1.2: Update HARD RULES Rule #2 — Pre-flight reads registry columns ONLY

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

Updated Rule #2 to explicitly state: "pre-flight reads registry columns ONLY — no task.md reads under any circumstance". Added that reading task.md before spawn to "check dependencies" or "verify type" is a pre-flight violation even if the data would be useful.

### Task 1.3: Update HARD RULES Rule #4 — Banned hallucinated provider labels

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

Added explicit examples of banned provider labels: `Cloudcode`, `Codex`, `OpenCode`, `Ollama`, `GPT`, `Gemini`, or any name not returned verbatim by `get_available_providers()`. Added clarification that routing labels in state.md MUST use provider IDs returned verbatim from `get_available_providers()`.

### Task 1.4: Update HARD RULES Rule #7 — Banned tangent patterns

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

Added explicit banned tangent patterns:
- Checking for newer tasks via `git log`, `git diff`, or any VCS command
- Scanning git commits to find recently created task files
- Exploring `.claude/` or `task-tracking/` directories out of curiosity
- Reading reference files "just in case" or to "understand the system"
- Any investigation not explicitly required by the current step

### Task 1.5: Update Load-on-Demand Protocol — No batch-loading rule

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

Added explicit rule: "NEVER batch-load two references in one round — one trigger event, one file load." Included the violation example of loading `parallel-mode.md` and `worker-prompts.md` simultaneously.

### Task 1.6: Update Data Access Rules table — Pre-flight row

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Status**: COMPLETE

Added a new row to the Data Access Rules table for "Task list/status during pre-flight" that explicitly bans `npx nitro-fueled status`, `cat task.md`, `Read task.md`, and `Bash` on any task file during pre-flight.

## Batch 2: parallel-mode.md and Scaffold Sync — COMPLETE

**Developer**: nitro-systems-developer

### Task 2.1: Add Pre-Flight Exit Gate to parallel-mode.md

**File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
**Status**: COMPLETE

Added a new "Pre-Flight Exit Gate" section at the top of parallel-mode.md that mandates the supervisor's very next action after pre-flight checks (Steps 1-4) MUST be one of:
1. Call `spawn_worker` — if actionable tasks exist
2. Log "all tasks blocked" — if no actionable tasks remain
3. Log "--limit reached" — if task limit reached

Explicitly bans: reading additional reference files, checking for newer tasks, investigating the codebase, summarizing findings in a table, re-reading registry or task files.

### Task 2.2: Sync scaffold files

**Files**: `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`, `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`
**Status**: COMPLETE

Copied updated SKILL.md and parallel-mode.md from source to scaffold directory to maintain byte-for-byte parity.
