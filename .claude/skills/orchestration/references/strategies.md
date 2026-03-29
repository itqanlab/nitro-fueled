# Execution Strategies Reference

Detailed workflow diagrams and guidance for all 6 execution strategies plus creative workflows.

---

## Strategy Overview

| Strategy      | Complexity     | Primary Agents                       | User Checkpoints                      |
| ------------- | -------------- | ------------------------------------ | ------------------------------------- |
| FEATURE       | Full           | PM, Architect, Team-Leader, Devs, QA | Scope, Requirements, Architecture, QA |
| BUGFIX        | Streamlined    | Team-Leader, Devs, QA                | QA                                    |
| REFACTORING   | Focused        | Architect, Team-Leader, Devs, QA     | Architecture, QA                      |
| DOCUMENTATION | Minimal        | PM, Developer, Style Reviewer        | Requirements                          |
| RESEARCH      | Investigation  | Researcher                           | None                                  |
| DEVOPS        | Infrastructure | PM, Architect, DevOps Engineer, QA   | Requirements, Architecture, QA        |
| CREATIVE      | Design-first   | UI/UX Designer, Content Writer, Dev  | Scope, Design System, Content         |
| CONTENT       | Text-first     | PM, [Researcher], Content Writer, Style Reviewer | Scope, Requirements, QA   |

---

## FEATURE (Full Workflow)

**When to use**: New features, unclear scope, complex requirements

```
Phase 0.5: [IF ambiguous request] SCOPE CLARIFICATION
           Orchestrator asks scope/priority/constraint questions
           |
           USER ANSWERS (clarifies scope)
           |
           v
Phase 1: nitro-project-manager --> Creates task-description.md
         |
         USER VALIDATES ("APPROVED" or feedback)
         |
         v
Phase 2: [IF technical unknowns] nitro-researcher-expert --> Creates research-report.md
         |
         v
Phase 3: [IF UI/UX work] nitro-ui-ux-designer --> Creates design-spec.md
         |
         v
Phase 3.5: [IF multiple valid approaches] TECHNICAL CLARIFICATION
           Orchestrator asks pattern/integration/tradeoff questions
           |
           USER ANSWERS (clarifies technical preferences)
           |
           v
Phase 4: nitro-software-architect --> Creates plan.md
         |
         USER VALIDATES ("APPROVED" or feedback)
         |
         v
Phase 5: nitro-team-leader MODE 1 --> MODE 2 (loop) --> MODE 3
         |
         Build Worker writes handoff.md (files changed, commits, decisions, risks)
         |
         v
Phase 6: [QA agents as chosen — Review Worker reads handoff.md as first action]
         |
         v
Phase 7: User handles git (commits already created)
         |
         v
Phase 8: nitro-modernization-detector --> Creates future-enhancements.md
```

### Conditional Agent Triggers

| Agent             | Invoke When                                                 |
| ----------------- | ----------------------------------------------------------- |
| nitro-researcher-expert | Technical complexity > 3, unknown libraries/APIs, needs POC |
| nitro-ui-ux-designer    | New UI components, visual redesigns, component library customization |

---

## BUGFIX (Streamlined)

**When to use**: Bug reports, error fixes, issue resolution

```
[IF complex/unknown cause] nitro-researcher-expert
         |
         v
nitro-team-leader MODE 1 --> MODE 2 (loop) --> MODE 3
         |
         Build Worker writes handoff.md (files changed, commits, decisions, risks)
         |
         v
[QA agents — Review Worker reads handoff.md as first action] --> Git --> nitro-modernization-detector
```

### Decision Points

- **Unknown cause**: Add nitro-researcher-expert before nitro-team-leader
- **Known cause**: Skip directly to nitro-team-leader MODE 1
- **Single-file fix**: Consider minimal pattern (direct developer)

---

## REFACTORING (Focused)

**When to use**: Code restructuring, optimization, technical debt reduction

