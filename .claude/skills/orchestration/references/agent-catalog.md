# Agent Catalog Reference

Comprehensive catalog of all 16 specialist agents with capabilities, triggers, and invocation patterns.

> **Note**: The `nitro-planner` agent is included in the count but has its own dedicated section below. It operates outside the nitro-team-leader assignment flow and is invoked via the `/plan` command, not through orchestration batch assignment.

---

## Agent Capability Matrix

| Agent                    | Write Code | Design | Review | Plan  | Research | Content | Browser |
| ------------------------ | :--------: | :----: | :----: | :---: | :------: | :-----: | :-----: |
| nitro-project-manager          |     -      |   -    |   -    | **P** |    S     |    -    |    -    |
| nitro-software-architect       |     -      | **P**  |   S    | **P** |    S     |    -    |    -    |
| nitro-team-leader              |     -      |   -    |   S    | **P** |    -     |    -    |    -    |
| nitro-systems-developer        |   **P**    |   S    |   -    |   -   |    -     |    -    |    -    |
| nitro-backend-developer        |   **P**    |   S    |   -    |   -   |    -     |    -    |    -    |
| nitro-frontend-developer       |   **P**    |   S    |   -    |   -   |    -     |    -    |    -    |
| nitro-devops-engineer          |   **P**    |   S    |   -    |   -   |    S     |    -    |    -    |
| nitro-senior-tester            |   **P**    |   -    | **P**  |   -   |    -     |    -    |    -    |
| nitro-code-style-reviewer      |     -      |   -    | **P**  |   -   |    -     |    -    |    -    |
| nitro-code-logic-reviewer      |     -      |   -    | **P**  |   -   |    -     |    -    |    -    |
| nitro-visual-reviewer          |     -      |   -    | **P**  |   -   |    -     |    -    |  **P**  |
| nitro-researcher-expert        |     -      |   -    |   -    |   -   |  **P**   |    S    |    -    |
| nitro-modernization-detector   |     -      |   -    |   S    |   -   |  **P**   |    -    |    -    |
| nitro-ui-ux-designer           |     -      | **P**  |   -    |   S   |    -     |    S    |    -    |
| nitro-technical-content-writer |     -      |   S    |   -    |   -   |    -     |  **P**  |    -    |
| nitro-planner                  |     -      |   -    |   -    | **P** |    S     |    -    |    -    |

**Legend**: **P** = Primary capability, S = Secondary capability, - = Not applicable

---

## Agent Selection Matrix

| Request Type     | Agent Path                                         | Trigger                     |
| ---------------- | -------------------------------------------------- | --------------------------- |
| Implement X      | nitro-project-manager -> architect -> nitro-team-leader -> dev | New features                |
| Fix bug          | nitro-team-leader -> dev -> test -> review               | Bug reports                 |
| Orchestration    | architect -> nitro-team-leader -> nitro-systems-developer      | Agents, skills, commands    |
| Research X       | nitro-researcher-expert -> architect                     | Technical questions         |
| Review style     | nitro-code-style-reviewer                                | Pattern checks              |
| Review logic     | nitro-code-logic-reviewer                                | Completeness checks         |
| Review visual    | nitro-visual-reviewer                                    | UI/UX visual testing        |
| Test X           | nitro-senior-tester                                      | Testing                     |
| Architecture     | nitro-software-architect                                 | Design                      |
| Landing page     | nitro-ui-ux-designer -> nitro-technical-content-writer         | Marketing pages             |
| Brand/visual     | nitro-ui-ux-designer                                     | Design system               |
| Content          | nitro-technical-content-writer                           | Blogs, docs, video          |
| Infrastructure   | nitro-devops-engineer                                    | CI/CD, packaging            |
| Planning         | nitro-planner                                            | Roadmap, backlog, task creation |

**Default**: When uncertain, use `/orchestrate` for full workflow analysis.

---

## Planning Agents

