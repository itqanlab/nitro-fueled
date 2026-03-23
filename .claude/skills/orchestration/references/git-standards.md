# Git Standards Reference

Git conventions for orchestrated task execution.

**CRITICAL**: All commits MUST follow these rules to pass pre-commit hooks.

---

## Commit Message Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Format Rules

| Component | Rule                                                        |
| --------- | ----------------------------------------------------------- |
| Type      | Required, lowercase, from allowed list                      |
| Scope     | Required, lowercase, from allowed list                      |
| Subject   | Required, lowercase, 3-72 chars, no period, imperative mood |
| Header    | Max 100 characters total (type + scope + subject)           |
| Body      | Optional, max 100 chars per line, explain "why" not "what"  |
| Footer    | Optional, max 100 chars per line, reference task IDs        |

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

| Scope           | Domain                                              | Example Files                                     |
| --------------- | --------------------------------------------------- | ------------------------------------------------- |
| `project`       | Project-wide configuration, workspace settings      | nx.json, tsconfig.base.json                       |
| `task`          | Task tracking, orchestration artifacts              | task-tracking/\*                                  |
| `library`       | Nx library creation or configuration                | libs/\*/project.json                              |
| `provider`      | AI provider integrations                            | libs/main-process/providers/\*                    |
| `orchestration` | Orchestration system, agent configurations          | .claude/skills/\*, .claude/agents/\*              |
| `ui`            | Angular components, templates, styles               | libs/renderer/\*, apps/renderer/\*                |
| `db`            | SQLite, LanceDB, database schemas and operations    | libs/main-process/db/\*                           |
| `sync`          | File watching, synchronization, chokidar            | libs/main-process/sync/\*                         |
| `theme`         | Theming, dark/light mode, design tokens             | libs/renderer/theme/\*                            |
| `electron`      | Electron main process, IPC, window management       | apps/desktop/\*, libs/main-process/\*             |
| `renderer`      | Renderer process services, Angular app bootstrap    | apps/renderer/\*, libs/renderer/\*                |
| `shared`        | Shared libraries, interfaces, types, utilities      | libs/shared/\*                                    |

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

---

## Developer Commit Patterns

Each developer agent uses specific type+scope combinations based on their domain.

### backend-developer

```
feat(shared): add project settings interface and types
feat(db): create settings table with migration
feat(electron): implement settings IPC handlers
fix(electron): handle null config values on first launch
refactor(shared): extract common validation utilities
```

### frontend-developer

```
feat(ui): add settings panel component with form controls
feat(renderer): create settings signal store
feat(theme): add custom color palette tokens
feat(ui): implement responsive sidebar layout
fix(ui): correct NG-ZORRO select dropdown alignment
refactor(renderer): migrate settings service to signals
style(ui): apply consistent spacing to form sections
```

### devops-engineer

```
ci(electron): add macOS code signing to build pipeline
build(project): configure Nx caching for CI
chore(electron): update Electron Forge to v7
ci(project): add GitHub Actions workflow for PR checks
build(renderer): optimize Angular production build config
```

---

## Valid Examples

```bash
feat(ui): add semantic search for chat messages
fix(electron): resolve IPC communication timeout issue
docs(orchestration): update agent catalog references
refactor(renderer): simplify settings store computed signals
chore(project): update @angular/core to v19.1.2
perf(ui): optimize message list rendering with virtual scroll
test(electron): add unit tests for IPC handlers
build(project): upgrade esbuild to v0.20.0
ci(project): add parallel test execution
style(ui): format chat component files
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
feat(shared): add project settings interfaces and type exports
feat(db): create settings table with CRUD operations
feat(electron): implement settings IPC handlers with validation
feat(renderer): create settings signal store with IPC integration
feat(ui): add settings panel with theme and path configuration
test(renderer): add settings store unit tests
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

1. **Fix Issue** - I'll fix the issue if it's related to current work
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
- ALWAYS present the 3 options and wait for user choice
- ALWAYS document the chosen option if option 2 or 3 is selected

---

## Commit Examples by Strategy

### FEATURE Strategy

```
feat(shared): add task model interfaces
feat(db): create tasks table with indexes
feat(electron): implement task CRUD IPC handlers
feat(renderer): create task list signal store
feat(ui): add task list page with filtering
feat(ui): add task detail panel with CodeMirror editor
test(renderer): add task store unit tests
docs(shared): add TSDoc to task interfaces
```

### BUGFIX Strategy

```
fix(electron): prevent window crash on invalid project path
test(electron): add regression test for invalid path handling
```

### REFACTORING Strategy

```
refactor(renderer): migrate observable services to signal-based
refactor(ui): convert settings module to standalone components
refactor(shared): consolidate duplicate type definitions
```

### DEVOPS Strategy

```
ci(project): add GitHub Actions CI pipeline
ci(electron): configure auto-update publishing
build(electron): add DMG and NSIS installer configuration
chore(project): update Nx to v19
```

### DOCUMENTATION Strategy

```
docs(project): add architecture overview
docs(shared): add API reference for IPC channels
docs(electron): add development setup guide
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
