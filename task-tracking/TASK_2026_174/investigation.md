# Investigation Report — TASK_2026_174

## Executive Summary

GLM-5 is not failing in a single way. The evidence shows three recurring reliability patterns plus one outlier:

1. spawn-time or immediate zero-activity failures before useful work begins,
2. stuck workers that never progress past search/build activity and get killed by health checks,
3. long-running edit/search loops with no status transition,
4. one review-worker outlier caused by slash-command/tooling mismatch rather than the build-worker failure pattern.

The strongest operational conclusion is that `Simple complexity only` is not the right routing fix. A simple task (`TASK_2026_117`) still hit the stuck pattern, while failures spanned `FEATURE`, `BUGFIX`, `REFACTORING`, and `DEVOPS`. The better mitigation is faster GLM-5-specific health checks, a circuit breaker for no-progress loops, and routing restrictions for high-risk task classes such as `DEVOPS`, `P0-Critical`, and review/test work.

## Evidence Base

- `RETRO_2026-03-30.md` states `glm/glm-5: 70% success (6 killed/20)` and attributes `8 of 9` fallback events to GLM-5 getting stuck or producing zero activity.
- `SESSION_2026-03-30_03-40-31/log.md` repeats the provider stat and flags GLM-5 as `HIGH KILL RATE`.
- `SESSION_2026-03-28_11-13-12/log.md` captures the clearest stuck, planning-stop, and edit-loop events.
- `SESSION_2026-03-28_13-58-21/analytics.md` summarizes a cluster of GLM failures as `2 stuck in Glob loop, 1 zero-token exit`.
- `SESSION_2026-03-28_03-27-33/log.md` shows four early `SPAWN FALLBACK` events where GLM-5 failed before a retry was even counted.

## Failure Taxonomy

### 1. Spawn-time or zero-activity failure: 4 confirmed GLM-5 fallbacks

Tasks: `072`, `074`, `076`, `086`

Evidence:

- `SESSION_2026-03-28_03-27-33/log.md` records `SPAWN FALLBACK — TASK_2026_072/074/076/086: glm failed, retrying with claude/sonnet`.
- The same session's analytics show `Tasks Requiring Retries | 0`, which means these were not healthy workers that later regressed. They failed before the supervisor considered them a normal retry path.
- There are no corresponding GLM-5 worker logs for these tasks, which strongly suggests the workers produced no usable activity before fallback.

Interpretation:

- This is the strongest evidence for a `launch/no-first-action` failure mode.
- A shorter health check alone will help only partially; the supervisor also needs a first-activity deadline.

### 2. Stuck health-check kills: 2 direct fallbacks plus 3 additional related kills

Direct fallback cases: `091`, `113`
Related kill cases in the same pattern family: `088`, `092`, `117`

Evidence:

- `SESSION_2026-03-28_11-13-12/log.md` records:
  - `TASK_2026_091: glm stuck x2, retrying with claude/sonnet`
  - `TASK_2026_113: glm stuck x2, retrying with claude/sonnet`
- `TASK_2026_091-REFACTORING-BUILD.md` shows `Outcome | KILLED (stuck x2)` with `Total Tokens | 0` and last activity `Bash(npm run build:cli)`.
- `TASK_2026_088-FEATURE-BUILD.md` shows the same `KILLED (stuck x2)` outcome with `Total Tokens | 0` and last activity `Read(dashboard.controller.ts)`.
- `SESSION_2026-03-28_13-58-21/analytics.md` summarizes this cluster as `2 stuck in Glob loop, 1 zero-token exit`.

Interpretation:

- GLM-5 can enter a no-output state both during read/search work and during build-command execution.
- With the observed 5-minute strike cadence, these workers consumed roughly 13 to 17 minutes before being killed. That is too slow for a known high-risk model.

### 3. Planning-phase stop: 1 confirmed fallback

Task: `109`

Evidence:

- `SESSION_2026-03-28_11-13-12/log.md` records `TASK_2026_109: glm stopped at planning phase, retrying with claude/opus`.

Interpretation:

- This is distinct from the stuck build/search cases: the worker reached the planning step but failed to continue into implementation.
- That points to prompt-following or orchestration-phase transition weakness, not just tool execution weakness.

### 4. Edit loop / no-transition runaway: 1 confirmed fallback

Task: `099`

Evidence:

- `SESSION_2026-03-28_11-13-12/log.md` records `KILLING — TASK_2026_099: 81m/479 tools with no status transition, likely edit loop` followed by `SPAWN FALLBACK — TASK_2026_099: glm loop 81m/479tools, retrying with claude/sonnet`.
- `TASK_2026_099-FEATURE-CLEANUP.md` salvaged partial changes from the dead worker and explicitly labels it as an `81m loop`.

Interpretation:

- This is the most expensive failure mode. The current stuck detector is too status-centric and does not stop high-tool-count workers that remain busy but make no real state progress.

### 5. Outlier: review-worker zero-message exit caused by tooling mismatch, not core build reliability

Task: `120`

Evidence:

- `SESSION_2026-03-28_16-39-39/log.md` records `SPAWN FALLBACK — TASK_2026_120: glm failed (0 msgs)`.
- Two lines later the same session logs `ReviewLead+TestLead exited 0 msgs (slash cmd not found), respawning with inline prompts`.