### nitro-project-manager

**Role**: Requirements gathering, scope definition, stakeholder alignment

**Triggers**:

- Starting new features (FEATURE strategy Phase 1)
- Documentation tasks (DOCUMENTATION strategy Phase 1)
- DevOps tasks (DEVOPS strategy Phase 1)
- Any task needing scope clarification

**Inputs**:

- User request description
- Context from `task-tracking/TASK_[ID]/context.md`
- Codebase investigation results

**Outputs**:

- `task-tracking/TASK_[ID]/task-description.md`

**Dependencies**: None (first agent in most workflows)

**Parallel With**: None (sequential only)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-project-manager',
  description: 'Create requirements for TASK_2026_042',
  prompt: `You are nitro-project-manager for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**User Request**: "Add project settings panel with theme selection"

Analyze the request and create comprehensive requirements.
See nitro-project-manager.md for detailed instructions.`,
});
```

---

### nitro-software-architect

**Role**: Technical design, architecture decisions, implementation planning

**Triggers**:

- After PM completes (FEATURE strategy Phase 4)
- Refactoring tasks (REFACTORING strategy Phase 1)
- DevOps tasks (DEVOPS strategy Phase 2)
- When architectural decisions are needed

**Inputs**:

- `task-tracking/TASK_[ID]/task-description.md`
- Research reports (if available)
- Codebase analysis results

**Outputs**:

- `task-tracking/TASK_[ID]/plan.md`

**Dependencies**: nitro-project-manager (for FEATURE), nitro-researcher-expert (optional)

**Parallel With**: None (sequential only)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-software-architect',
  description: 'Design implementation for TASK_2026_042',
  prompt: `You are nitro-software-architect for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Requirements**: Read task-description.md in task folder

Design the technical implementation plan.
See nitro-software-architect.md for detailed instructions.`,
});
```

---

### nitro-team-leader

**Role**: Task decomposition, developer assignment, work coordination

**Triggers**:

- After architect completes (MODE 1: DECOMPOSITION)
- After developer returns (MODE 2: VERIFY + ASSIGN)
- When all batches complete (MODE 3: COMPLETION)

**Note**: In MODE 1, nitro-team-leader can assign batches to `nitro-devops-engineer` for infrastructure-heavy work within any workflow strategy (FEATURE, REFACTORING, BUGFIX). See the "Hybrid Task Handling" section in `strategies.md` for decision heuristics.

**Inputs**:

- `task-tracking/TASK_[ID]/plan.md`
- `task-tracking/TASK_[ID]/tasks.md` (for MODE 2/3)
- Developer implementation reports

**Outputs**:

- `task-tracking/TASK_[ID]/tasks.md` (creates and updates)
- Git commits (after verification)
- Developer assignment prompts

**Dependencies**: nitro-software-architect (for MODE 1)

**Parallel With**: None (sequential only)

**Invocation Example**:

```typescript
// MODE 1: DECOMPOSITION
Task({
  subagent_type: 'nitro-team-leader',
  description: 'Decompose tasks for TASK_2026_042',
  prompt: `You are nitro-team-leader for TASK_2026_042.

**MODE**: 1 - DECOMPOSITION
**Task Folder**: task-tracking/TASK_2026_042
**Implementation Plan**: Read plan.md in task folder

Break down the implementation into atomic, batchable tasks.
See nitro-team-leader.md for MODE 1 instructions.`,
});
```

---

### nitro-planner

**Role**: Strategic planning, roadmap management, task creation, backlog prioritization, Supervisor consultation

**Triggers**:

- Product roadmap planning and phase definition
- Task creation from user requests
- Backlog prioritization and reordering
- Supervisor consultation (what to execute next)
- New project onboarding

**Inputs**:

- User request / product direction
- `task-tracking/registry.md` (current task states)
- `task-tracking/plan.md` (current roadmap)
- Codebase analysis for sizing

**Outputs**:

