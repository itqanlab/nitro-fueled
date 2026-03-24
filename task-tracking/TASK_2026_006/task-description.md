# Requirements Document - TASK_2026_006

## Introduction

Nitro-fueled is a reusable AI development orchestration package that installs into any project to provide a full PM -> Architect -> Dev -> QA pipeline. Currently, all developer agents (backend-developer, frontend-developer) are hardcoded markdown files tailored to a generic TypeScript/Node.js stack. When nitro-fueled is installed into a Python/Django project, a Swift/iOS project, or a Go microservices project, those developer agents are irrelevant.

This task builds the **Dynamic Agent and Skill Generation System** -- the mechanism that makes nitro-fueled truly universal. During `npx nitro-fueled init`, the system detects the project's tech stack, proposes developer agents tailored to that stack, and generates them from templates. It also provides `/create-agent` and `/create-skill` commands for on-demand generation after init.

**Business Value**: Without this system, nitro-fueled only works well for TypeScript projects. With it, nitro-fueled becomes a universal orchestration tool for any tech stack -- the core differentiator that enables adoption across the entire developer ecosystem.

**Dependencies**: TASK_2026_005 (systems-developer agent), TASK_2026_004 (planner agent)

---

## Requirements

### Requirement 1: AI-Assisted Stack Detection Engine

**User Story:** As a developer running `npx nitro-fueled init` on my project, I want the system to automatically detect my tech stack from codebase artifacts, so that I get developer agents tailored to my actual languages, frameworks, and tools without manual configuration.

#### Acceptance Criteria

1. WHEN `npx nitro-fueled init` runs in a project directory THEN the stack detector SHALL scan for known manifest files and produce a structured stack profile containing: languages, frameworks, infrastructure, databases, testing tools, and build tools.

2. WHEN the project contains `package.json` THEN the detector SHALL identify Node.js/TypeScript, extract framework dependencies (React, Angular, Vue, Next.js, Nest.js, Express, etc.), testing tools (Jest, Vitest, Mocha, Cypress, Playwright), and build tools (Webpack, Vite, esbuild, Nx, Turborepo).

3. WHEN the project contains `requirements.txt`, `pyproject.toml`, `setup.py`, or `Pipfile` THEN the detector SHALL identify Python and extract frameworks (Django, FastAPI, Flask, Starlette), testing tools (pytest, unittest), and infrastructure (Celery, SQLAlchemy, Alembic).

4. WHEN the project contains `go.mod` THEN the detector SHALL identify Go and extract frameworks (Gin, Echo, Fiber, Chi), testing tools (standard `testing` package, testify), and infrastructure (gRPC, protobuf).

5. WHEN the project contains `pom.xml` or `build.gradle`/`build.gradle.kts` THEN the detector SHALL identify Java/Kotlin and extract frameworks (Spring Boot, Quarkus, Micronaut), testing tools (JUnit, Mockito, Espresso), and build tools (Maven, Gradle).

6. WHEN the project contains `Package.swift`, `*.xcodeproj`, or `*.xcworkspace` THEN the detector SHALL identify Swift/iOS and extract frameworks (SwiftUI, UIKit), testing tools (XCTest, Quick/Nimble), and infrastructure (CocoaPods, SPM).

7. WHEN the project contains `pubspec.yaml` THEN the detector SHALL identify Dart/Flutter and extract platform targets (iOS, Android, Web, Desktop), testing tools (flutter_test, integration_test), and state management (Riverpod, Bloc, Provider).

8. WHEN the project contains `Cargo.toml` THEN the detector SHALL identify Rust and extract frameworks (Actix, Axum, Rocket), testing tools (built-in test framework, proptest), and build tools (cargo).

