# Task: Validate Provider Availability Before Session Config Assignment

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P2-Medium   |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | optional    |

## Description

The supervisor creates a session with `review_provider: "openai-opencode"` and `review_model: "openai/gpt-5.4"` but `get_available_providers` only returned `anthropic` and `zai` as AVAILABLE. If the review provider isn't available, all review workers will fail.

Fix:
1. After calling `get_available_providers`, validate that the build and review providers specified by the user are actually in the AVAILABLE list
2. If a specified provider is not available, log a warning and fall back to the next available provider
3. If no suitable provider is available for a role, block session creation with a clear error

## Dependencies

- None

## Acceptance Criteria

- [ ] Supervisor validates provider availability before creating session config
- [ ] Unavailable provider triggers a warning and fallback to next available
- [ ] Session creation blocked with clear error if no provider available for a role
- [ ] Fallback logic documented in auto-pilot help

## Parallelism

✅ Can run in parallel — supervisor pre-flight validation only.

## References

- Auto-pilot trace: openai-opencode not in available providers but assigned to review
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Provider resolution: `packages/mcp-cortex/src/tools/`

## File Scope

- .claude/skills/auto-pilot/SKILL.md (provider validation step)