```
nitro-software-architect --> Creates plan.md
         |
         USER VALIDATES ("APPROVED" or feedback)
         |
         v
nitro-team-leader MODE 1 --> MODE 2 (loop) --> MODE 3
         |
         Build Worker writes handoff.md (files changed, commits, decisions, risks)
         |
         v
[QA agents — Review Worker reads handoff.md as first action] --> Git --> nitro-modernization-detector
```

### Why Skip PM

Refactoring requirements are typically clear:

- "Extract service from component"
- "Optimize database queries"
- "Consolidate duplicate signal stores"

The architect designs HOW to refactor; no scope discovery needed.

---

## DOCUMENTATION (Minimal)

**When to use**: README updates, API docs, comments, guides

```
nitro-project-manager --> Creates task-description.md
         |
         USER VALIDATES ("APPROVED" or feedback)
         |
         v
[appropriate developer] --> Implements documentation
         |
         v
nitro-code-style-reviewer --> Verifies formatting/consistency
         |
         v
Git
```

### Developer Selection

| Documentation Type        | Developer              |
| ------------------------- | ---------------------- |
| Orchestration/agent docs  | nitro-systems-developer      |
| Server-side/API docs      | nitro-backend-developer      |
| UI/component docs         | nitro-frontend-developer     |
| CI/CD, build docs         | nitro-devops-engineer        |
| General guides            | nitro-systems-developer      |

---

## RESEARCH (Investigation Only)

**When to use**: Technical exploration, feasibility studies, POC evaluation

```
nitro-researcher-expert --> Creates research-report.md
         |
         v
[IF implementation needed] --> Switch to FEATURE strategy
[IF research only] --> Complete
```

### Research-to-Implementation Transition

If research concludes implementation is needed:

1. Research report becomes input to PM
2. Switch to FEATURE strategy
3. PM references research-report.md in task-description.md

---

## DEVOPS (Infrastructure & Deployment)

**When to use**: CI/CD, build tool config, packaging, distribution, monitoring

```
Phase 1: nitro-project-manager --> Creates task-description.md
         |
         USER VALIDATES ("APPROVED" or feedback)
         |
         v
Phase 2: nitro-software-architect --> Creates plan.md
         |
         USER VALIDATES ("APPROVED" or feedback)
         |
         v
Phase 3: nitro-devops-engineer --> Implements infrastructure
         |
         USER CHOOSES QA (style/logic/skip)
         |
         v
Phase 4: [QA agents as chosen]
         |
         v
Phase 5: User handles git (commits already created)
         |
         v
Phase 6: nitro-modernization-detector --> Creates future-enhancements.md
```

### DEVOPS Trigger Keywords

Invoke DEVOPS strategy when task involves:

- CI/CD pipelines, GitHub Actions
- Packaging and distribution
- Build system configuration
- Deployment pipelines
- Code signing, security hardening

**Key Signal**: Work is 100% infrastructure (no application business logic)

**Developer**: Always use `nitro-devops-engineer` (NOT nitro-backend-developer)

---

## Hybrid Task Handling

**When to detect**: Tasks classified as FEATURE, REFACTORING, or BUGFIX that also involve build system changes, infrastructure work, or orchestration specification work. These are not pure DEVOPS tasks but contain a meaningful infrastructure or specification component alongside application code.

### How Team-Leader Handles Hybrid Tasks

In MODE 1 (DECOMPOSITION), the nitro-team-leader can assign specific batches to `nitro-devops-engineer` instead of only `nitro-backend-developer` or `nitro-frontend-developer`. The assignment decision is made per-batch based on batch content, not the overall task classification.

**Batch Assignment Rules**:

- If a batch is **100% infrastructure** (build config, CI/CD, packaging) --> assign to `nitro-devops-engineer`
- If a batch is **100% specification/orchestration** (agents, skills, commands, references) --> assign to `nitro-systems-developer`
- If a batch is **application code with minor infra** (e.g., a component that also updates an API handler) --> assign to `nitro-frontend-developer` or `nitro-backend-developer` (they can handle minor infra changes inline)
- The nitro-team-leader makes this decision based on batch content, not overall task classification

