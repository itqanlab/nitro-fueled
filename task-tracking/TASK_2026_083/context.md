# Context — TASK_2026_083

## User Intent
Implement the New Task view at route `/new-task` matching the N.Gine mockup. This is a form-heavy page with 4 sections: Task Description, Strategy Selection, Workflow Preview, and Advanced Options.

## Strategy
FEATURE — Full pipeline with PM skipped (requirements already detailed in task.md with mockup reference).

## Flow
Architect -> Team-Leader -> Dev -> QA

## Key Decisions
- PM phase skipped: task.md already contains detailed acceptance criteria, file scope, and mockup reference
- Mockup at: /Volumes/SanDiskSSD/mine/software-house/mockups/new-task.html
- Follows existing patterns: standalone components, MockDataService, templateUrl + styleUrl
- Route already registered at `new-task` (currently PlaceholderViewComponent)