- `task-tracking/plan.md` (roadmap and phases)
- `task-tracking/TASK_[ID]/task.md` (new tasks)
- `task-tracking/registry.md` (new entries)

**Dependencies**: None (invoked directly by user)

**Parallel With**: None (sequential, interactive)

**Note**: Planner is invoked via `/plan` command, NOT through nitro-team-leader batch assignment. It operates at the product level (roadmap, phases) while nitro-project-manager operates at the task level (detailed requirements).

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-planner',
  description: 'Plan next development phase',
  prompt: `You are nitro-planner.

**Goal**: Plan the next development phase for the project
**Registry**: Read task-tracking/registry.md for current state

See nitro-planner.md for detailed instructions.`,
});
```

---

## Development Agents

### nitro-systems-developer

**Role**: Orchestration infrastructure, agent definitions, skill files, command files, markdown specifications

**Triggers**:

- Specification/orchestration tasks assigned by nitro-team-leader
- Agent definition creation or modification
- Skill file creation or modification
- Command file creation or modification
- Reference document updates
- Workflow configuration changes

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (assigned batch)
- `task-tracking/TASK_[ID]/plan.md`
- Existing agent/skill/command files for pattern matching

**Outputs**:

- Files in `.claude/agents/`, `.claude/skills/`, `.claude/commands/`
- Reference files in `.claude/skills/orchestration/references/`
- Updates to `task-tracking/TASK_[ID]/tasks.md` (status: IMPLEMENTED)

**Dependencies**: nitro-team-leader (batch assignment)

**Parallel With**: nitro-backend-developer, nitro-frontend-developer (different batches)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-systems-developer',
  description: 'Implement Batch 1 for TASK_2026_042',
  prompt: `You are nitro-systems-developer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Tasks**: Read tasks.md, find Batch 1 (IN PROGRESS)
**Plan**: Read plan.md for context

Implement all tasks in Batch 1. Update status to IMPLEMENTED when done.
See nitro-systems-developer.md for detailed instructions.`,
});
```

---

### nitro-backend-developer

**Role**: Backend implementation, server-side services, API handlers, data layer

**Triggers**:

- Backend-focused tasks assigned by nitro-team-leader
- Server-side service work, API handlers
- Database operations
- Node.js/TypeScript backend work

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (assigned batch)
- `task-tracking/TASK_[ID]/plan.md`
- Library/module CLAUDE.md files

**Outputs**:

- Server-side source files
- Updates to `task-tracking/TASK_[ID]/tasks.md` (status: IMPLEMENTED)

**Dependencies**: nitro-team-leader (batch assignment)

**Parallel With**: nitro-frontend-developer (different batches)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-backend-developer',
  description: 'Implement Batch 1 for TASK_2026_042',
  prompt: `You are nitro-backend-developer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Tasks**: Read tasks.md, find Batch 1 (IN PROGRESS)
**Plan**: Read plan.md for context

Implement all tasks in Batch 1. Update status to IMPLEMENTED when done.
See nitro-backend-developer.md for detailed instructions.`,
});
```

---

### nitro-frontend-developer

**Role**: Frontend implementation, UI components, client-side logic

**Triggers**:

- Frontend-focused tasks assigned by nitro-team-leader
- UI component development
- Client-side state management
- Visual/interactive features

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (assigned batch)
- `task-tracking/TASK_[ID]/plan.md`
- Library/module CLAUDE.md files

**Outputs**:

- Frontend source files
- Updates to `task-tracking/TASK_[ID]/tasks.md` (status: IMPLEMENTED)

**Dependencies**: nitro-team-leader (batch assignment)

**Parallel With**: nitro-backend-developer (different batches)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-frontend-developer',
  description: 'Implement Batch 2 for TASK_2026_042',
  prompt: `You are nitro-frontend-developer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Tasks**: Read tasks.md, find Batch 2 (IN PROGRESS)