### Mixed Batch Assignment Example

```
Batch 1 (nitro-systems-developer):  Agent definitions, skill files, command files
Batch 2 (nitro-backend-developer):  Server-side services, API handlers, data layer
Batch 3 (nitro-devops-engineer):    Build config, CI/CD, packaging
Batch 4 (nitro-frontend-developer): UI components, state management, client integration
```

### Decision Heuristic for Team-Leader

| Non-Application Portion                                   | Assignment Strategy                                |
| --------------------------------------------------------- | -------------------------------------------------- |
| < 15% of task (e.g., add 1 API endpoint)                  | backend/nitro-frontend-developer handles it inline       |
| 15-40% infrastructure (e.g., build config + CI)            | Dedicated nitro-devops-engineer batch                    |
| 15-40% specification (e.g., agent + skill + references)    | Dedicated nitro-systems-developer batch                  |
| > 40% infrastructure                                      | Consider reclassifying as DEVOPS strategy          |

### Real-World Example

**TASK: Add Planner Agent** (classified as FEATURE)

- Primary work: Agent definition, skill files, command file, reference updates
- Infrastructure work: None

**Team-leader decomposition**:

```
Batch 1 (nitro-systems-developer): Planner agent definition, skill file, command file
Batch 2 (nitro-systems-developer): Reference updates (agent-catalog, strategies, team-leader-modes)
```

---

## CREATIVE (Design-First Workflow)

**When to use**: UI themes, component library design, marketing pages, brand identity

Creative workflows follow a **design-first principle** with specific agent sequencing.

### Design-First Dependency Chain

```
+---------------------------------------------------------------+
|  CREATIVE WORKFLOW DEPENDENCY CHAIN                           |
|                                                               |
|  1. DESIGN SYSTEM (Foundation)                                |
|     +-- nitro-ui-ux-designer creates if missing                     |
|         +-- Output: .claude/skills/nitro-technical-content-writer/  |
|                     DESIGN-SYSTEM.md                          |
|                                                               |
|  2. CONTENT GENERATION (Depends on #1)                        |
|     +-- nitro-technical-content-writer uses design system           |
|         +-- Output: Design-integrated content specs           |
|                                                               |
|  3. IMPLEMENTATION (Depends on #1 and #2)                     |
|     +-- nitro-frontend-developer implements with specs              |
+---------------------------------------------------------------+
```

### Automatic Design System Check

Before invoking nitro-technical-content-writer for landing pages:

```
design_system_path = ".claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md"

if NOT exists(design_system_path):
    -> Invoke nitro-ui-ux-designer FIRST
    -> "Create design system for this project"
    -> Wait for completion
    -> Then invoke nitro-technical-content-writer

if exists(design_system_path):
    -> Invoke nitro-technical-content-writer directly
    -> Content will use existing design system
```

### Creative Request Detection

| User Says                         | Workflow                                |
| --------------------------------- | --------------------------------------- |
| "Create landing page"             | Design check -> ui-ux -> content-writer |
| "Design our homepage"             | Design check -> ui-ux -> content-writer |
| "Marketing content for..."        | Design check -> content-writer          |
| "Visual design for..."            | nitro-ui-ux-designer                          |
| "Brand identity"                  | nitro-ui-ux-designer (full discovery)         |
| "Write a blog post"              | content-writer (design check optional)  |
| "Video script for..."            | content-writer                          |
| "What should our app look like?" | nitro-ui-ux-designer (discovery)              |

### Workflow A: Full Creative (Landing Page, Marketing Site)