9. WHEN the project contains `Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `Jenkinsfile`, `terraform/`, `k8s/`, or cloud config files THEN the detector SHALL identify infrastructure components (Docker, Kubernetes, CI/CD platform, cloud provider).

10. WHEN the project contains database configuration files, ORM configs, or migration directories THEN the detector SHALL identify databases (PostgreSQL, MySQL, MongoDB, SQLite, Redis, DynamoDB).

11. WHEN detection completes THEN the system SHALL present the detected stack profile to the user in a clear, readable format and propose a set of developer agents to generate.

12. WHEN the user reviews the proposed agents THEN the system SHALL allow the user to confirm, add agents, remove agents, or adjust the detected stack before generation proceeds.

### Requirement 2: Monorepo Detection and Multi-Stack Support

**User Story:** As a developer with a monorepo containing multiple languages and frameworks (e.g., React frontend + Go backend + Python ML service), I want the stack detector to discover all stacks across the repo, so that I get developer agents for every part of my project.

#### Acceptance Criteria

1. WHEN the project root contains workspace indicators (Nx `workspace.json`/`nx.json`, Yarn/npm/pnpm workspaces in `package.json`, Lerna `lerna.json`, Turborepo `turbo.json`, Bazel `WORKSPACE`, or multiple independent subdirectories with their own manifest files) THEN the detector SHALL identify the project as a monorepo.

2. WHEN a monorepo is detected THEN the detector SHALL scan each workspace/package/app independently and aggregate results into a unified stack profile that maps each sub-project to its detected stack.

3. WHEN multiple languages are detected THEN the system SHALL propose one developer agent per distinct language/framework combination (e.g., `react-developer.md`, `go-developer.md`, `python-ml-developer.md`).

4. WHEN the monorepo contains shared libraries used across multiple sub-projects THEN the detector SHALL identify cross-cutting concerns (shared types, common utilities, API contracts) and include them in the stack profile.

5. WHEN the aggregated stack profile is presented THEN the user SHALL see a per-workspace breakdown showing which agents map to which parts of the codebase.

### Requirement 3: Agent Template System

**User Story:** As the nitro-fueled system generating project-specific developer agents, I want a template system with well-defined variables and structure, so that every generated agent follows the exact same structure as hand-written core agents and integrates seamlessly into the orchestration workflow.

#### Acceptance Criteria

1. WHEN an agent is generated THEN it SHALL contain YAML frontmatter with `name` and `description` fields matching the format used by all existing core agents (e.g., `backend-developer.md`, `frontend-developer.md`).

2. WHEN an agent is generated THEN it SHALL include the complete **Mandatory Initialization Protocol** (Steps 1-6) identical to existing developer agents: Discover Task Documents, Read Task Assignment (with batch support), Read Architecture Documents, Read Review Lessons, File Size Enforcement, Verify Imports and Patterns, Assess Complexity and Select Architecture, Execute Assignment.

3. WHEN an agent is generated THEN it SHALL include the complete **Mandatory Escalation Protocol** identical to existing developer agents: trigger conditions, documentation template, and forbidden actions.

4. WHEN an agent is generated THEN it SHALL include the **"NO GIT OPERATIONS"** section and the responsibility matrix (developer vs team-leader) identical to existing developer agents.

5. WHEN an agent is generated THEN it SHALL include the **Return Format** section with the completion report template, customized with the agent's name and domain.

6. WHEN an agent is generated THEN it SHALL include language/framework-specific sections populated from template variables:
   - `{agent_name}` -- The agent identifier (e.g., `java-developer`, `ios-developer`)
   - `{agent_title}` -- Display name (e.g., `Java Developer`, `iOS Developer`)
   - `{language}` -- Primary language (e.g., `Java`, `Swift`, `Go`, `Python`)
   - `{framework}` -- Primary framework (e.g., `Spring Boot`, `SwiftUI`, `Gin`, `Django`)
   - `{secondary_frameworks}` -- Additional frameworks detected (e.g., `Hibernate, Flyway`)
   - `{testing_tools}` -- Testing frameworks (e.g., `JUnit 5, Mockito`, `XCTest, Quick`)
   - `{build_tools}` -- Build system (e.g., `Gradle`, `SPM`, `cargo`)
   - `{file_types}` -- Relevant file extensions (e.g., `.java, .kt`, `.swift`, `.go`, `.py`)
   - `{patterns}` -- Idiomatic patterns for the language (e.g., `Dependency Injection, Repository Pattern` for Java; `Protocol-Oriented Programming, MVVM` for Swift)
   - `{code_quality_standards}` -- Language-specific quality rules (e.g., `no force unwraps` for Swift, `no bare excepts` for Python)
   - `{anti_patterns}` -- Language-specific anti-patterns to avoid
   - `{complexity_levels}` -- Language-appropriate complexity assessment (e.g., Level 1-4 descriptions tailored to the language's ecosystem)
   - `{pro_tips}` -- Language-specific development tips

7. WHEN an agent is generated THEN it SHALL include the **Core Principles Foundation** section (SOLID, DRY, YAGNI, KISS) with language-appropriate code examples in pseudocode or the target language.

8. WHEN an agent is generated THEN it SHALL include the **Universal Critical Rules** section and **Anti-Backward Compatibility Mandate** identical to existing developer agents.

9. WHEN an agent is generated THEN it SHALL be placed in `.claude/agents/` alongside core agents (flat directory, no subdirectories) and be immediately usable by the team-leader for batch assignment.

10. WHEN the template is used to generate agents for the minimum required stacks THEN it SHALL produce correct, complete agents for: Node.js/TypeScript, Python, Java, Kotlin, Swift, Go, React, Angular, Vue, Flutter -- each with idiomatic patterns, tools, and quality standards for that ecosystem.

### Requirement 4: Agent Catalog Integration

**User Story:** As the orchestration system assigning work to developers, I want generated agents to be registered in the agent catalog so that the team-leader and orchestrator can discover and assign them like any core agent.

#### Acceptance Criteria

1. WHEN a new agent is generated THEN the agent catalog reference file (`.claude/skills/orchestration/references/agent-catalog.md`) SHALL be updated to include the new agent with its role, triggers, inputs, outputs, dependencies, and invocation example.

2. WHEN the team-leader decomposes tasks in MODE 1 THEN it SHALL be able to assign batches to any generated developer agent using the same pattern it uses for `backend-developer` and `frontend-developer`.

3. WHEN the agent catalog is updated THEN the new agent entry SHALL follow the exact same format as existing Development Agents entries (Role, Triggers, Inputs, Outputs, Dependencies, Parallel With, Invocation Example).

4. WHEN multiple project-specific agents are generated THEN the Agent Capability Matrix and Agent Category Summary tables in the catalog SHALL be updated to include all new agents.

### Requirement 5: `/create-agent` Command

**User Story:** As a developer who needs a specialized agent after initial setup (e.g., a `terraform-developer` or `graphql-developer`), I want a `/create-agent` command that generates a properly structured agent file using AI, so that I can extend my orchestration team without manually writing agent definitions.

#### Acceptance Criteria

1. WHEN the user runs `/create-agent` with no arguments THEN the command SHALL enter interactive mode and prompt for: agent name, primary language/framework, tools, patterns, and a brief description of the agent's specialty.

2. WHEN the user runs `/create-agent [name] [description]` THEN the command SHALL pre-fill the name and description, then prompt for remaining details or use AI to infer them from the description.

3. WHEN the command has sufficient information THEN it SHALL use the developer-template to generate a complete agent file at `.claude/agents/{agent-name}.md`.

4. WHEN the agent file is generated THEN it SHALL pass the same structural validation as template-generated agents: YAML frontmatter, Initialization Protocol, Escalation Protocol, No Git Operations section, Return Format, and all Universal Critical Rules.

5. WHEN the agent file is generated THEN the command SHALL update the agent catalog (`.claude/skills/orchestration/references/agent-catalog.md`) with the new agent's entry.

6. WHEN the command completes THEN it SHALL display a summary showing the created file path, the agent's capabilities, and how to use it (e.g., "The team-leader can now assign batches to `terraform-developer`").

7. WHEN the user runs `/create-agent` THEN the command SHALL verify that the prerequisite files exist (agent-catalog.md, at least one existing agent for pattern reference). If missing, it SHALL instruct the user to run `/initialize-workspace` first.

### Requirement 6: `/create-skill` Command

**User Story:** As a developer who needs a specialized skill for my project (e.g., a database migration skill or API documentation skill), I want a `/create-skill` command that generates a properly structured skill directory and SKILL.md file, so that I can extend orchestration capabilities without manually writing skill definitions.

#### Acceptance Criteria

1. WHEN the user runs `/create-skill` with no arguments THEN the command SHALL enter interactive mode and prompt for: skill name, description, trigger conditions (when should this skill be used), and key sections.

2. WHEN the user runs `/create-skill [name] [description]` THEN the command SHALL pre-fill name and description, then prompt for remaining details or use AI to infer them.

3. WHEN the command has sufficient information THEN it SHALL create a skill directory at `.claude/skills/{skill-name}/` containing a `SKILL.md` file following the same structure as existing skills (YAML frontmatter with `name`, `description`, and `Use when` guidance).

4. WHEN the skill file is generated THEN it SHALL include: skill overview, trigger conditions, execution steps, quality standards, and integration points with the orchestration workflow.

5. WHEN the command completes THEN it SHALL display a summary showing the created directory path, the skill's purpose, and how it integrates with orchestration.

6. WHEN the user runs `/create-skill` THEN the command SHALL verify prerequisite files exist. If missing, it SHALL instruct the user to run `/initialize-workspace` first.

### Requirement 7: Stack Detection Manifest Registry

**User Story:** As the stack detection engine, I want a well-defined registry of file-to-stack mappings, so that detection logic is maintainable, extensible, and can be updated without modifying core detection code.

#### Acceptance Criteria

1. WHEN the stack detection engine initializes THEN it SHALL load detection rules from a structured manifest registry that maps file patterns to stack identifiers.

2. WHEN the manifest registry defines a detection rule THEN it SHALL specify: file pattern (glob), stack category (language/framework/infrastructure/database/testing/build), stack identifier, confidence level (high/medium/low), and optional content patterns (regex within the file to refine detection).

3. WHEN multiple detection rules match for the same category THEN the system SHALL use confidence levels and content pattern matches to determine the most accurate result.

4. WHEN a new language or framework needs to be supported THEN it SHALL be addable by extending the manifest registry without modifying the detection engine code.

5. WHEN the manifest registry is loaded THEN it SHALL cover at minimum the following ecosystems with high-confidence detection rules:

| Ecosystem | Manifest Files | Content Patterns |
|-----------|---------------|------------------|
| Node.js/TypeScript | `package.json`, `tsconfig.json` | `"dependencies"`, framework names in deps |
| Python | `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile` | Framework imports, tool configs |
| Java/Kotlin | `pom.xml`, `build.gradle`, `build.gradle.kts` | Spring Boot starters, Android SDK |
| Swift/iOS | `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, `Podfile` | SwiftUI/UIKit imports |
| Dart/Flutter | `pubspec.yaml` | Flutter SDK dependency |
| Go | `go.mod` | Module path, dependency list |
| Rust | `Cargo.toml` | Crate dependencies |
| Ruby | `Gemfile`, `*.gemspec` | Rails, Sinatra |
| C#/.NET | `*.csproj`, `*.sln` | .NET SDK, ASP.NET |
| PHP | `composer.json` | Laravel, Symfony |

