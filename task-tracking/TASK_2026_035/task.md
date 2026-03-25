# Task: Review Lead — Parallel Reviews with Model Routing

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P1-High     |
| Complexity | Complex     |

## Description

Replace the current single Review Worker (one session running all reviews sequentially) with a **Review Lead** pattern: the Supervisor spawns a Review Lead session, which then spawns parallel sub-workers for each review type with appropriate model selection.

### Current flow
```
Supervisor → Review Worker (runs style + logic + security reviews sequentially in 1 session, 1 model)
```

### Proposed flow
```
Supervisor → Review Lead (Sonnet, lightweight orchestrator)
               ├→ Style Reviewer (Sonnet) ──┐
               ├→ Logic Reviewer (Opus)     ├── parallel
               └→ Security Reviewer (Sonnet) ┘
               │
               ← Collect results, run fix phase, complete task
```

### How the Review Lead works

**1. Startup**
- Review Lead is spawned by the Supervisor (same as current Review Worker)
- It reads the task folder to check for existing review artifacts (continuation support)
- It generates a `review-context.md` containing:
  - Project conventions from `plan.md` decisions log
  - Tech stack info from CLAUDE.md
  - Files changed in this task (from git diff against pre-task state)
  - Any style decisions from the anti-patterns file
  - Scope boundaries: which files belong to this task

**2. Spawn reviewers**
- Uses MCP `spawn_worker` to create parallel review sub-workers
- Each reviewer gets a focused prompt: review type + task folder path + review-context.md path
- Model selection per reviewer:
  - Style Reviewer: Sonnet (pattern matching, conventions — doesn't need deep reasoning)
  - Logic Reviewer: Opus (needs deep reasoning about correctness, edge cases)
  - Security Reviewer: Sonnet (checklist-driven, OWASP patterns)
- Monitors sub-workers via MCP `get_worker_activity`
- Waits for all to complete (writes their review report to task folder)

**3. Fix phase**
- Review Lead reads all review reports
- Prioritizes findings: critical/blocking first, then serious, then minor
- Applies fixes directly (Review Lead should use Opus for this phase)
- Or spawns a Fix Worker if fixes are complex
- Commits fixes

**4. Completion**
- Writes `completion-report.md`
- Updates registry to COMPLETE
- Appends lessons to `.claude/review-lessons/`
- Exits

### Model routing decision

The Review Lead decides models based on task type and complexity:

| Review Type | Default Model | Rationale |
|-------------|---------------|-----------|
| Code Style | Sonnet | Template-driven, pattern matching |
| Code Logic | Opus | Deep reasoning, edge case analysis |
| Security | Sonnet | Checklist-driven, OWASP patterns |
| Fix phase | Opus | Needs to write correct code |

Future: these defaults could be overridable in task.md or a project config.

### Benefits over current approach

1. **Parallel execution**: 3 reviews run simultaneously (~3x faster)
2. **Cost savings**: 2 of 3 reviewers use Sonnet instead of Opus (~40% review cost reduction)
3. **Shared review context**: `review-context.md` solves BUG-3 (cross-task fixes) and BUG-4 (contradictory decisions)
4. **Focused context per reviewer**: Each reviewer loads only what it needs, not the full orchestration history
5. **Independent failure**: If style reviewer fails, logic and security results are preserved
6. **Foundation for Build Lead**: Proves the Lead→sub-worker pattern for future use

### Technical requirements

- Review Lead needs MCP access to session-orchestrator (`.mcp.json` in project root provides this)
- Sub-workers run with `--print` mode, same as current workers
- Review Lead monitors sub-workers via MCP polling (same pattern as Supervisor)
- Sub-worker prompts must be self-contained: everything the reviewer needs is in files, not conversation context

### Changes required

**Auto-pilot skill** (`.claude/skills/auto-pilot/SKILL.md`):
1. When spawning a Review Worker, spawn a Review Lead instead
2. Review Lead prompt includes instructions to use MCP for sub-worker spawning
3. Review Lead prompt includes the model routing table
4. Supervisor monitors the Review Lead (not the sub-workers — Lead handles its own sub-workers)

**New agent**: `.claude/agents/review-lead.md`
5. Review Lead agent definition with orchestration instructions
6. Includes review-context.md generation template
7. Includes sub-worker prompt templates for each review type

**Orchestration skill** (`.claude/skills/orchestration/SKILL.md`):
8. Review phase documentation updated to reflect Lead pattern
9. Review sub-worker prompts defined (style, logic, security)

**Existing review agents** (code-style-reviewer.md, code-logic-reviewer.md):
10. Ensure they work standalone (read task folder + review-context.md, write report, exit)
11. They should already be standalone — verify and adjust if needed

## Dependencies

- TASK_2026_020 — Per-Task Model Selection (provides model field plumbing in spawn_worker)
- TASK_2026_027 — Shared Review Context (review-context.md concept — can be built into this task if 027 isn't done yet)

## Acceptance Criteria

- [ ] Supervisor spawns Review Lead instead of monolithic Review Worker
- [ ] Review Lead generates `review-context.md` before spawning reviewers
- [ ] Review Lead spawns 3 parallel review sub-workers via MCP
- [ ] Style and Security reviewers use Sonnet, Logic reviewer uses Opus
- [ ] All 3 reviews run in parallel and produce independent report files
- [ ] Review Lead collects results and runs fix phase after all reviews complete
- [ ] Review Lead handles sub-worker failures (retry or document failure)
- [ ] Completion report, registry update, and lessons captured by Review Lead
- [ ] Total review phase wall time reduced compared to sequential (target: ~40% faster)
- [ ] Total review phase cost reduced compared to all-Opus (target: ~30-40% cheaper)
- [ ] Sub-workers respect task file scope (no cross-task fixes)

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` — BUG-3, BUG-4 (motivating issues)
- `.claude/skills/auto-pilot/SKILL.md` — current review worker spawning
- `.claude/skills/orchestration/SKILL.md` — current review phase flow
- `.claude/agents/code-style-reviewer.md` — existing style review agent
- `.claude/agents/code-logic-reviewer.md` — existing logic review agent
- `TASK_2026_020` — Per-Task Model Selection (model routing infrastructure)
- `TASK_2026_027` — Shared Review Context (review-context.md)
