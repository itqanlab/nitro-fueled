# End-to-End Fresh Project Test — TASK_2026_014

## Context

You are testing the Nitro-Fueled CLI package by initializing it in a fresh project and running the full pipeline. The package source is at `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/`.

## Prerequisites

Before starting, ensure:
1. The MCP session-orchestrator server is configured and running
2. Node.js >= 18 is installed
3. Claude Code CLI is available

## Test Steps

### Step 1: Create a fresh test project

```bash
mkdir /tmp/nitro-test-project && cd /tmp/nitro-test-project
git init
npm init -y
# Add a simple TypeScript file so stack detection has something to find
echo '{"compilerOptions":{"target":"ES2022","module":"NodeNext"}}' > tsconfig.json
mkdir -p src
echo 'export function hello(): string { return "world"; }' > src/index.ts
git add -A && git commit -m "chore: initial project scaffold"
```

### Step 2: Install and run nitro-fueled init

```bash
# Link the local CLI package
cd /Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli && npm link
cd /tmp/nitro-test-project

# Run init
npx nitro-fueled init --yes
```

**Verify:**
- [ ] `.claude/` directory created with agents, skills, commands
- [ ] `task-tracking/` directory created with registry.md and task-template.md
- [ ] `CLAUDE.md` generated at project root
- [ ] `.mcp.json` configured (or setup guide shown)
- [ ] Stack detection identified TypeScript/Node.js
- [ ] No nitro-fueled-specific paths leaked into the scaffolded files (check `.claude/commands/project-status.md` verification table, `.claude/skills/orchestration/SKILL.md` completion phase, example traces)

### Step 3: Test the /plan command

Open Claude Code in the test project and run:
```
/plan Create a simple REST API with Express that has a /health endpoint and a /users CRUD endpoint
```

**Verify:**
- [ ] Planner agent creates task(s) in `task-tracking/registry.md`
- [ ] Task folder(s) created under `task-tracking/TASK_*/`
- [ ] `task-tracking/plan.md` created or updated with phases
- [ ] Tasks have proper status (CREATED) and priority

### Step 4: Test the /orchestrate command (interactive)

```
/orchestrate TASK_XXXX_001
```

**Verify:**
- [ ] Orchestration skill detects task type correctly
- [ ] PM agent creates task-description.md (for FEATURE type)
- [ ] User validation checkpoint presented
- [ ] After approval, architect creates implementation-plan.md
- [ ] Team-leader creates tasks.md with batched sub-tasks
- [ ] Developer agent writes real code (not stubs)
- [ ] QA reviewers create review files
- [ ] Completion phase updates registry.md to COMPLETE
- [ ] Completion phase updates plan.md task status and phase status
- [ ] All three commits created (implementation, QA fixes, bookkeeping)

### Step 5: Test the status command

```bash
npx nitro-fueled status
npx nitro-fueled status --full
```

**Verify:**
- [ ] Brief mode shows one-line summary
- [ ] Full mode shows task table with statuses
- [ ] Completed tasks appear as COMPLETE
- [ ] Plan phase progress displayed

### Step 6: Test the /auto-pilot command (if MCP available)

```
/auto-pilot --dry-run
```

**Verify:**
- [ ] Dry run shows dependency graph
- [ ] Shows which tasks would be spawned as Build Workers
- [ ] MCP connectivity confirmed

### Step 7: Verify no leaks

Run these checks in the test project:
```bash
# Check for nitro-fueled-specific paths that shouldn't be in a fresh project
grep -r "nitro-fueled" .claude/ --include="*.md" | grep -v "nitro-fueled init" | grep -v "# installed by"
grep -r "packages/cli" .claude/ --include="*.md"
```

**Verify:**
- [ ] No references to nitro-fueled internal paths in scaffolded files
- [ ] Example traces use nitro-fueled paths (these are illustrative, that's OK)
- [ ] Operational files (SKILL.md completion phase, project-status verification table) reference generic or project-appropriate paths

## Success Criteria

- All verification checkboxes pass
- A real task was planned, built, reviewed, and completed autonomously
- plan.md was properly updated by the completion phase (this was the bug we fixed)
- No crashes or silent failures

## Known Risks

- MCP server may not be available (Steps 1-5 work without it, Step 6 requires it)
- Stack detection may need tuning for minimal projects
- The init command copies scaffold as-is — project-specific adaptation (like rewriting the project-status verification table) is a future enhancement