### Requirement 8: Template Variable Population Intelligence

**User Story:** As the agent generation system, I want AI-assisted population of template variables with idiomatic, high-quality content for each tech stack, so that generated agents contain genuinely useful language-specific guidance rather than generic filler.

#### Acceptance Criteria

1. WHEN the template system populates `{patterns}` for a given language/framework THEN it SHALL include idiomatic architectural patterns genuinely used in that ecosystem (e.g., Protocol-Oriented Programming for Swift, Goroutine patterns for Go, Dependency Injection for Spring Boot).

2. WHEN the template system populates `{code_quality_standards}` THEN it SHALL include language-specific quality rules that a senior developer in that ecosystem would enforce (e.g., `no force unwraps in Swift`, `no bare except in Python`, `no public fields in Java`, `error wrapping in Go`).

3. WHEN the template system populates `{anti_patterns}` THEN it SHALL include anti-patterns specific to that language/framework ecosystem (e.g., `god activities in Android`, `massive view controllers in iOS`, `callback hell in Node.js`, `N+1 queries in Django`).

4. WHEN the template system populates `{complexity_levels}` THEN it SHALL provide 4 complexity levels with descriptions and examples relevant to the target ecosystem (not generic descriptions copied from the TypeScript agents).

5. WHEN the template system populates `{pro_tips}` THEN it SHALL include practical, experience-based tips for the target ecosystem (e.g., `use Result type for error handling in Rust`, `prefer value types in Swift`, `use context for cancellation in Go`).

