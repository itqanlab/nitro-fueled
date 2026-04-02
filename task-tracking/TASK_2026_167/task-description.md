# Task Description — TASK_2026_167

## Overview

Build a page in the dashboard that visualizes all built-in orchestration flows as interactive pipeline diagrams. This feature will provide users with a visual understanding of how different task types flow through various agent sequences.

## Scope

### In Scope
1. **Flow Visualization Page**: A new dashboard page that displays all 11 built-in orchestration flows
2. **Interactive Pipeline Diagrams**: Visual representation of each flow's agent sequence with connecting arrows
3. **Flow Details Panel**: Clickable phase nodes showing agent name, description, and output
4. **Flow Metadata Display**: Task type mapping, usage statistics, and success rates
5. **Clone to Custom Functionality**: Button to create custom flow stubs from built-in flows
6. **Flow Data API**: Backend endpoint to provide flow definitions to the frontend

### Out of Scope
1. **Custom Flow Editing**: Editing custom flows will be implemented in Part 2 (TASK_2026_170)
2. **Real-time Flow Execution**: This is a visualization feature, not an execution tool
3. **Historical Flow Analysis**: No historical performance tracking beyond basic usage stats

## Requirements

### Functional Requirements

#### FR1: Flow List Display
- **FR1.1**: Display all 11 built-in orchestration flows in a sidebar or card grid
- **FR1.2**: Each flow item must show: flow name, associated task types, last used timestamp
- **FR1.3**: Flows must be filterable by task type (FEATURE, BUGFIX, REFACTORING, etc.)

#### FR2: Pipeline Diagram Visualization
- **FR2.1**: Render each flow as a visual pipeline showing agent sequence (e.g., PM → Architect → Team-Leader → QA)
- **FR2.2**: Display connecting arrows between agent phases
- **FR2.3**: Support branching paths for flows with conditional logic
- **FR2.4**: Highlight active/selected flow in the visualization

#### FR3: Interactive Phase Details
- **FR3.1**: Each phase node must be clickable to show detailed information
- **FR3.2**: Phase details must include: agent name, agent description, what the phase produces
- **FR3.3**: Support hover tooltips with brief phase information
- **FR3.4**: Visual indication of optional vs required phases

#### FR4: Flow Metadata Display
- **FR4.1**: Show which task types use each flow
- **FR4.2**: Display basic usage statistics (last used, execution count)
- **FR4.3**: Show success rate for flows with execution history
- **FR4.4**: Metadata must update in real-time as flows are used

#### FR5: Clone to Custom Functionality
- **FR5.1**: Each flow must have a "Clone to Custom" button
- **FR5.2**: Cloning creates a new custom flow entry with the same structure
- **FR5.3**: Custom flows created from clones must be marked as stubs for Part 2 implementation
- **FR5.4**: User must receive confirmation when a flow is cloned

### Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Page must load in under 2 seconds with all flow data
- **NFR1.2**: Phase detail tooltips must appear within 300ms of hover
- **NFR1.3**: Diagram rendering must support up to 50 phases without performance degradation

#### NFR2: User Experience
- **NFR2.1**: Visualizations must be responsive across desktop, tablet, and mobile viewports
- **NFR2.2**: Color coding must be consistent with dashboard theme
- **NFR2.3**: Interface must be accessible with keyboard navigation
- **NFR2.4**: All interactive elements must have appropriate ARIA labels

#### NFR3: Data Accuracy
- **NFR3.1**: Flow definitions must be parsed from the canonical source (orchestration SKILL.md)
- **NFR3.2**: Any changes to flow definitions must reflect within 5 minutes in the UI
- **NFR3.3**: Data validation must prevent malformed flow definitions from breaking the UI

## Data Source

### Flow Definitions
- **Primary Source**: `.claude/skills/orchestration/SKILL.md` Workflow Selection Matrix
- **Parsing Required**: Extract flow definitions from the Strategy Quick Reference table
- **Format**: Convert markdown table to structured JSON for frontend consumption

### Flow Metadata
- **Execution History**: From task tracking database (tasks executed per flow type)
- **Success Rates**: Calculate from task completion status in tracking database
- **Last Used**: Timestamp of most recent task execution for each flow

## API Requirements

### GET /api/dashboard/orchestration/flows
- **Description**: Retrieve all built-in orchestration flows with metadata
- **Response Format**:
  ```json
  {
    "flows": [
      {
        "id": "feature",
        "name": "Feature Implementation",
        "description": "Full feature development workflow",
        "agents": ["nitro-project-manager", "nitro-software-architect", "nitro-team-leader", "nitro-code-style-reviewer", "nitro-code-logic-reviewer", "nitro-senior-tester"],
        "taskTypes": ["FEATURE"],
        "lastUsed": "2026-03-29T15:30:00Z",
        "executionCount": 45,
        "successRate": 0.92
      }
    ]
  }
  ```

