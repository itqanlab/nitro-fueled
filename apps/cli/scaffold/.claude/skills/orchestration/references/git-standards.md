# Git Standards Reference

Git conventions for orchestrated task execution.

**CRITICAL**: All commits MUST follow these rules to pass pre-commit hooks.

---

## Commit Message Format

```
<type>(<scope>): <short description>

[optional body]

Task: TASK_YYYY_NNN
Agent: nitro-<agent-name>
Phase: <phase>
Worker: <worker-type>
Session: SESSION_YYYY-MM-DD_HH-MM-SS
Provider: <provider>
Model: <model>
Retry: <attempt>/<max>
Complexity: <complexity>
Priority: <priority>
Generated-By: nitro-fueled v<version> (https://github.com/itqanlab/nitro-fueled)
```

### Format Rules

| Component | Rule                                                        |
| --------- | ----------------------------------------------------------- |
| Type      | Required, lowercase, from allowed list                      |
| Scope     | Required, lowercase, from allowed list                      |
| Subject   | Required, lowercase, 3-72 chars, no period, imperative mood |
| Header    | Max 100 characters total (type + scope + subject)           |
| Body      | Optional, max 100 chars per line, explain "why" not "what"  |
| Footer    | Required for orchestrated work, optional for manual commits     |

---

## Traceability Footer Fields

| Field      | Required | Values | Purpose |
|------------|----------|---------|----------|
| Task       | Yes | `TASK_YYYY_NNN` | Which task this commit belongs to |
| Agent      | Yes | `nitro-backend-developer`, `nitro-frontend-developer`, `nitro-devops-engineer`, `nitro-systems-developer`, `nitro-team-leader`, `nitro-unit-tester`, `nitro-integration-tester`, `nitro-e2e-tester`, `nitro-review-lead`, `auto-pilot`, `orchestrator` | Which agent authored the code |
| Phase      | Yes | `pm`, `architecture`, `implementation`, `review`, `review-fix`, `test`, `test-fix`, `completion`, `salvage`, `supervision` | Where in the pipeline |
| Worker     | Yes | `build-worker`, `fix-worker`, `review-worker`, `test-worker`, `completion-worker` | Worker type that spawned this agent |
| Session    | Yes | `SESSION_YYYY-MM-DD_HH-MM-SS` or `manual` | Which auto-pilot session spawned this. For `/orchestrate` (no auto-pilot session), use `manual` |
| Provider   | Yes | `claude`, `glm`, `opencode` | Which AI provider ran this worker |
| Model      | Yes | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `glm-5`, `glm-4.7`, `openai/gpt-4.1-mini`, etc. | Exact model used |
| Retry      | Yes | `0/2`, `1/3`, etc. | Attempt number / max retries (0 = first attempt) |
| Complexity | Yes | `Simple`, `Medium`, `Complex` | Task complexity from task.md |
| Priority   | Yes | `P0-Critical`, `P1-High`, `P2-Medium`, `P3-Low` | Task priority from task.md |
| Generated-By | Yes | `nitro-fueled v<version> (<url>)` | Package attribution — version read from package.json at commit time |

---

## Allowed Types

| Type       | Description        | When to Use                              |
| ---------- | ------------------ | ---------------------------------------- |
| `feat`     | New feature        | Adding new functionality                 |
| `fix`      | Bug fix            | Fixing broken behavior                   |
| `docs`     | Documentation      | README, comments, CLAUDE.md changes      |
| `style`    | Code style         | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring | Improving code without changing behavior |
| `perf`     | Performance        | Optimizations, speed improvements        |
| `test`     | Testing            | Adding/updating test files               |
| `build`    | Build system       | Webpack, esbuild, dependency changes     |
| `ci`       | CI configuration   | GitHub Actions, pipeline changes         |
| `chore`    | Maintenance        | Tooling, config (no src/test changes)    |
| `revert`   | Revert commit      | Undoing previous commit                  |

---

## Allowed Scopes (Project-Specific)

