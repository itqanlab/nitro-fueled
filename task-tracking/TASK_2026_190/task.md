# Task: GLM-4.7 Review Worker Investigation — 0% Success Rate

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | RESEARCH    |
| Priority              | P2-Medium   |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | skip        |

## Description

RETRO_2026-03-30_2 found that glm-4.7 (zai provider) has a 0% success rate when used as a review worker. Session SESSION_2026-03-30_05-41-42 noted this explicitly. Meanwhile glm-5 has 70% success (6 killed / 20 workers) and claude has 100%.

Investigate root cause:
1. What error patterns do glm-4.7 workers exhibit? (stuck, early exit, edit loop, tool failure?)
2. Is it a model capability issue (can't follow review prompts) or a provider/launcher issue?
3. Should glm-4.7 be removed from review worker routing entirely?
4. Compare with the 3 known GLM failure patterns documented in memory (stuck/bash, early exit, edit loop)

## Dependencies

- None

## Acceptance Criteria

- [ ] Root cause identified with evidence from session logs
- [ ] Recommendation: keep, restrict, or remove glm-4.7 from review routing
- [ ] If actionable, propose a fix or routing change

## Parallelism

✅ Can run in parallel — research task, no file modifications expected.

## References

- RETRO_2026-03-30_2 — worker health section
- Memory: `project_glm_reliability.md` — known GLM failure patterns
- Session: SESSION_2026-03-30_05-41-42

## File Scope

- None (research only)