6. WHEN a generated agent is compared to a hand-written agent for the same stack THEN the generated agent SHALL be indistinguishable in quality, specificity, and usefulness -- containing the same depth of language-specific guidance that a senior developer would write.

---

## Non-Functional Requirements

### Performance Requirements

- **Stack Detection Speed**: Full codebase scan and detection SHALL complete in under 10 seconds for projects with up to 10,000 files.
- **Agent Generation Speed**: Template population and file generation for a single agent SHALL complete in under 5 seconds.
- **Monorepo Scan**: Monorepo with up to 20 workspaces SHALL complete detection in under 30 seconds.

### Reliability Requirements

- **Graceful Degradation**: If a manifest file cannot be read (permissions, encoding), the detector SHALL log a warning and continue scanning remaining files rather than failing entirely.
- **Partial Detection**: If the detector can identify the language but not the framework, it SHALL still propose a language-level developer agent with generic framework guidance.
- **Idempotent Generation**: Running generation multiple times with the same inputs SHALL produce identical output. Re-running init SHALL detect existing generated agents and ask whether to regenerate or keep.

### Maintainability Requirements

- **Extensibility**: Adding support for a new language/framework SHALL require only: (1) adding detection rules to the manifest registry, and (2) creating a stack-specific variable set. No template engine changes required.
- **Single Template Source**: All developer agents SHALL be generated from a single `developer-template.md` file. Language-specific content comes from variable population, not separate templates per language.
- **Separation of Concerns**: Detection logic, template engine, variable population, and file generation SHALL be separate, independently testable concerns.

