# Code Logic Review — TASK_2026_125

## Score: 5/10

## Verdict: REVISE

## Critical Issues

### 1. CRITICAL — No runtime enforcement of `--role reviewer|both` requiring `--compare`
**Location**: `SKILL.md` — Step E1
The parameters table and command-file argument parsing note that `--role reviewer|both` requires `--compare`, but SKILL.md's E1 step has no FATAL/EXIT enforcement for this constraint. If a supervisor agent reaches the evaluation flow with `eval_role = reviewer` and `ab_mode = false`, E5d dereferences `EVAL_WORKTREE_B` and `baseline_model_id` which are undefined. No error is emitted; execution enters an undefined state.
**Fix**: Add at the end of Step E1: "If `eval_role` is `reviewer` or `both` and `ab_mode = false`: emit `FATAL: --role reviewer|both requires --compare <baseline-model>.` EXIT."

### 2. CRITICAL — `baseline_model_id` receives no input validation; path traversal in worktree construction
**Location**: `SKILL.md` — Step E1 (absent) / Step E4
Step E1 applies a 4-step validation chain to `eval_model_id`. `baseline_model_id` (from `--compare`) is used directly in `git worktree add .claude/worktrees/eval-{baseline_model_id}` with zero validation. A value like `../../tmp/evil` produces a worktree path outside `.claude/worktrees/`.
**Fix**: Apply identical E1 validation chain (sanitize, path-traversal check, allowlist prefix) to `baseline_model_id`. Add identity check: if `baseline_model_id == eval_model_id`, emit FATAL and EXIT.

## Serious Issues

### 3. SERIOUS — `--reviewer` silently ignored when combined with `--role reviewer`
**Location**: `SKILL.md` — Step E5d Phase 2
E5d Phase 2 hardcodes `eval_model_id` as the reviewer. When `--reviewer C` is also provided, C is silently ignored. AC3 ("--reviewer overrides the reviewer model") is violated for this combination.
**Fix**: E5d Phase 2 reviewer model selection: use `reviewer_model_id if reviewer_model_id != null else eval_model_id`.

### 4. SERIOUS — Same model IDs in `--evaluate` and `--compare` cause worktree path collision
**Location**: `SKILL.md` — Step E4
`--evaluate X --compare X` causes E4 to attempt `git worktree add` to the same path twice. The second call fails; the retry/cleanup sequence may leave `.claude/worktrees/` in an inconsistent state.
**Fix**: Add identity check in E1: if sanitized `baseline_model_id == eval_model_id`, emit FATAL and EXIT.

### 5. SERIOUS — E5e lacks explicit MODEL_DIR re-assignment between passes
**Location**: `SKILL.md` — Step E5e
E6's result-file completion handler uses `MODEL_DIR` set at E3. E5e states "each pass uses its own directories" but never explicitly re-assigns the `MODEL_DIR` variable before Pass 2. Reviewer-pass result files may land in the builder-pass directory.
**Fix**: Add explicit `MODEL_DIR_A` / `MODEL_DIR_B` re-assignment instructions at the start of Pass 2 in E5e.

## Moderate Issues

### 6. MODERATE — Builder mode description promises reviewer phase that E5c never implements
**Location**: `SKILL.md` Modes table (line ~172); task description
The Modes table says "builder (default): model under test as Build Worker, **baseline as Reviewer**" — but E5c only spawns two Build Workers. No review phase exists in A/B builder mode.
**Fix**: Either update the description to "both models run as Build Workers, no review phase" or add the review phase to E5c.

### 7. MODERATE — Concurrent evaluation runs share the same EVAL_DIR with no collision guard
**Location**: `SKILL.md` — Step E3
Two evaluations on the same date with the same model write to the same `evaluations/{EVAL_DATE}-{model_id}/` directory. No existence check occurs before writing `session.md`. Results silently corrupt each other.
**Fix**: At E3 start, check if `EVAL_DIR` already exists and is non-empty; emit FATAL and EXIT on collision.

### 8. MODERATE — Worktree reset exit-code not checked; task cross-contamination risk
**Location**: `SKILL.md` — Step E6 step 5
`git checkout -- . && git clean -fd` reset commands are specified but no exit-code handling exists. A failed reset leaves the next task with artifacts from the previous task.
**Fix**: Capture exit codes of reset commands. On non-zero: log warning and skip remaining tasks.

### 9. MODERATE — `Notes` field written to markdown table without pipe-character sanitization
**Location**: `SKILL.md` — E6 step 3c + Review Worker prompt template
The Notes field from result files is written verbatim into session.md's markdown table. A `|` character in Notes breaks the table structure.
**Fix**: Specify that Notes must be sanitized (strip `|`, truncate to 200 chars) before insertion.

## Requirements Fulfillment

| Acceptance Criterion | Status |
|---------------------|--------|
| `--compare <baseline>` runs same tasks on both models in parallel worktrees | PARTIAL — baseline model ID unvalidated; collision if same model ID used |
| `--role builder\|reviewer\|both` controls which role model is tested in | PARTIAL — no runtime guard for `reviewer\|both` without `--compare`; builder description overpromises |
| `--reviewer <model>` overrides the reviewer model | PARTIAL — silently ignored in `--role reviewer` combination |
| A/B results stored separately with clear model labeling | PARTIAL — concurrent runs on same date corrupt results |
| Role "both" produces separate builder and reviewer scores | PARTIAL — MODEL_DIR re-assignment between passes implicit only |