> **Note**: These scopes are templates. During `nitro-fueled init`, scopes are generated based on target project's tech stack. The examples below are generic defaults.

| Scope           | Domain                                              | Example Files                                     |
| --------------- | --------------------------------------------------- | ------------------------------------------------- |
| `project`       | Project-wide configuration, workspace settings      | package.json, tsconfig.json                       |
| `task`          | Task tracking, orchestration artifacts              | task-tracking/*                                  |
| `orchestration` | Orchestration system, agent configurations          | .claude/skills/*, .claude/agents/*              |
| `ui`            | UI components, templates, styles                    | src/components/*, src/pages/*                   |
| `db`            | Database schemas and operations                     | src/db/*, migrations/*                          |
| `api`           | API routes, handlers, middleware                    | src/api/*, src/handlers/*                       |
| `shared`        | Shared libraries, interfaces, types, utilities      | src/shared/*, src/utils/*                       |

---

## Commit Rules (Enforced by Commitlint)

### Subject Rules

| Rule   | Requirement     | Example                          |
| ------ | --------------- | -------------------------------- |
| Case   | Lowercase only  | "add feature" not "Add feature"  |
| Length | 3-72 characters | Short but descriptive            |
| Ending | No period       | "add feature" not "add feature." |
| Mood   | Imperative      | "add" not "added" or "adding"    |

### What NOT to Do

- Sentence-case: "Add new feature"
- Start-case: "Add New Feature"
- UPPER-CASE: "ADD NEW FEATURE"
- Past tense: "added new feature"
- Present participle: "adding new feature"

### Footer Rules

- All footer fields are **required** for commits made during orchestrated work (Build Workers, Fix Workers, Review Workers, Test Workers, Completion Workers)
- For commits made by the Supervisor itself (session archive, status updates), use `Agent: auto-pilot`, `Worker: auto-pilot`, `Phase: supervision`
- For commits made via `/orchestrate` (no auto-pilot session), use `Session: manual`
- For manual user commits outside orchestration, all footer fields are **optional**
- The `Co-Authored-By` line (if present) goes after the last footer field
- Footer fields must appear in the order listed above (Task first, Priority last)

---

## Developer Commit Patterns

Each developer agent uses specific type+scope combinations based on their domain.

### backend-developer

```
feat(shared): add project settings interface and types
Task: TASK_2026_087
Agent: nitro-backend-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(db): create settings table with migration
Task: TASK_2026_087
Agent: nitro-backend-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

### frontend-developer

```
feat(ui): add settings panel component with form controls
Task: TASK_2026_088
Agent: nitro-frontend-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

### devops-engineer

```
ci(project): add macOS code signing to build pipeline
Task: TASK_2026_089
Agent: nitro-devops-engineer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

---

## Valid Examples

```bash
feat(cli): add status command with task progress display
Task: TASK_2026_087
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

fix(cli): resolve registry parsing when status contains pipes
Task: TASK_2026_087
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

docs(orchestration): update agent catalog references
Task: TASK_2026_090
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

refactor(orchestration): simplify completion phase instructions
Task: TASK_2026_090
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

chore(project): update commander dependency to latest
Task: TASK_2026_091
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

perf(cli): optimize stack detection for large monorepos
Task: TASK_2026_092
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

test(cli): add unit tests for registry parser
Task: TASK_2026_093
Agent: nitro-unit-tester
Phase: test
Worker: test-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

build(project): upgrade typescript to v5.4.0
Task: TASK_2026_094
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

ci(project): add parallel test execution
Task: TASK_2026_095
Agent: nitro-devops-engineer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

style(orchestration): format skill reference files
Task: TASK_2026_096
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

---

## Traceability Queries

This standard enables powerful git log queries for analysis and debugging:

```bash
# All commits for a task
git log --grep="Task: TASK_2026_087"

# All commits by a specific agent
git log --grep="Agent: nitro-backend-developer"

# All commits from a session
git log --grep="Session: SESSION_2026-03-28"

# All review-fix commits (failure pattern analysis)
git log --grep="Phase: review-fix"

# All commits from GLM provider (cost analysis per provider)
git log --grep="Provider: glm"

# Quality comparison across models
git log --grep="Model: claude-opus-4-6"

# All retry commits (failure pattern analysis)
git log --grep="Retry: 1/"

# Commits from complex tasks (correlate with bugs)
git log --grep="Complexity: Complex"

# All critical priority work
git log --grep="Priority: P0-Critical"

# Combine: all GLM retries for complex tasks
git log --grep="Provider: glm" --grep="Retry: 1/" --grep="Complexity: Complex" --all-match
```

---

## Invalid Examples

| Example                      | Issue                         |
| ---------------------------- | ----------------------------- |
| `Feature: Add search`        | Wrong type format, wrong case |
| `feat: Add search`           | Missing scope                 |
| `feat(search): Add search`   | Invalid scope, wrong case     |
| `feat(ui): Add search.`      | Period at end, uppercase      |
| `feat(ui): Add Search`       | Uppercase in subject          |
| `feat(UI): add search`       | Uppercase scope               |
| `Feat(ui): add search`       | Uppercase type                |
| `feat(ui): a`                | Subject too short (< 3 chars) |

---

## Branch Naming

```
task/TASK_YYYY_NNN-short-description
```

### Examples

```
task/TASK_2026_001-project-settings-panel
task/TASK_2026_002-fix-sidebar-collapse
task/TASK_2026_003-migrate-angular-19
task/TASK_2026_014-add-vector-search
```

### Rules

- Use the task ID from task-tracking
- Append a short kebab-case description (3-5 words)
- Create the branch before any development work begins
- All batches within a task commit to the same branch

---

## Commit Ownership

| Principle                  | Detail                                             |
| -------------------------- | -------------------------------------------------- |
| Agents commit their work   | Each developer agent creates commits for their batch |
| Orchestrator does not commit| The orchestrator coordinates but never writes code  |
| One commit per logical unit| Group related changes, not one commit per file      |
| Atomic commits             | The build must pass after every single commit       |
| Never amend                | Do not amend previous commits during orchestration  |
| Never squash during work   | Squashing is a user decision after task completion  |

---

## Commit Granularity Guidelines

### Too granular (avoid)

```
feat(shared): add ProjectSettings interface
feat(shared): add ProjectSettings type export
feat(shared): add index barrel export for settings
```

### Too coarse (avoid)

```
feat(project): implement entire settings feature with backend, frontend, and tests
```

### Just right

```
feat(cli): add CLI scaffold with package.json and tsconfig
Task: TASK_2026_097
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(cli): implement init command with stack detection
Task: TASK_2026_097
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(cli): implement run command with supervisor spawning
Task: TASK_2026_097
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(cli): add status command with registry parsing
Task: TASK_2026_097
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(orchestration): add completion phase plan.md update step
Task: TASK_2026_097
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

test(cli): add init command integration tests
Task: TASK_2026_097
Agent: nitro-unit-tester
Phase: test
Worker: test-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

---

## Pushing and Remote Operations

### Rules

- **Never auto-push** - The user handles all pushes to remote
- **No force pushes** during orchestration
- The orchestrator may create branches locally
- The user decides when and how to push

### After Task Completion

The orchestrator reports the branch name and commit count. The user then decides:

```bash
# User pushes when ready
git push -u origin task/TASK_2026_014-project-settings-panel
```

---

## Pre-Commit Hook Handling

If a pre-commit hook fails during agent work:

1. **Do not use `--no-verify`** to bypass
2. Read the hook error output
3. Fix the issue (linting, formatting, type errors)
4. Stage the fixes
5. Create a **new** commit (never amend)

### Pre-commit Checks

All commits automatically run these checks in order:

| Check | Tool               | Purpose                         |
| ----- | ------------------ | ------------------------------- |
| 1     | lint-staged        | Format & lint staged files only |
| 2     | typecheck:affected | Type-check changed libraries    |
| 3     | commitlint         | Validate commit message format  |

### Hook Failure Protocol

**CRITICAL**: When a commit hook fails, ALWAYS stop and present this choice:

```markdown
---
Pre-commit hook failed: [specific error message]
---

Please choose how to proceed:

1. **Fix Issue** - I'll fix issue if it's related to current work
   (Use for: lint errors, type errors, commit message format issues in current changes)

2. **Bypass Hook** - Commit with --no-verify flag
   (Use for: Unrelated errors in other files, blocking issues outside current scope)

3. **Stop & Report** - Mark as blocker and escalate
   (Use for: Critical infrastructure issues, complex errors requiring investigation)

## Which option would you like? (1/2/3)
```

### Agent Behavior Rules

- NEVER automatically bypass hooks with `--no-verify`
- NEVER automatically fix issues without user consent
- NEVER proceed with alternative approaches without user decision
- ALWAYS present 3 options and wait for user choice
- ALWAYS document the chosen option if option 2 or 3 is selected

---

## Commit Examples by Strategy

### FEATURE Strategy

```
feat(shared): add task template interfaces and types
Task: TASK_2026_098
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(orchestration): create task-tracking folder structure
Task: TASK_2026_098
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(cli): implement create command with planner integration
Task: TASK_2026_098
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(orchestration): add supervisor skill with worker spawning
Task: TASK_2026_098
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(cli): add status command with plan.md parsing
Task: TASK_2026_098
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

feat(orchestration): add exit gate verification checks
Task: TASK_2026_098
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

test(cli): add create command unit tests
Task: TASK_2026_098
Agent: nitro-unit-tester
Phase: test
Worker: test-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

docs(orchestration): add task template usage guide
Task: TASK_2026_098
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

### BUGFIX Strategy

```
fix(cli): prevent crash when registry.md has empty rows
Task: TASK_2026_099
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

test(cli): add regression test for empty registry handling
Task: TASK_2026_099
Agent: nitro-unit-tester
Phase: test
Worker: test-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

### REFACTORING Strategy

```
refactor(orchestration): consolidate completion phase into single step
Task: TASK_2026_100
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

refactor(cli): extract common preflight checks into shared utility
Task: TASK_2026_100
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

refactor(orchestration): simplify agent catalog capability matrix
Task: TASK_2026_100
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

### DEVOPS Strategy

```
ci(project): add GitHub Actions CI pipeline
Task: TASK_2026_101
Agent: nitro-devops-engineer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

ci(project): configure npm publish workflow
Task: TASK_2026_101
Agent: nitro-devops-engineer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

build(cli): add prepublish scaffold preparation step
Task: TASK_2026_101
Agent: nitro-devops-engineer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

chore(project): update build tooling to latest
Task: TASK_2026_101
Agent: nitro-devops-engineer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

### DOCUMENTATION Strategy

```
docs(project): add architecture overview to README
Task: TASK_2026_102
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

docs(orchestration): add task template usage guide
Task: TASK_2026_102
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)

docs(project): add development setup guide
Task: TASK_2026_102
Agent: nitro-systems-developer
Phase: implementation
Worker: build-worker
Session: SESSION_2026-03-28_10-00-00
Provider: claude
Model: claude-sonnet-4-6
Retry: 0/2
Complexity: Medium
Priority: P1-High
Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)
```

---

## Destructive Commands Warning

**NEVER run these commands** without explicit user request:

| Command             | Risk                      |
| ------------------- | ------------------------- |
| `git reset --hard`  | Loses uncommitted changes |
| `git push --force`  | Overwrites remote history |
| `git rebase --hard` | Can lose commits          |
| `git clean -f`      | Deletes untracked files   |
| `git branch -D`     | Force deletes branch      |
| `git checkout .`    | Discards all changes      |
| `git restore .`     | Discards all changes      |

---

## Integration with Other References

- **team-leader-modes.md**: MODE 2 creates commits following these standards
- **checkpoints.md**: Hook failure protocol is a checkpoint type
- **task-tracking.md**: Document hook bypasses in tasks.md
- **SKILL.md**: Git operations guidance in workflow completion phase
