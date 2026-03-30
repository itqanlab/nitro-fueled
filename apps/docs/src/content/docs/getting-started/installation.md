---
title: Installation
description: Install Nitro-Fueled into your project.
---

Nitro-Fueled installs into any project — new or existing — with a single `npx` command. The installer copies the full `.claude/` scaffold and task-tracking structure, detects your tech stack, and generates project-specific developer agents.

## For a New Project

**1. Create your project directory and initialize it:**

```bash
mkdir my-project && cd my-project
git init
```

**2. Run the Nitro-Fueled initializer:**

```bash
npx @itqanlab/nitro-fueled init
```

**3. What happens under the hood:**

The installer runs the following steps automatically:

- Copies all 22 core agents (`nitro-*` prefixed) into `.claude/agents/`
- Copies all skills into `.claude/skills/` (orchestration, auto-pilot, technical-content-writer, ui-ux-designer)
- Copies all slash commands into `.claude/commands/`
- Copies the generic `anti-patterns.md` and empty `review-lessons/` structure
- Creates `task-tracking/` with `registry.md`, `task-template.md`, and a starter `plan.md`
- Reads your project files to detect the tech stack
- Generates project-specific developer agents tailored to your framework
- Configures `.mcp.json` with the `nitro-cortex` server reference

**4. Configure nitro-cortex path:**

Open `.mcp.json` and set the path to the compiled session-orchestrator server:

```json
{
  "mcpServers": {
    "nitro-cortex": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-cortex/dist/index.js"],
      "env": {
        "CLAUDE_HOME": "~/.claude",
        "DEFAULT_MODEL": "claude-sonnet-4-6"
      }
    }
  }
}
```

**5. Verify the installation:**

```bash
npx @itqanlab/nitro-fueled status
```

You should see a project status table with zero tasks and a confirmation that the workspace is configured.

---

## For an Existing Project

The process is identical. `init` will not touch any files outside `.claude/` and `task-tracking/`. Your source code and configuration are not modified.

```bash
cd /path/to/your/existing-project
npx @itqanlab/nitro-fueled init
```

> **Note:** If your project already has a `.claude/` directory with custom agents, `init` places core agents alongside them. Files prefixed with `nitro-` are always overwritable by future `update` commands. Files without the `nitro-` prefix (your project agents) are never touched by `init`.

---

## Tech Stack Detection

`init` reads the following files to determine your stack:

| File | Detected Stack |
|------|---------------|
| `package.json` | Node.js; further detects React, Angular, Vue, Next.js, Express, NestJS |
| `requirements.txt` / `pyproject.toml` | Python; detects FastAPI, Django, Flask |
| `go.mod` | Go |
| `Cargo.toml` | Rust |

When a stack is detected, `init` generates a tailored developer agent. A React + Node.js project gets a `frontend-developer.md` with component patterns and a `backend-developer.md` with Node conventions. If no stack is detected, generic developer agents are generated.

---

## Setting Up nitro-cortex

The `nitro-cortex` is a standalone MCP server that enables the Supervisor to spawn and monitor worker sessions in iTerm2 tabs. It lives in a separate repository.

**Clone and build:**

```bash
git clone https://github.com/your-org/nitro-fueled packages/mcp-cortex
cd packages/mcp-cortex
npm install
npm run build
```

:::note
The `nitro-cortex` repository URL will be published alongside the Nitro-Fueled package. Check the main Nitro-Fueled repository README for the authoritative clone URL.
:::

**Verify the build:**

```bash
node /path/to/packages/mcp-cortex/dist/index.js
# Should print: MCP server listening on stdio
```

Then update `.mcp.json` in your project as shown above.

---

## Troubleshooting

**MCP server not found**

Check that `.mcp.json` points to the compiled `dist/index.js` file, not the source `src/index.ts`. Run `npm run build` in nitro-cortex repo if `dist/` is missing.

**iTerm2 not running**

Workers spawn as iTerm2 tabs. iTerm2 must be running before you start Auto-Pilot or any `/orchestrate` command. The MCP server will attempt a fallback to Terminal.app, but iTerm2 is strongly recommended.

**Permission errors during init**

If `npx @itqanlab/nitro-fueled init` fails with a permissions error, verify that the current user has write access to the project directory. On macOS, you may need to run `xcode-select --install` if native build tools are missing.

**Conflicting agent names**

If you have existing `.claude/agents/` files prefixed with `nitro-`, those files will be refreshed by `init`. Back up any manually customized `nitro-*` agents before running `init` on an existing Nitro-Fueled setup.

---

## See Also

- [First Run](first-run/) — Write your first task and run the pipeline
- [Auto-Pilot Guide](../auto-pilot/) — Configure and run the Supervisor loop
- [Commands Reference](../commands/) — All CLI and slash commands
