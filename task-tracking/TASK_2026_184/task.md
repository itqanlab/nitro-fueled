# Task: Interactive Command Console — Embedded Terminal & Chat in Dashboard

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Build a rich interactive command console embedded in the dashboard that fully replaces the need to use a terminal. This is the "chat box" where users interact with the system.

Features:
1. **Command Input** — Rich text input with autocomplete for available commands (/nitro-orchestrate, /nitro-auto-pilot, /nitro-status, /nitro-burn, /nitro-create-task, etc.)
2. **Output Rendering** — Formatted output display with markdown rendering, syntax highlighting, collapsible sections, and color-coded log levels
3. **Context-Aware Suggestions** — Based on current page/view, suggest relevant commands (e.g., on task detail page, suggest "orchestrate this task")
4. **Command History** — Persistent command history with up/down arrow navigation and search
5. **Quick Actions** — Pre-built action buttons for common operations: "Run Auto-Pilot", "Create Task", "Check Status", "View Costs"
6. **Slide-Out Panel** — Console available as a slide-out panel from any page (bottom or right side), always accessible

This console bridges the gap between the visual dashboard and the power of CLI commands, giving users full control without leaving the browser.

## Dependencies

- None

## Acceptance Criteria

- [ ] Command input with autocomplete for all nitro commands
- [ ] Output renders with markdown formatting and syntax highlighting
- [ ] Command history persists across page navigations
- [ ] Quick action buttons execute common operations
- [ ] Console accessible as slide-out panel from any dashboard page

## Parallelism

✅ Can run in parallel — new console component, no overlap with other CREATED tasks.

## References

- Live Session Chat: TASK_2026_157 (IN_PROGRESS)
- Dashboard API: `apps/dashboard-api/`
- CLI commands: `.claude/commands/`

## File Scope

- apps/dashboard/src/app/components/command-console/ (new component directory)
- apps/dashboard-api/src/dashboard/ (command execution endpoint)
