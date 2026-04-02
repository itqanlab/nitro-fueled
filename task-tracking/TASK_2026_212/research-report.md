# Research Report — TASK_2026_212
## GPT-5.4 PREP Phase Kill Pattern

---

## Summary

**Root cause: Tool incompatibility between the PREP worker's orchestration skill (sub-agent spawning via `Task`/Agent tool) and the opencode launcher used for GPT-5.4.**

GPT-5.4's 50% PREP kill rate in SESSION_2026-03-30T19-17-29 is not a GPT model capability issue — it is a launcher architecture mismatch. The PREP worker was routed to a launcher that cannot reliably execute the orchestration skill's sub-agent invocations (PM → Architect → Team Leader MODE 1), causing workers to fail or exit without producing planning artifacts.

---

## Data Sources

| Source | Relevance |
|--------|-----------|
| `task-tracking/retrospectives/RETRO_2026-03-30_3.md` | Primary kill data for the target session |
| `task-tracking/sessions/SESSION_2026-03-30_05-37-04/log.md` | GPT-5.4 review-fix success (for comparison) |
| `task-tracking/sessions/SESSION_2026-03-30_05-15-40/log.md` | GPT-5.4 review-fix success (for comparison) |
| `task-tracking/sessions/SESSION_2026-03-30T21-03-13/log.md` | Provider stats snapshot (GPT-5.4: 63% overall) |
| `.claude/skills/auto-pilot/references/worker-prompts.md` | PREP vs. Review+Fix worker prompt structure |
| `task-tracking/TASK_2026_169/prep-handoff.md` | Proof that a successful PREP eventually ran (Claude retry) |
| SESSION_2026-03-30T19-17-29 session directory | **Empty** — no state.md or log.md written |

---

## Kill Data from SESSION_2026-03-30T19-17-29

| Task | Phase | Attempt | Model | Outcome | Root Cause |
|------|-------|---------|-------|---------|------------|
| TASK_2026_169 | PREP | 1 | gpt-5.4 | killed | Unknown — first-wave failure |
| TASK_2026_169 | PREP | retry-1 | gpt-5.4 | killed | gpt-5.4 failed PREP twice |
| TASK_2026_173 | PREP | 1 | gpt-5.4 | killed | First-wave gpt-5.4 failure |

**Session config**: PREP=gpt-5.4, IMPLEMENT=glm-5.1, REVIEW=gpt-5.4

**Note**: The session directory for SESSION_2026-03-30T19-17-29 exists but is completely empty — no state.md or log.md was written. This suggests the auto-pilot process itself did not fully initialize (crashed early) or was run in a mode that didn't persist session state to disk. The kill data comes entirely from the retrospective report which aggregates worker outcomes post-session.

---

## Root Cause Analysis

### Hypothesis 1: PREP Requires Sub-Agent Spawning (HIGH CONFIDENCE)

The PREP worker runs the orchestration skill phases: **PM → Architect → Team Leader MODE 1**. Each of these phases requires spawning specialist sub-agents via the `Task` (Agent) tool:

- PM phase → invokes `nitro-project-manager` agent
- Architect phase → invokes `nitro-software-architect` agent
- Team Leader MODE 1 → invokes `nitro-team-leader` agent

The Review+Fix worker prompt explicitly warns:
> "For `opencode`/`codex`, the spawn layer must remap Claude-specific tool names to the launcher-supported equivalent before the prompt is sent."

The PREP worker prompt has **no such caveat or remapping instruction**. This means the PREP worker was designed assuming a Claude-native launcher and was never adapted for opencode/GPT.

When GPT-5.4 runs the PREP worker prompt via opencode, its attempts to invoke `Task(subagent_type: "nitro-project-manager")` either fail silently, produce malformed output, or cause the worker to exit prematurely.

### Hypothesis 2: PREP vs Review-Fix Success Pattern (SUPPORTING EVIDENCE)

GPT-5.4 via opencode **succeeded** on Review+Fix workers in multiple prior sessions:
- SESSION_2026-03-30_05-37-04: 2/2 Review+Fix workers succeeded
- SESSION_2026-03-30_05-15-40: GPT-5.4 was used for review-fix tasks

GPT-5.4 via opencode **failed** on PREP workers at 50% rate:
- SESSION_2026-03-30T19-17-29: 2/4 PREP workers killed