**Plan**: Read plan.md for context

Implement all tasks in Batch 2. Update status to IMPLEMENTED when done.
See nitro-frontend-developer.md for detailed instructions.`,
});
```

---

### nitro-devops-engineer

**Role**: Infrastructure, CI/CD, build configuration, deployment

**Triggers**:

- DEVOPS strategy Phase 3
- Build system configuration and optimization
- Packaging and distribution setup
- Deployment pipeline creation
- Infrastructure-focused batches within FEATURE/REFACTORING workflows (assigned by nitro-team-leader)

**Inputs**:

- `task-tracking/TASK_[ID]/plan.md`
- Existing workflow files (`.github/workflows/`)
- Build configs

**Outputs**:

- Configuration files (`.github/workflows/`, build configs, etc.)
- Build, packaging, and deployment scripts
- Updates to `task-tracking/TASK_[ID]/tasks.md` (status: IMPLEMENTED)

**Dependencies**: nitro-software-architect (for DEVOPS strategy)

**Parallel With**: None (typically sequential)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-devops-engineer',
  description: 'Implement infrastructure for TASK_2026_042',
  prompt: `You are nitro-devops-engineer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Plan**: Read plan.md for infrastructure design

Implement the infrastructure changes.
See nitro-devops-engineer.md for detailed instructions.`,
});
```

---

## Quality Assurance Agents

### nitro-senior-tester

**Role**: Test planning, test implementation, quality verification

**Triggers**:

- QA phase (user selects "tester" or "all")
- When comprehensive testing is needed
- Integration test development
- Test coverage improvements

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (completed tasks)
- `task-tracking/TASK_[ID]/plan.md`
- Modified source files

**Outputs**:

- Test files (`*.spec.ts`)
- `task-tracking/TASK_[ID]/test-report.md`

**Dependencies**: Implementation complete (all batches)

**Parallel With**: nitro-code-style-reviewer, nitro-code-logic-reviewer

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-senior-tester',
  description: 'Test implementation for TASK_2026_042',
  prompt: `You are nitro-senior-tester for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Changes**: Review tasks.md for implemented changes
**Plan**: Read plan.md for expected behavior

Create and run tests, document results in test-report.md.
See nitro-senior-tester.md for detailed instructions.`,
});
```

---

### nitro-code-style-reviewer

**Role**: Code pattern review, style consistency, best practices

**Triggers**:

- QA phase (user selects "style" or "reviewers" or "all")
- Documentation tasks (final review)
- Pattern compliance checks

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (file list)
- Modified source files
- Project style guidelines

**Outputs**:

- `task-tracking/TASK_[ID]/code-review.md` (style section)

**Dependencies**: Implementation complete (all batches)

**Parallel With**: nitro-senior-tester, nitro-code-logic-reviewer

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-code-style-reviewer',
  description: 'Review code style for TASK_2026_042',
  prompt: `You are nitro-code-style-reviewer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Changes**: Review tasks.md for modified files

Review code for style, patterns, and consistency.
See nitro-code-style-reviewer.md for detailed instructions.`,
});
```

---

### nitro-code-logic-reviewer

**Role**: Logic completeness review, edge cases, correctness

**Triggers**:

- QA phase (user selects "logic" or "reviewers" or "all")
- Complex business logic changes
- Algorithm implementations
- Error handling verification

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (file list)
- `task-tracking/TASK_[ID]/plan.md`
- Modified source files

**Outputs**:

- `task-tracking/TASK_[ID]/code-review.md` (logic section)

**Dependencies**: Implementation complete (all batches)

**Parallel With**: nitro-senior-tester, nitro-code-style-reviewer

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-code-logic-reviewer',
  description: 'Review code logic for TASK_2026_042',
  prompt: `You are nitro-code-logic-reviewer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Changes**: Review tasks.md for modified files
**Plan**: Read plan.md for expected behavior