### Quality Requirements

- **Agent Quality**: Generated agents SHALL pass the same structural validation that core agents pass: YAML frontmatter present, all mandatory sections present, no placeholder text (no `{variable}` tokens in output), no TODO comments.
- **Consistency**: All generated agents SHALL use identical section ordering, heading levels, and formatting as existing core agents (`backend-developer.md`, `frontend-developer.md`).

---

## Stakeholder Analysis

### Primary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|-------------|-------------|-------------|------------------|
| Developer (End User) | High | Init flow, agent confirmation | Gets working, tailored developer agents for their stack in under 2 minutes |
| Product Owner | High | Requirements, validation | System works across 10+ tech stacks, enabling universal adoption |
| Orchestration System | High | Consumer of generated agents | Team-leader can assign batches to any generated agent without special handling |

### Secondary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|-------------|-------------|-------------|------------------|
| systems-developer | Medium | Implementation | Clean template system, maintainable detection registry |
| Team-Leader Agent | Medium | Consumer | Discovers and assigns generated agents identically to core agents |
| Future Contributors | Medium | Extension | Can add new language support by following documented extension pattern |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Score | Mitigation Strategy |
|------|------------|--------|-------|---------------------|
| Template variable population produces generic/low-quality content | Medium | High | 6 | Use AI-assisted population with stack-specific knowledge; validate against hand-written agents; include curated variable sets for the 10 minimum stacks |
| Stack detection false positives (misidentifying framework) | Medium | Medium | 4 | Use confidence levels and content-pattern matching; always require user confirmation before generation |
| Monorepo detection misses workspaces | Medium | Medium | 4 | Support all major workspace protocols (Nx, Yarn, pnpm, Lerna, Turborepo, Bazel); fall back to directory-level scanning |
| Generated agents drift from core agent structure over time | Low | High | 3 | Single template source of truth; structural validation on generation; template references actual core agents as pattern |
| Agent catalog update corrupts existing entries | Low | Critical | 3 | Read-modify-write pattern; validate catalog structure after update; backup before modification |

