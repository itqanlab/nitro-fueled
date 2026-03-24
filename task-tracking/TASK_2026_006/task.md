# Task: Dynamic Agent and Skill Generation System

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Complex |

## Description

Build the system that generates project-specific agents and skills during `npx nitro-fueled init`. This is a critical part of making nitro-fueled work across any project and tech stack.

**The problem**: Currently all agents are hardcoded markdown files. When nitro-fueled is installed into a new project, the developer agents need to match THAT project's tech stack (Java, Python, React, Swift, Flutter, etc.). The orchestration workflow agents (PM, architect, team-leader, reviewers, planner, systems-developer) are universal, but developer agents must be customized.

**The solution**: A three-part system:

### Part 1: AI-Assisted Stack Detection
During `init`, the system reads the codebase to automatically detect:
- Languages (package.json → Node.js/TypeScript, requirements.txt → Python, go.mod → Go, Podfile → iOS, build.gradle → Android/Java, etc.)
- Frameworks (React, Angular, Vue, Django, Spring Boot, Flutter, SwiftUI, etc.)
- Infrastructure (Docker, AWS, GCP, Vercel, Kubernetes, etc.)
- Databases (PostgreSQL, MongoDB, SQLite, Redis, etc.)
- Testing tools (Jest, pytest, JUnit, XCTest, etc.)

The detection proposes a set of developer agents and asks the Product Owner to confirm/adjust.

### Part 2: Agent Template System
A set of agent templates that get filled with project-specific capabilities:
- `developer-template.md` — base structure that all developer agents follow (same YAML frontmatter, same integration points with orchestration workflow, same task lifecycle)
- Template variables: `{language}`, `{framework}`, `{tools}`, `{patterns}`, `{file_types}`
- The template ensures every generated agent is "tied" into the orchestration workflow the same way — team-leader can assign them, they follow the same reporting pattern, they integrate with task-tracking

Generated agents could include any of:
- `java-developer.md` — Spring Boot, Maven/Gradle, JUnit
- `ios-developer.md` — Swift, SwiftUI, XCTest
- `android-developer.md` — Kotlin, Jetpack Compose, Espresso
- `python-developer.md` — Django/FastAPI, pytest
- `react-developer.md` — React, TypeScript, Jest
- `flutter-developer.md` — Dart, Flutter, integration tests
- Or ANY other combination

### Part 3: Skill Generation
Beyond agents, the system should also generate project-specific skills if needed:
- A `/create-agent` command that uses AI to generate a properly structured agent definition
- A `/create-skill` command that generates a properly structured skill file
- Both ensure the output follows orchestration patterns and integrates with the workflow

**Key constraint**: Every generated agent MUST follow the same structure as existing core agents. The orchestration workflow doesn't care what language the developer writes — it just needs them to follow the same task lifecycle (receive assignment from team-leader, implement, update tasks.md, follow Exit Gate).

## Dependencies

- TASK_2026_005 — systems-developer agent must exist first (it's used to build this system)
- TASK_2026_004 — Planner must exist (it's involved in the init onboarding flow)

## Acceptance Criteria

- [ ] AI stack detection reads codebase and proposes developer agents
- [ ] Developer agent template follows same structure as core agents
- [ ] Template system generates agents tied into orchestration workflow (team-leader assignment, task lifecycle, Exit Gate)
- [ ] Generated agents cover at minimum: Node.js, Python, Java, Swift, Kotlin, React, Angular, Vue, Flutter, Go
- [ ] `/create-agent` command generates properly structured agent files
- [ ] `/create-skill` command generates properly structured skill files
- [ ] Stack detection handles monorepos (multiple languages/frameworks)
- [ ] Product Owner confirms/adjusts detected stack before generation
- [ ] Generated agents are indistinguishable from hand-written agents in quality

## References

- Core agents: `.claude/agents/` (pattern to follow)
- Agent catalog: `.claude/skills/orchestration/references/agent-catalog.md`
- Orchestration SKILL.md: `.claude/skills/orchestration/SKILL.md`
- CLI design: `docs/claude-orchestrate-package-design.md`