Review code for logic completeness and correctness.
See nitro-code-logic-reviewer.md for detailed instructions.`,
});
```

---

### nitro-visual-reviewer

**Role**: Visual UI/UX review, responsive design testing, browser-based visual QA

**Triggers**:

- QA phase for frontend changes (user selects "visual" or "reviewers" or "all")
- Component UI changes
- Responsive design modifications
- CSS/Tailwind changes
- Form/Input styling updates

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (file list)
- Modified component files (`.html`, `.scss`, `.css`)
- Routes/pages affected

**Outputs**:

- `task-tracking/TASK_[ID]/visual-review.md`
- `task-tracking/TASK_[ID]/screenshots/*.png` (visual evidence)

**Dependencies**:

- Implementation complete (all batches)
- Application running in dev mode

**Parallel With**: nitro-senior-tester, nitro-code-style-reviewer, nitro-code-logic-reviewer

**Special Capabilities**:

- Chrome DevTools Protocol integration
- Screenshots at multiple viewports
- Responsive breakpoint testing
- Interaction state testing (hover, focus, click)
- Color contrast analysis
- Performance visual testing (layout shifts)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-visual-reviewer',
  description: 'Visual review for TASK_2026_042',
  prompt: `You are nitro-visual-reviewer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Changes**: Review tasks.md for modified frontend files
**Base URL**: http://localhost:4200

Perform comprehensive visual review including:
1. Test all 6 viewports (320, 375, 768, 1024, 1366, 1920)
2. Take screenshots at each viewport
3. Test hover, focus, active states
4. Check color contrast ratios
5. Verify touch target sizes
6. Test responsive behavior

See nitro-visual-reviewer.md for detailed instructions.`,
});
```

---

## Specialist Agents

### nitro-researcher-expert

**Role**: Technical research, feasibility analysis, POC development

**Triggers**:

- FEATURE strategy Phase 2 (when technical unknowns exist)
- RESEARCH strategy (primary agent)
- BUGFIX with unknown cause
- Technical complexity score > 3
- API/library evaluation

**Inputs**:

- Research question/hypothesis
- `task-tracking/TASK_[ID]/context.md`
- External documentation links

**Outputs**:

- `task-tracking/TASK_[ID]/research-report.md`

**Dependencies**: nitro-project-manager (optional context)

**Parallel With**: None (typically sequential)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-researcher-expert',
  description: 'Research vector storage options for TASK_2026_042',
  prompt: `You are nitro-researcher-expert for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Research Question**: "Best approach for vector storage integration in the application"

Investigate options, create comparison matrix, recommend approach.
See nitro-researcher-expert.md for detailed instructions.`,
});
```

---

### nitro-modernization-detector

**Role**: Future improvement analysis, tech debt identification

**Triggers**:

- Final phase of any workflow (Phase 8 in FEATURE)
- After all implementation and QA complete
- Periodic codebase analysis
- Technical debt assessment

**Inputs**:

- `task-tracking/TASK_[ID]/tasks.md` (what was implemented)
- Modified source files
- Codebase structure

**Outputs**:

- `task-tracking/TASK_[ID]/future-enhancements.md`

**Dependencies**: Implementation and QA complete

**Parallel With**: None (final phase)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-modernization-detector',
  description: 'Analyze future improvements for TASK_2026_042',
  prompt: `You are nitro-modernization-detector for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Changes**: Review tasks.md for what was implemented

Identify opportunities for future improvements and tech debt.
See nitro-modernization-detector.md for detailed instructions.`,
});
```

---

## Creative Agents

### nitro-ui-ux-designer

**Role**: Visual design, design systems, brand identity, UI specifications

**Triggers**:

- CREATIVE workflow (design system creation)
- FEATURE with UI components (Phase 3)
- Visual redesigns, brand work
- Landing page design
- Component library design

**Inputs**:

- Brand requirements/preferences
- Reference designs/competitors
- `task-tracking/TASK_[ID]/context.md`

**Outputs**:

- `.claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md`
- `task-tracking/TASK_[ID]/visual-design-specification.md`

**Dependencies**: nitro-project-manager (optional context)

**Parallel With**: None (design before content)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-ui-ux-designer',
  description: 'Create design system for TASK_2026_042',
  prompt: `You are nitro-ui-ux-designer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Goal**: Create brand design system for the project