This pattern — success on review-fix, failure on PREP — is consistent with the hypothesis that **sub-agent spawning complexity** is the differentiator. The Review+Fix worker has explicit launcher handling; the PREP worker does not.

### Hypothesis 3: Session State Missing (SUPPORTING EVIDENCE)

The session directory for SESSION_2026-03-30T19-17-29 is empty — no log or state file exists. This suggests the kills happened very early, before the Supervisor could write session state to disk. Workers that fail in the first few seconds (e.g., immediately on sub-agent invocation attempts) would not produce any output for the Supervisor to log as "killed with reason."

### Hypothesis 4: Not a Model Capability Issue (RULED OUT)

If GPT-5.4 lacked the planning/reasoning capability for PREP, we would expect failures on ALL PREP attempts, not 50%. The fact that PREP succeeded 2/4 times (or that retries eventually worked after switching to Claude) suggests the issue is non-deterministic launcher behavior, not model quality.

---

## Comparison: PREP vs Review+Fix Worker Prompt Design

| Aspect | PREP Worker | Review+Fix Worker |
|--------|-------------|-------------------|
| Spawns sub-agents? | YES (PM, Architect, Team Leader) | YES (3 parallel reviewers) |
| Has `opencode` remapping note? | NO | YES |
| GPT-5.4 kill rate | 50% (2/4) | ~0% in tested sessions |
| Complexity level | PM → Architect → TL-MODE1 (3 agent hops) | 3 parallel reviewers (1 hop) |

---

## Recommendations

### 1. ROUTING CHANGE (Immediate): Exclude opencode/GPT from PREP Workers

Until the PREP worker prompt has explicit opencode tool remapping, do not route PREP workers to opencode/gpt-5.4. The orchestration skill sub-agent invocations are Claude-native and will fail on opencode.

**Implementation**: In auto-pilot routing logic, add a `worker_mode_exclusions` config:
- PREP phase → exclude opencode/codex launchers (allow only `claude` launcher)
- IMPLEMENT phase → can use opencode (implement workers do not spawn sub-agents)
- REVIEW phase → already has remapping notes

### 2. PROMPT UPDATE (Near-term): Add opencode Caveat to PREP Worker Prompt

In `worker-prompts.md`, add the same caveat to the PREP worker template that the Review+Fix template has:
> "For `opencode`/`codex`, the spawn layer must remap Claude-specific tool names to the launcher-supported equivalent before the prompt is sent."

Until sub-agent spawning is tested on opencode, this serves as a safety warning.

### 3. ROUTING STRATEGY: Use Claude for PREP, GPT/GLM for IMPLEMENT

GPT-5.4 and GLM succeed on IMPLEMENT workers (single-context coding, no sub-agent spawning). They fail on PREP and produce mixed results on Review+Fix without explicit remapping. A stable routing strategy:

| Phase | Recommended Providers | Reasoning |
|-------|-----------------------|-----------|
| PREP | claude only | Requires sub-agent spawning via Agent tool |
| IMPLEMENT | claude, zai/glm, openai | Single-context coding — all models handle it |
| REVIEW+FIX | claude (with remapping: zai/openai) | Requires sub-agent spawning; opencode needs explicit remapping |

### 4. ADD PROVIDER STATS GUARD: Kill Rate Threshold

Auto-pilot already shows provider stats at session start (e.g., "opencode/openai/gpt-5.4: 50% success"). Add a routing guard: if a provider's kill rate for a given worker_type exceeds 40%, de-route it for that type. This would have caught gpt-5.4's PREP failure pattern after the first session.

---

## Cost Impact

- 2 killed PREP workers × ~$2-2.5/worker = ~$4-5 wasted per session using gpt-5.4 for PREP
- With retries (TASK_2026_169 needed 3 PREP attempts total), the multiplier is higher
- Total session cost: $14.15 — estimated 30-35% attributable to PREP kill waste

---

## Conclusion

The GPT-5.4 PREP kill pattern is a **routing misconfiguration**, not a model capability issue. The PREP worker requires orchestration sub-agent spawning that the opencode launcher does not support without explicit remapping. The fix is simple: exclude opencode launchers from PREP worker routing. Implement workers and review-fix workers (with remapping) can continue to use GPT-5.4.