### Process Risks

| Risk | Probability | Impact | Score | Mitigation Strategy |
|------|------------|--------|-------|---------------------|
| Scope creep into CLI implementation | Medium | Medium | 4 | This task produces the detection engine, templates, and commands -- NOT the CLI wrapper. CLI is a separate task (TASK_2026_007 or later) |
| Template becomes too complex to maintain | Low | High | 3 | KISS principle: one template file with clear variable boundaries; avoid conditional logic in template; use variable population for all stack-specific content |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Stack Coverage | 10+ ecosystems detected | Count of ecosystems in manifest registry with high-confidence rules |
| Agent Quality | Indistinguishable from hand-written | Structural validation passes; side-by-side comparison with core agents |
| Orchestration Integration | Zero special handling | Team-leader assigns batches to generated agents with no code changes |
| Detection Accuracy | 95%+ correct identification | Manual testing across 10 sample projects of different stacks |
| User Confirmation Flow | Under 60 seconds | Time from detection display to user confirmation |
| Extension Effort | Under 30 minutes per new stack | Time for a contributor to add a new language following the documented pattern |

---

## Scope Boundaries

### In Scope

- Stack detection engine with manifest registry
- Developer agent template (`developer-template.md`) with all template variables
- AI-assisted template variable population for 10+ stacks
- `/create-agent` command for on-demand agent generation
- `/create-skill` command for on-demand skill generation
- Agent catalog integration (auto-update on generation)
- Monorepo multi-stack detection
- User confirmation/adjustment flow for detected stack

### Out of Scope

- CLI package implementation (`npx nitro-fueled init` wrapper) -- separate task
- Core agent modifications (PM, Architect, Team-Leader, reviewers remain unchanged)
- Runtime agent hot-swapping (agents are generated at init time, not dynamically at runtime)
- Automated testing of generated agents (validation is structural, not behavioral)
- Custom template creation by end users (users use `/create-agent` command instead)

---

## Implementation Guidance

### File Deliverables

| File | Purpose |
|------|---------|
| `.claude/skills/orchestration/references/stack-detection-registry.md` | Manifest registry mapping file patterns to stacks |
| `.claude/skills/orchestration/references/developer-template.md` | Single source-of-truth template for all developer agents |
| `.claude/skills/orchestration/references/stack-variable-sets.md` | Curated variable values for each supported stack (patterns, quality rules, anti-patterns, tips) |
| `.claude/commands/create-agent.md` | `/create-agent` command definition |
| `.claude/commands/create-skill.md` | `/create-skill` command definition |
| Updated: `.claude/skills/orchestration/references/agent-catalog.md` | Integration point for generated agents |

### Key Design Constraint

The entire system operates within Claude Code's markdown-based agent/skill/command architecture. There is no TypeScript runtime for detection or generation during this task. The detection engine, template system, and generation logic are defined as **command instructions** (markdown files) that Claude Code executes when the user runs the commands. The CLI wrapper that calls these commands programmatically is a separate task.

### Agent Structure Contract

Every generated developer agent MUST contain these sections in this order (matching `backend-developer.md` and `frontend-developer.md`):

1. YAML frontmatter (`name`, `description`)
2. Agent title and role description
3. Absolute paths reminder
4. Core Principles Foundation (SOLID, DRY, YAGNI, KISS)
5. Mandatory Initialization Protocol (Steps 1-6)
6. Mandatory Escalation Protocol
7. No Git Operations section with responsibility matrix
8. Pattern Awareness Catalog (language-specific)
9. Code Quality Standards (language-specific)
10. Universal Critical Rules and Anti-Backward Compatibility Mandate
11. Anti-Patterns to Avoid (language-specific)
12. Pro Tips (language-specific)
13. Return Format with completion report template
14. Core Intelligence Principle summary