Guide through niche discovery, create design system.
See nitro-ui-ux-designer.md for detailed instructions.`,
});
```

---

### nitro-technical-content-writer

**Role**: Marketing content, documentation, blog posts, video scripts

**Triggers**:

- CREATIVE workflow (after design system exists)
- Landing page content creation
- Blog post writing
- Documentation creation
- Video script development

**Inputs**:

- `.claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md`
- Content brief/requirements
- Codebase features for technical accuracy

**Outputs**:

- `task-tracking/TASK_[ID]/content-specification.md`
- `docs/content/*.md` (final content)

**Dependencies**: nitro-ui-ux-designer (for CREATIVE workflow)

**Parallel With**: Multiple content-writer instances (different content types)

**Invocation Example**:

```typescript
Task({
  subagent_type: 'nitro-technical-content-writer',
  description: 'Create landing page content for TASK_2026_042',
  prompt: `You are nitro-technical-content-writer for TASK_2026_042.

**Task Folder**: task-tracking/TASK_2026_042
**Design System**: Read .claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md
**Goal**: Create landing page content for the product

Create design-integrated content specification.
See nitro-technical-content-writer.md for detailed instructions.`,
});
```

---

## Agent Category Summary

| Category    | Agents                                                                   | Purpose                    |
| ----------- | ------------------------------------------------------------------------ | -------------------------- |
| Planning    | nitro-project-manager, nitro-software-architect, nitro-team-leader, nitro-planner                | Requirements & design      |
| Development | nitro-systems-developer, nitro-backend-developer, nitro-frontend-developer, nitro-devops-engineer | Implementation            |
| QA          | nitro-senior-tester, nitro-code-style-reviewer, nitro-code-logic-reviewer, nitro-visual-reviewer | Quality assurance          |
| Specialist  | nitro-researcher-expert, nitro-modernization-detector                                | Research & analysis        |
| Creative    | nitro-ui-ux-designer, nitro-technical-content-writer                                 | Design & content           |

---

## Parallel Invocation Patterns

Some agents can run in parallel during QA phase:

### All QA (User selects "all")

```typescript
// Run in parallel (all 4 QA agents)
Promise.all([
  Task({ subagent_type: 'nitro-senior-tester', ... }),
  Task({ subagent_type: 'nitro-code-style-reviewer', ... }),
  Task({ subagent_type: 'nitro-code-logic-reviewer', ... }),
  Task({ subagent_type: 'nitro-visual-reviewer', ... })  // Frontend tasks only
]);
```

### Reviewers Only (User selects "reviewers")

```typescript
// Run in parallel (3 reviewers)
Promise.all([
  Task({ subagent_type: 'nitro-code-style-reviewer', ... }),
  Task({ subagent_type: 'nitro-code-logic-reviewer', ... }),
  Task({ subagent_type: 'nitro-visual-reviewer', ... })  // Frontend tasks only
]);
```

### Creative Content (When design exists)

```typescript
// Run in parallel
Promise.all([
  Task({ subagent_type: 'nitro-technical-content-writer', prompt: 'landing page...' }),
  Task({ subagent_type: 'nitro-technical-content-writer', prompt: 'blog post...' }),
]);
```

### Development Batches (Independent batches)

```typescript
// Run in parallel when batches are independent
Promise.all([
  Task({ subagent_type: 'nitro-backend-developer', prompt: 'Batch 1...' }),
  Task({ subagent_type: 'nitro-frontend-developer', prompt: 'Batch 2...' }),
]);
```