```
User: "Create a landing page for our product"

Orchestrator:
  1. Check design system exists
     Read(.claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md)

  2. IF MISSING -> Invoke nitro-ui-ux-designer:
     Task("Create design system", subagent_type="nitro-ui-ux-designer")
     - Agent loads NICHE-DISCOVERY.md skill
     - Agent guides user through aesthetic discovery
     - Agent creates DESIGN-SYSTEM.md
     - Wait for completion

  3. Invoke nitro-technical-content-writer:
     Task("Create landing page content", subagent_type="nitro-technical-content-writer")
     - Agent loads LANDING-PAGES.md skill
     - Agent loads DESIGN-SYSTEM.md
     - Agent creates design-integrated content

  4. Deliver combined output:
     - Design system (if created)
     - Content specification with visual specs
     - Asset generation briefs
```

### Workflow B: Content Only (Blog, Docs, Video)

```
User: "Write a blog post about the orchestration system"

Orchestrator:
  1. Design system check (OPTIONAL for blogs)
     - If exists, content-writer can reference it
     - If missing, proceed without (text-focused content)

  2. Invoke nitro-technical-content-writer:
     Task("Write blog post about orchestration", subagent_type="nitro-technical-content-writer")
     - Agent loads BLOG-POSTS.md skill
     - Agent investigates codebase
     - Agent creates evidence-backed content
```

### Workflow C: Design System Only

```
User: "Help me define our visual identity"

Orchestrator:
  1. Invoke nitro-ui-ux-designer:
     Task("Create design system with full discovery", subagent_type="nitro-ui-ux-designer")
     - Agent loads NICHE-DISCOVERY.md
     - Agent loads DESIGN-SYSTEM-BUILDER.md
     - Agent guides through discovery questions
     - Agent creates complete design system
```

### Parallel vs Sequential Execution

**Sequential (Default for Creative)**:

- Design system MUST complete before content
- Content informs implementation

**Parallel (When Design Exists)**:

- Multiple content pieces can be created in parallel
- Different content types (blog + video) can run simultaneously

```
# Sequential (design missing)
nitro-ui-ux-designer --> nitro-technical-content-writer --> nitro-frontend-developer

# Parallel (design exists)
+-> nitro-technical-content-writer (landing page)
+-> nitro-technical-content-writer (blog post)
+-> nitro-technical-content-writer (video script)
```

### Creative Output Locations

| Agent                    | Output File                                                | Purpose                           |
| ------------------------ | ---------------------------------------------------------- | --------------------------------- |
| nitro-ui-ux-designer           | `.claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md` | Design tokens, colors, typography |
| nitro-ui-ux-designer           | `task-tracking/TASK_[ID]/design-spec.md`                   | Page-specific visual specs        |
| nitro-technical-content-writer | `task-tracking/TASK_[ID]/content-specification.md`         | Content with design integration   |
| nitro-technical-content-writer | `docs/content/*.md`                                        | Final content files               |

### Creative Handoff Protocols

**nitro-ui-ux-designer -> nitro-technical-content-writer:**

```markdown
## Design Handoff for Content

**Design System**: .claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md
**Aesthetic**: [Name - e.g., "Dark Command Center"]
**Key Colors**: [Primary accent, backgrounds]
**Typography**: [Display + body fonts]
**Animation Patterns**: [Key effects to reference]

Content writer should:

- Reference DESIGN-SYSTEM.md for all visual specs
- Use LANDING-PAGES.md templates with design integration
- Include animation/effect specifications in content
```

**nitro-technical-content-writer -> nitro-frontend-developer:**

```markdown
## Content Handoff for Implementation

**Content Spec**: task-tracking/TASK\_[ID]/content-specification.md
**Design System**: .claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md
**Assets Needed**: [List from asset briefs]

Developer should:

- Implement content following visual specs
- Use design system tokens exactly
- Generate/source assets from briefs
```

---

## CONTENT (Text-First Content Workflow)

**When to use**: Blog articles, email campaigns, newsletters, ad copy, marketing copy — non-coding content work

**Key distinction from CREATIVE**: CONTENT is text-first (deliverable is written copy); CREATIVE is design-first (deliverable is a visual/UI).