### POST /api/dashboard/orchestration/flows/clone
- **Description**: Create a custom flow from a built-in flow template
- **Request Body**:
  ```json
  {
    "sourceFlowId": "feature",
    "customName": "Custom Feature Flow"
  }
  ```
- **Response Format**:
  ```json
  {
    "success": true,
    "customFlowId": "custom-feature-001",
    "message": "Flow cloned successfully"
  }
  ```

## File Structure

### Frontend Files
- `apps/dashboard/src/app/pages/orchestration/`
  - `orchestration-routing.module.ts`
  - `orchestration.component.ts`
  - `orchestration.component.html`
  - `orchestration.component.scss`
  - `flow-diagram/`
    - `flow-diagram.component.ts`
    - `flow-diagram.component.html`
    - `flow-diagram.component.scss`
  - `flow-details/`
    - `flow-details.component.ts`
    - `flow-details.component.html`
    - `flow-details.component.scss`
  - `flow-list/`
    - `flow-list.component.ts`
    - `flow-list.component.html`
    - `flow-list.component.scss`
  - `models/flow.model.ts`

### Backend Files
- `apps/dashboard-api/src/dashboard/orchestration/`
  - `orchestration.controller.ts`
  - `orchestration.service.ts`
  - `orchestration.model.ts`
  - `orchestration.module.ts`

### Shared Types
- `libs/shared-types/src/lib/orchestration/`
  - `flow.model.ts`
  - `agent.model.ts`

## Dependencies

### Technical Dependencies
- **Angular 17+**: Dashboard application framework
- **NG-ZORRO**: UI component library for dashboard components
- **D3.js or similar**: For rendering pipeline diagrams
- **TypeScript**: Type safety throughout the application

### Business Dependencies
- **Orchestration SKILL.md**: Must be maintained with structured flow definitions
- **Task Tracking Database**: Must store execution history for flow metadata
- **Dashboard Theme**: Must follow existing design patterns

## Acceptance Criteria

### AC1: Flow Visualization
- [ ] All 11 built-in orchestration flows are displayed as visual pipelines
- [ ] Each pipeline shows correct agent sequence with connecting arrows
- [ ] Branching flows (e.g., optional research phase) are rendered correctly
- [ ] Visual design is consistent with dashboard theme

### AC2: Interactivity
- [ ] Clicking a phase node displays detailed agent information
- [ ] Hover tooltips show brief phase descriptions
- [ ] Flow selection highlights the selected pipeline
- [ ] Interface responds within 300ms to all interactions

### AC3: Flow Metadata
- [ ] Task type mapping is accurate for each flow
- [ ] Usage statistics (last used, execution count) are displayed
- [ ] Success rates are calculated and displayed correctly
- [ ] Data refreshes when flow definitions change

### AC4: Clone Functionality
- [ ] "Clone to Custom" button is present for each flow
- [ ] Clicking clone creates a custom flow entry
- [ ] Custom flows are marked as stubs for future editing
- [ ] User receives confirmation of successful clone

### AC5: Responsive Design
- [ ] Page renders correctly on desktop (1920px), tablet (768px), and mobile (375px)
- [ ] Diagram layout adapts to different screen sizes
- [ ] All interactive elements are accessible via keyboard
- [ ] Color contrast ratios meet WCAG 2.1 AA standards

## Assumptions and Constraints

### Assumptions
1. **Data Source**: Orchestration flows are defined in SKILL.md in a consistent format
2. **Theme**: Dashboard has an existing design system to follow
3. **Performance**: Target devices have sufficient memory for complex SVG rendering
4. **Security**: Flow data is not sensitive and can be exposed to all dashboard users

### Constraints
1. **Timeline**: This is Part 1 of 2 - custom flow editing is out of scope
2. **Technology**: Must use existing dashboard tech stack (Angular, NG-ZORRO)
3. **Data Format**: Must parse flow definitions from existing SKILL.md format
4. **Browser Support**: Must support latest Chrome, Firefox, Safari, and Edge

## Open Questions for Architect

1. **Diagram Rendering**: Should we use D3.js for custom diagrams or leverage existing Angular chart components?
2. **Data Parsing**: What's the best approach to parse markdown tables into structured data?
3. **State Management**: Should flow data be cached in the frontend or always fetched fresh?
4. **Error Handling**: How should we handle malformed flow definitions from SKILL.md?
5. **Performance**: Should large flow diagrams be virtualized or paginated?

## Success Metrics

1. **Usability**: Users can identify the correct flow for their task type within 30 seconds
2. **Performance**: Page load time under 2 seconds with all flow data
3. **Adoption**: 80% of development teams use the visualization to understand task flows
4. **Accuracy**: 100% of flow definitions match the orchestration SKILL.md

---
**Generated by**: nitro-project-manager
**Session**: SESSION_2026-03-30T10-04-17
**Phase**: PM complete