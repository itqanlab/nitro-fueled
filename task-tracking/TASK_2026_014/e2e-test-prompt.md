# End-to-End Fresh Project Test — TASK_2026_014

## Goal

Test nitro-fueled as a package user would: create a new project, install the tool, and use it to build a landing page.

## Steps

### 1. Create the project

```bash
mkdir ~/my-portfolio && cd ~/my-portfolio
git init
npm init -y
echo '{"compilerOptions":{"target":"ES2022","module":"NodeNext"}}' > tsconfig.json
git add -A && git commit -m "chore: initial scaffold"
```

### 2. Install nitro-fueled

```bash
# Link from local dev (or npm install nitro-fueled once published)
cd /Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli && npm link
cd ~/my-portfolio
npx nitro-fueled init
```

### 3. Open Claude Code and plan the work

```
/plan Create a simple landing page for a software engineer working as a full stack developer with Angular and Node.js
```

### 4. Run the task

Either interactively:
```
/orchestrate TASK_XXXX_001
```

Or autonomously (requires MCP session-orchestrator):
```
/auto-pilot TASK_XXXX_001
```

### 5. Check progress

```bash
npx nitro-fueled status
```

## What to validate

- [ ] `init` scaffolded .claude/, task-tracking/, CLAUDE.md correctly
- [ ] Stack detection found TypeScript/Node.js
- [ ] `/plan` created a task in the registry
- [ ] `/orchestrate` ran the full PM -> Architect -> Dev -> QA flow
- [ ] Completion phase updated both registry.md and plan.md
- [ ] Final output is a real landing page (not stubs)
