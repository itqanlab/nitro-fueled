---
title: Getting Started
description: Get up and running with Nitro-Fueled in minutes.
---

Nitro-Fueled is a reusable AI orchestration package you install into any project with a single command. Once installed, you write task files describing what needs to be built, then hit run. The system automatically drives a full PM → Architect → Dev → QA pipeline using autonomous Claude Code worker sessions — each running in its own iTerm2 tab with a fresh 1 million token context window. No manual context management, no copy-pasting prompts, no babysitting.

## Key Features

**Full pipeline automation** — Product Manager scopes work, Architect designs the solution, Team-Leader decomposes into batches, Developers implement, Reviewers validate. Every role is a separate agent with a defined scope.

**Autonomous worker sessions** — Each task runs in an isolated Claude Code session. Workers write files, commit code, and update task state without interrupting your main session.

**Parallel execution** — The Supervisor spawns up to 3 concurrent workers by default. Independent tasks run in parallel waves; dependent tasks wait for their prerequisites.

**Stack-aware setup** — `init` reads your `package.json`, `requirements.txt`, `go.mod`, or `Cargo.toml` and generates project-specific developer agents tailored to your framework.

**Task registry and state machine** — Every task moves through defined states (`CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE`) tracked in plain Markdown files you can read and edit directly.

## Prerequisites

Before installing, make sure you have:

- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code` (or the equivalent for your platform)
- **Node.js 18+** — required for the `npx nitro-fueled` CLI
- **iTerm2 (macOS)** — workers open in iTerm2 tabs; iTerm2 must be running when you start Auto-Pilot
- **session-orchestrator MCP server** — the standalone Node.js process that spawns and monitors worker sessions (see [Installation](installation/) for setup)

:::note[MCP Server Dependency]
The `session-orchestrator` MCP server lives in a separate repository. It is **required for Auto-Pilot** (`/auto-pilot`, `npx nitro-fueled run`) because those features spawn workers in separate iTerm2 tabs and need the MCP server to manage those sessions.

Running a pipeline in the **current Claude Code session** (`/orchestrate TASK_ID`, `/plan`) does **not** require the MCP server.
:::

## Where to Go Next

| Step | What You Will Do |
|------|-----------------|
| [Installation](installation/) | Run `npx nitro-fueled init`, configure the MCP server, verify setup |
| [First Run](first-run/) | Write your first task, run the pipeline, read the completion report |
| [Core Concepts](../concepts/) | Understand tasks, workers, and the Supervisor before going further |
