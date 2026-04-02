# Task Description — TASK_2026_184

## Goal

Deliver a global interactive command console in the dashboard that lets users run Nitro slash commands, inspect rich output, and trigger common orchestration actions without leaving the browser UI.

## Problem Statement

The dashboard already exposes many operational views, but the primary control surface is still the terminal. Users must leave the dashboard to run slash commands, inspect command output, and chain common actions like status checks, task creation, or auto-pilot control. That split makes the product feel incomplete and forces context switching between the browser and CLI.

## Functional Requirements

1. Provide a command input that supports autocomplete for the available Nitro commands, including command descriptions and argument hints.
2. Provide rich output rendering for command results, including markdown, code blocks, collapsible sections, and visually distinct log levels or statuses.
3. Provide route-aware command suggestions so the console proposes relevant commands for the current dashboard context, such as task-specific actions on the task detail page.
4. Persist command history across page navigations and browser reloads, with keyboard navigation for recent commands and a way to search or filter prior entries.
5. Provide quick actions for the most common operations, including starting auto-pilot, creating a task, checking status, and viewing cost-related information.
6. Make the console globally accessible from the dashboard shell as a slide-out panel that works on both desktop and mobile layouts.

## Integration Constraints

- Reuse the existing Angular standalone shell and route structure instead of introducing a second app shell.
- Reuse existing dashboard API services where endpoints already exist for task creation, session control, status data, analytics, and logs.
- Keep command execution behind a controlled backend adapter layer; do not expose arbitrary shell execution directly from the browser.
- Reuse the existing markdown sanitization approach already used by the dashboard session viewer and editor surfaces.

## Acceptance Criteria

- [ ] A command console can be opened from any dashboard page through a global slide-out panel.
- [ ] The input provides autocomplete for Nitro commands and helps the user choose the right action.
- [ ] Command output renders as structured rich content rather than plain raw text.
- [ ] Command history persists and supports quick keyboard recall.
- [ ] Quick actions execute the expected common operations from inside the console.
- [ ] Suggestions adapt to the current route or selected task/session context.
- [ ] The console remains usable on desktop and mobile dashboard layouts.

## Non-Goals

- No general-purpose arbitrary terminal emulator with unrestricted shell access.
- No attempt to replace every possible local developer command outside the Nitro command surface.
- No separate dashboard page for the console; this feature should live as a global shell capability.
