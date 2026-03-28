# Review Context — TASK_2026_125

## Task

Evaluation Supervisor — A/B Comparison and Role Testing

Extended the auto-pilot evaluation mode with:
- `--compare <baseline-model>` (A/B comparison mode)
- `--role builder|reviewer|both` (role testing)
- `--reviewer <model-id>` (reviewer model override)
- Evaluation Review Worker prompt template

## Files Reviewed

| File | Change |
|------|--------|
| `.claude/skills/auto-pilot/SKILL.md` | +429 lines — evaluation mode sections E1–E7, modes table, review worker prompt template |
| `.claude/commands/nitro-auto-pilot.md` | +18 lines — usage examples, parameters table, argument parsing |

## Review Scores

| Review | Score | Verdict |
|--------|-------|---------|
| Code Style | —/10 | REVISE |
| Code Logic | 5/10 | REVISE |
| Security | 6/10 | REVISE |

## Findings Summary

### CRITICAL (2 findings)

1. **No runtime guard for `--role reviewer|both` without `--compare`** (Logic, CRITICAL)
   - Location: `SKILL.md` — Step E1
   - `--role reviewer|both` requires `--compare` but SKILL.md has no FATAL/EXIT enforcement in the evaluation flow. The command file mentions it as documentation only. When reached, E5d dereferences `EVAL_WORKTREE_B` and `baseline_model_id` which are never set, causing undefined execution.
   - Fix: Add explicit validation at end of E1: if `eval_role` is `reviewer` or `both` and `ab_mode = false`, emit FATAL and EXIT.

2. **`baseline_model_id` not validated — path traversal in worktree construction** (Security + Logic, CRITICAL)
   - Location: `SKILL.md` — Step E1/E4
   - Step E1 applies a thorough 4-step validation chain to `eval_model_id` (sanitize, path-traversal check, allowlist prefix). `baseline_model_id` (from `--compare`) receives zero validation and flows directly into `git worktree add .claude/worktrees/eval-{baseline_model_id}`. A crafted value like `../../tmp/evil` produces a worktree path outside `.claude/worktrees/`.
   - Fix: Apply identical E1 validation chain to `baseline_model_id`. Add identity check: if `baseline_model_id == eval_model_id`, FATAL EXIT.

### SERIOUS (4 findings)

3. **`--reviewer` silently ignored when combined with `--role reviewer`** (Logic, SERIOUS)
   - Location: `SKILL.md` — Step E5d Phase 2
   - E5d Phase 2 hardcodes `eval_model_id` as the reviewer. When `--reviewer <model>` is also provided, the override is silently ignored. AC3 ("--reviewer overrides the reviewer model") is violated for this combination.
   - Fix: E5d Phase 2 should use `reviewer_model_id if reviewer_model_id != null else eval_model_id`.

4. **`--reviewer <model-id>` not validated before MCP spawn** (Security, SERIOUS)
   - Location: `SKILL.md` — Steps E5d, E5f
   - `reviewer_model_id` passes directly to MCP `spawn_worker` as the `model` parameter with no emptiness, sanitization, or allowlist check — bypassing the guards enforced for `--evaluate`.
   - Fix: Apply E1-style validation to `reviewer_model_id` during argument parsing.

5. **Same model IDs (`--evaluate X --compare X`) cause worktree path collision** (Logic, SERIOUS)
   - Location: `SKILL.md` — Step E4
   - Both worktrees resolve to `.claude/worktrees/eval-{model_id}`. The second `git worktree add` fails; the retry/cleanup loop may leave `.claude/worktrees/` in an inconsistent state.
   - Fix: Add identity check in E1: if `baseline_model_id == eval_model_id`, FATAL EXIT.

6. **E5e lacks explicit MODEL_DIR re-assignment between builder-pass and reviewer-pass** (Logic, SERIOUS)
   - Location: `SKILL.md` — Step E5e
   - E6's result-file handler uses `MODEL_DIR` set at E3. E5e says "each pass uses its own directories" but never issues an explicit re-assignment instruction. Reviewer-pass results may land in the builder-pass directory.
   - Fix: Add explicit MODEL_DIR variable re-assignment at the start of Pass 2 in E5e.

