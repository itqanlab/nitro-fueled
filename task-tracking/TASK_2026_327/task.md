# Task: Compress orchestration SKILL.md to 500-token quick-reference header


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

The orchestration SKILL.md exceeds 10,000 tokens. Workers load it fully at spawn time, consuming a large portion of the context window before any work begins. This is the second-largest token waste pattern identified in the session evaluation research.

## What to do
1. Add a 500-token quick-reference header section at the top of SKILL.md covering: phase sequence, key MCP tools per phase, critical rules (top 5), and a pointer to the full spec below
2. Workers read the header first; only expand to full spec if the phase requires it
3. Update worker spawn prompt to reference 'read the quick-reference header first'
4. Keep full spec intact below the header — do not delete content

## Acceptance Criteria
- Quick-reference header added (≤500 tokens)
- Header covers phase sequence, key MCP tools, top 5 critical rules
- Worker spawn prompt updated to read header first
- Full spec preserved below header

## Dependencies

- TASK_2026_326

## Acceptance Criteria

- [ ] Quick-reference header added at top of SKILL.md (≤500 tokens)
- [ ] Header covers phase sequence, MCP tools, critical rules
- [ ] Worker spawn prompt updated to read header first
- [ ] Full spec preserved below header

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/orchestration/SKILL.md


## Parallelism

Independent. Can run in parallel with all other tasks.
