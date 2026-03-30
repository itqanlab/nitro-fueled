# Task Description — TASK_2026_150

## Summary

Add the Launchers tab and the Subscriptions tab to the dashboard settings page using mock-only interactions.

## Functional Requirements

- Show launcher cards with type icon, path, status badge, and active toggle.
- Show mock launcher auto-detection results for Claude Code CLI, VS Code, Cursor, and Windsurf.
- Support manually adding a launcher with name, type, and path.
- Show subscription cards with provider icon, connection badge, active toggle, and available models.
- Support mock connect/disconnect flows for ChatGPT Plus, Claude Pro, Antigravity, and GitHub Copilot.

## Acceptance Criteria

- Launchers tab shows detected launchers with status badges.
- Manual launcher add form works.
- Each launcher has an active/inactive toggle.
- Subscriptions tab shows connected services with status badges.
- Mock Connect updates a subscription to connected and shows models.
- Each subscription has an active/inactive toggle.
