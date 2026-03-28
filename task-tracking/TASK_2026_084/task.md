# Task: Project Onboarding view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Complex         |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the Project Onboarding view at route `/onboarding` matching the N.Gine mockup. Split layout: wizard panel (left ~60%) and AI chat panel (right ~40%). Left — 7-step wizard: step indicator bar showing completed steps (✓ checkmark, green), current step (number, blue), pending steps (number, grey). Step content: Step 1 — Select Client: client dropdown + info card (Acme Corp, 3 active projects, $2,400/$5,000 budget). Step 2 — Project Folder: path input with Browse button. Step 3 — External References: list of URL/file entries with Add button. Step 4 — AI Analysis (current): 4 recommendation cards with animated spinner for loading state (Stack Detection ✓, Team Composition ✓, Workflow Patterns spinner, Folder Organization pending-grey). Step 5 — Team Assembly: placeholder. Step 6 — Review & Folder Organization: side-by-side folder tree comparison (Before: mixed unorganized files, After: colored nodes indicating moved/new files). Step 7 — Summary: placeholder. Navigation: Back button (disabled on step 1), Save & Exit, Next button showing next step label. Step counter "Step 4 of 7" at bottom left. Right — AI chat panel: header with robot icon, "Chat with AI Analyst" title, green online dot; scrollable message thread with AI messages (purple avatar, rounded left-aligned bubbles with border) and user messages (blue avatar, right-aligned darker bubbles) and timestamps; sticky input area with placeholder text and Send button.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] Step indicator renders 7 steps with correct completed (green ✓) / active (blue number) / pending (grey) states
- [ ] Step 1 renders client selector with info card showing budget progress and project count
- [ ] Step 4 renders recommendation cards with CSS spinner animation on loading cards
- [ ] Step 6 renders before/after folder tree with color-coded nodes (moved = orange, new = green)
- [ ] Next/Back buttons advance/retreat through steps with correct disabled states
- [ ] Chat panel renders alternating AI (left) and user (right) message bubbles with correct avatar colors

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/project-onboarding.html

## File Scope

- apps/dashboard/src/app/views/onboarding/onboarding.component.ts
- apps/dashboard/src/app/views/onboarding/onboarding.component.html
- apps/dashboard/src/app/views/onboarding/onboarding.component.scss
- apps/dashboard/src/app/views/onboarding/wizard/wizard-step.component.ts
- apps/dashboard/src/app/views/onboarding/chat-panel/chat-panel.component.ts
- apps/dashboard/src/app/views/onboarding/folder-tree/folder-tree.component.ts