```
Phase 1: nitro-project-manager --> Creates task-description.md
         |
         USER VALIDATES ("APPROVED" or feedback)
         |
         v
Phase 2: [IF topic depth needed] nitro-researcher-expert --> Creates research-report.md
         |
         v
Phase 3: nitro-technical-content-writer --> Creates content output
         |
         USER CHOOSES QA (style/skip)
         |
         v
Phase 4: [nitro-code-style-reviewer] --> Tone, brand voice, audience fit, readability
         |
         v
Phase 5: User handles git (commits already created)
```

### CONTENT Trigger Keywords

Invoke CONTENT strategy when the request contains any of:

- "blog post", "article", "write an article"
- "email campaign", "marketing email", "email sequence"
- "newsletter"
- "ad copy", "advertising copy"
- "content piece", "copywriting"
- "write copy for"

### CONTENT Review Criteria

| Criterion          | Reviewer |
| ------------------ | -------- |
| Tone & brand voice | nitro-code-style-reviewer |
| Audience fit       | nitro-code-style-reviewer |
| SEO (for blogs)    | nitro-code-style-reviewer |
| Call-to-action effectiveness | nitro-code-style-reviewer |
| Readability        | nitro-code-style-reviewer |

### CONTENT vs CREATIVE Decision

| User Says                    | Workflow  |
| ---------------------------- | --------- |
| "Write a blog post about..." | CONTENT   |
| "Write a newsletter for..."  | CONTENT   |
| "Write ad copy for..."       | CONTENT   |
| "Create a landing page for..." | CREATIVE |
| "Design our homepage"        | CREATIVE  |
| "Build a marketing site"     | CREATIVE  |
| "Visual design for..."       | CREATIVE  |

**Key signal**: If the deliverable is primarily *written copy* (text file, email body, blog post), use CONTENT. If the deliverable is a *visual page or UI* (HTML, component, design system), use CREATIVE.

### Conditional Research Trigger

| Condition | Action |
| --------- | ------ |
| Blog post on a specific technical topic | Invoke nitro-researcher-expert for topic accuracy |
| Email campaign referencing product metrics | Invoke nitro-researcher-expert to gather facts |
| General marketing copy | Skip research, go directly to nitro-technical-content-writer |

### CONTENT Output Locations

| Deliverable           | Output Path                                        |
| --------------------- | -------------------------------------------------- |
| Blog post             | `docs/content/blog-[slug].md`                      |
| Email campaign        | `docs/content/email-[name].md`                     |
| Newsletter            | `docs/content/newsletter-[issue].md`               |
| Ad copy               | `docs/content/ad-copy-[name].md`                   |
| Content specification | `task-tracking/TASK_[ID]/content-specification.md` |

---

## Strategy Selection Summary

Use this decision tree for quick strategy selection:

```
Is task DEVOPS (CI/CD, packaging, build config, deployment)?
    YES -> DEVOPS strategy
    NO  -> continue

Is task CREATIVE (landing page, brand, marketing, theme design)?
    YES -> Check design system -> CREATIVE strategy
    NO  -> continue

Is task CONTENT (blog post, email campaign, newsletter, ad copy)?
    YES -> CONTENT strategy
    NO  -> continue

Is task a new FEATURE?
    YES -> FEATURE strategy (full workflow)
    NO  -> continue

Is task a BUGFIX?
    YES -> Is cause known?
           YES -> Minimal pattern (developer only)
           NO  -> BUGFIX strategy
    NO  -> continue

Is task REFACTORING?
    YES -> REFACTORING strategy
    NO  -> continue

Is task DOCUMENTATION?
    YES -> DOCUMENTATION strategy
    NO  -> continue

Is task RESEARCH?
    YES -> RESEARCH strategy
    NO  -> Ask user for clarification

NOTE: Tasks classified as FEATURE/REFACTORING may still include infrastructure
components. The nitro-team-leader handles this in MODE 1 by assigning infrastructure-heavy
batches to nitro-devops-engineer. See "Hybrid Task Handling" section.
```
