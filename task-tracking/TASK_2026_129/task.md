# Task: Add SESSION_ID Validation to nitro-auto-pilot --continue Flag

## Metadata

| Field                 | Value         |
|-----------------------|---------------|
| Type                  | REFACTORING   |
| Priority              | P2-Medium     |
| Complexity            | Simple        |
| Preferred Tier        | light         |
| Model                 | default       |
| Testing               | skip          |

## Description

The `--continue [SESSION_ID]` flag in `/nitro-auto-pilot` accepts a user-provided `SESSION_ID` string that is subsequently used to construct a directory path (`task-tracking/sessions/{SESSION_ID}/`). No format validation is applied to the token before it is used in the path construction step.

A developer invoking `/nitro-auto-pilot --continue ../../../etc/passwd` (or similar path traversal string) would cause the LLM to attempt reading files outside the `task-tracking/sessions/` directory, violating the intended security boundary.

Add a validation rule to the `--continue` parsing block in `nitro-auto-pilot.md` that checks the SESSION_ID token against the regex `^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$`. If the format does not match, reject with a clear error message and stop execution. Do not silently strip invalid characters.

## Dependencies

- None

## Acceptance Criteria

- [ ] The `--continue` parsing step in `nitro-auto-pilot.md` includes an explicit SESSION_ID format validation rule
- [ ] The validation uses the regex `^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$`
- [ ] A clear error message is shown when the format does not match, and execution halts
- [ ] Invalid characters are NOT silently stripped

## References

- `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md` — target file (Step 2: Parse Arguments, `--continue` branch)
- Security review finding from TASK_2026_117 — MEDIUM: Unvalidated SESSION_ID token in `--continue` path construction

## File Scope

- `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md`

## Parallelism

✅ Can run in parallel — no file scope conflicts with any currently CREATED task.