Interpretation:

- This event belongs in the reliability dataset because it consumed fallback budget.
- It should not be used as evidence that GLM-5 build workers alone are the problem; this looks like prompt/tooling incompatibility on review/test workers.

## Failure Counts

| Mode | Count | Included Tasks |
|------|-------|----------------|
| Spawn-time / zero-activity fallback | 4 | 072, 074, 076, 086 |
| Stuck x2 health-check kill | 2 direct fallbacks | 091, 113 |
| Additional same-family kill evidence | 3 | 088, 092, 117 |
| Planning-phase stop | 1 | 109 |
| Edit loop / no-transition runaway | 1 | 099 |
| Tooling outlier: 0-msg review/test failure | 1 | 120 |

This matches the retrospective framing: `9` total fallback events, `8` attributable to GLM-5 reliability patterns, `1` outlier caused by a slash-command/tooling mismatch.

## Correlation Analysis

### By task type

Observed failure tasks span multiple types:

- `FEATURE`: 088, 092, 099, 109, 120
- `BUGFIX`: 113
- `REFACTORING`: 091, 117
- `DEVOPS`: 072, 076, 086

Conclusion:

- There is no evidence that one task type fully explains the failures.
- `DEVOPS` is notable because three medium DEVOPS tasks hit immediate spawn-time fallback in one session, so it is a good candidate for temporary routing restriction.

### By complexity

Observed failure tasks by complexity:

- `Medium`: 072, 074, 076, 086, 088, 091, 092, 099, 109, 113
- `Simple`: 117
- `Complex`: 120

Conclusion:

- Failures were not limited to complex work. Most occurred on medium tasks, and one simple task still failed.
- Restricting GLM-5 to `Simple only` is not supported by the evidence. It would still leave at least one known failure case in scope while excluding many successful medium tasks.

## Answers to Research Questions

### 1. What are the specific failure modes?

- Immediate no-activity or spawn-time failure before useful work begins.
- Stuck workers that never move past search/build activity and die on health checks.
- Planning-phase stalls.
- Long edit/search loops with no state transition.
- One review/test 0-message outlier caused by slash-command/tooling mismatch.

### 2. Is there a correlation between task complexity/type and GLM-5 failures?

- Weak correlation at best.
- Failures span `FEATURE`, `BUGFIX`, `REFACTORING`, and `DEVOPS`.
- Most failures were `Medium`, but one `Simple` task failed too, so `Simple-only` is not a reliable fix.
- The clearest routing signal is operational, not semantic: `DEVOPS`, `P0-Critical`, and review/test work are poor places to spend GLM-5 reliability budget.

### 3. Should the health check interval be shorter for GLM-5 workers?

Yes.

Recommended change:

- Reduce GLM-5 `no-activity` health checks from roughly 5 minutes to 2 minutes.
- Keep the two-strike rule, which turns detection into a ~4 minute response instead of ~10+ minutes.
- Add a first-action deadline: if the worker does not produce its first artifact/log/status transition within 90 seconds, fail fast.
- Add a no-transition circuit breaker: kill after 20 minutes or 150 tool calls without a status transition.

Why:

- Stuck-x2 cases wasted 13 to 17 minutes before recovery.
- The edit-loop case wasted 81 minutes because the current detector watches liveness more than progress.

### 4. Should GLM-5 be restricted to certain task types or only Simple complexity?

Do not use `Simple only` as the primary restriction.

Recommended routing policy:

- Keep GLM-5 off `DEVOPS` and `P0-Critical` work for now.
- Keep GLM-5 off review/test workers until the `TASK_2026_120` 0-message path is fully resolved.
- Allow GLM-5 only for non-critical build work where fast fallback is acceptable.

Why:

- The evidence shows failures across multiple task types and includes a simple task.
- The biggest operational risk is not task semantics alone; it is how expensive the fallback delay becomes when the task is critical or review-gated.

### 5. What prompt adjustments could improve reliability?

Recommended prompt changes:

- Require an explicit first action in the first minute: write the task status, read the task file, and emit a short progress artifact.
- Instruct the worker to create `task-description.md` or `tasks.md` before broad exploration, so the supervisor can distinguish a live worker from a silent one.
- Add a hard rule against repeated search loops without producing a file edit or synthesized finding.
- Tell the worker to abandon the run with a structured failure artifact when slash commands or required tools are unavailable, instead of silently exiting with `0 msgs`.
- Prefer smaller, phase-bounded goals in the prompt: context first, then write one artifact, then continue.

## Recommendations

1. Shorten GLM-5 health checks to 2 minutes with a 90-second first-activity deadline.
2. Add a no-transition circuit breaker using elapsed time and tool-call count.
3. Remove GLM-5 from `DEVOPS`, `P0-Critical`, and review/test routing until the failure rate materially improves.
4. Keep fallback to Claude enabled; it is the one mitigation already proven by session evidence.
5. Tighten build-worker prompts so they must produce an early artifact before broad search/build work.

## Follow-On Implementation Needed

Yes. The recommendations require follow-on work in routing configuration, health-check logic, and worker prompts. See `follow-on-tasks.md`.