### MODERATE (5 findings)

7. **Step E1 missing variable initialization block for A/B mode variables** (Style, MODERATE)
   - Location: `SKILL.md` — Step E1
   - `ab_mode`, `eval_role`, `baseline_model_id`, `reviewer_model_id` are used throughout E3–E7 but are never explicitly initialized/defaulted in E1. E1 sets `eval_model_id` only.
   - Fix: Add an explicit variable initialization section at the end of E1 with defaults.

8. **`{build_model_id}` unresolvable substitution variable in Review Worker prompt template** (Style, MODERATE)
   - Location: `SKILL.md` — Evaluation Review Worker prompt template (~line 2263)
   - Template references `{build_model_id}` which is never defined in the evaluation flow. Should be `{baseline_model_id}`.
   - Fix: Replace `{build_model_id}` with `{baseline_model_id}` in the template.

9. **"Builder mode" description promises reviewer phase that E5c never implements** (Logic, MODERATE)
   - Location: `SKILL.md` Modes table (line ~172); `task.md` description
   - Modes table says "builder (default): model under test as Build Worker, baseline as Reviewer" but E5c only spawns two build workers — no review phase exists in A/B builder mode.
   - Fix: Update mode description to accurately describe what E5c does, or add the review phase.

10. **Concurrent evaluation runs have no directory collision guard** (Logic, MODERATE)
    - Location: `SKILL.md` — Step E3
    - Two evaluations on the same day with the same model write to the same `EVAL_DIR`. No existence check before writing `session.md`. Results silently corrupt each other.
    - Fix: Check if `EVAL_DIR` exists and is non-empty at E3. FATAL EXIT on collision.

11. **git error output not capped before FATAL log** (Security, MINOR)
    - Location: `SKILL.md` — Step E4 (line ~389)
    - `"FATAL: Cannot create evaluation worktree — {git_error_output}"` embeds raw git error output without a 200-character cap, violating the established security rule in `review-lessons/security.md`.

### MINOR (3 findings)

12. **E6 step list starts at 0** (Style, MINOR)
    - Location: `SKILL.md` — Step E6 (line ~505)
    - Step E6's numbered list starts at `0.` while all other step lists in the file start at `1.`. Inconsistent.

13. **Stray `4. **EXIT.**` at end of E7 with no 1/2/3 siblings** (Style, MINOR)
    - Location: `SKILL.md` — line ~669
    - A lone `4. **EXIT.**` appears at the end of Step E7c with no corresponding steps 1–3.

14. **`--compare` parameter description overstates parallelism** (Style, MINOR)
    - Location: `nitro-auto-pilot.md` — line 38
    - `--compare` description says "runs same benchmarks on both models in parallel worktrees" — this is only true for builder mode (E5c). Reviewer mode (E5d) and "both" mode (E5e) are sequential/phased. Description should be mode-qualified.

## Requirements Fulfillment

| Acceptance Criterion | Status |
|---------------------|--------|
| `--compare <baseline>` runs same tasks on both models in parallel worktrees | PARTIAL — worktree path collision if same model ID; baseline model ID unvalidated |
| `--role builder\|reviewer\|both` controls which role model is tested in | PARTIAL — no runtime guard for `reviewer\|both` requiring `--compare`; builder mode description overpromises |
| `--reviewer <model>` overrides the reviewer model | PARTIAL — silently ignored when combined with `--role reviewer` |
| A/B results stored separately with clear model labeling | PARTIAL — concurrent runs on same date can corrupt results |
| Role "both" produces separate builder and reviewer scores | PARTIAL — MODEL_DIR re-assignment between passes is implicit, not explicit |

## Fix Worker Scope

All 14 findings are in specification files only:
- `SKILL.md` (Evaluation Mode section, lines 228–2300)
- `nitro-auto-pilot.md` (lines 38–76)

No executable code changes required. Estimated fix complexity: Medium (findings 1–6 require careful spec additions; 7–14 are textual corrections).
