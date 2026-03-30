# MCP nitro-cortex — Design Document

## Overview

A standalone, reusable MCP server that enables a Claude Code session (orchestrator) to spawn, monitor, and manage multiple autonomous Claude Code worker sessions. Each worker runs in its own iTerm2 tab with a fresh 1M context window.

## Problem

- Running orchestrated tasks burns excessive tokens in a single session (2M+ for one task)
- No visibility into worker token usage, context %, or progress from orchestrator
- Manual session management — opening terminals, copy-pasting prompts, switching tabs
- No way to run parallel tasks with oversight

## Solution

```
┌─────────────────────────────────────────────────┐
│  MCP Server: nitro-cortex                       │
│  (standalone Node.js process)                   │
│                                                 │
│  ┌─────────────┐  ┌──────────────┐              │
│  │ Session Mgr  │  │ JSONL Watcher │             │
│  │ spawn/kill   │  │ (chokidar)    │             │
│  └──────┬──────┘  └──────┬───────┘              │
│         │                │                       │
│  ┌──────▼────────────────▼───────┐              │
│  │        Worker Registry         │              │
│  │  session_id → { pid, stats,   │              │
│  │    status, tokens, activity } │              │
│  └───────────────────────────────┘              │
└────────────────────┬────────────────────────────┘
                     │ MCP protocol (stdio)
┌────────────────────▼────────────────────────────┐
│  Orchestrator Session (your Claude Code)         │
│  Calls: spawn_worker, list_workers,              │
│         get_worker_stats, kill_worker             │
└──────────┬──────────────┬───────────────────────┘
           │              │
     ┌─────▼─────┐  ┌────▼──────┐
     │ iTerm Tab  │  │ iTerm Tab  │
     │ Worker A   │  │ Worker B   │
     │ (T80)      │  │ (T84)      │
     └────────────┘  └────────────┘
```

## Project Structure

```
session-orchestrator/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── tools/
│   │   ├── spawn-worker.ts      # Spawn new Claude session in iTerm2
│   │   ├── list-workers.ts      # List all active/completed workers
│   │   ├── get-worker-stats.ts  # Token usage, context %, progress
│   │   ├── get-worker-activity.ts # Recent actions summary
│   │   └── kill-worker.ts       # Terminate a worker session
│   ├── core/
│   │   ├── worker-registry.ts   # In-memory worker state
│   │   ├── jsonl-watcher.ts     # Watch & parse JSONL conversation files
│   │   ├── iterm-launcher.ts    # iTerm2 AppleScript integration
│   │   └── token-calculator.ts  # Token counting from usage data
│   └── types.ts                 # Shared types
└── README.md
```

## MCP Tools

### 1. `spawn_worker`

Spawns a new Claude Code session in a new iTerm2 tab.

```typescript
{
  name: 'spawn_worker',
  description: 'Spawn a new autonomous Claude Code session in an iTerm2 tab',
  parameters: {
    prompt: string,          // The full prompt to send (e.g., /orchestrate T80...)
    working_directory: string, // Project directory to run in
    label: string,           // Human-readable label (e.g., "T80-Dashboard")
    model?: string,          // Model override (default: current model)
    allowed_tools?: string[], // Tool whitelist (default: all via --dangerously-skip-permissions)
  },
  returns: {
    worker_id: string,       // UUID for tracking
    pid: number,             // Process ID
    session_id: string,      // Claude session UUID (from ~/.claude/sessions/)
    iterm_tab: string,       // iTerm tab identifier
  }
}
```

**Implementation:**
```typescript
// Uses AppleScript to open new iTerm2 tab with claude command
const script = `
tell application "iTerm"
  tell current window
    create tab with default profile
    tell current session
      set name to "${label}"
      write text "cd '${workingDirectory}' && claude --dangerously-skip-permissions --model ${model} -p '${escapedPrompt}'"
    end tell
  end tell
end tell
`;
```

### 2. `list_workers`

Lists all tracked worker sessions with current status.

```typescript
{
  name: 'list_workers',
  description: 'List all active and recently completed worker sessions',
  parameters: {
    status_filter?: 'active' | 'completed' | 'failed' | 'all'  // default: 'all'
  },
  returns: {
    workers: [{
      worker_id: string,
      label: string,
      status: 'running' | 'completed' | 'failed' | 'killed',
      pid: number,
      started_at: string,
      duration_minutes: number,
      total_tokens: number,
      context_percent: number,
      cost_estimate_usd: number,
    }]
  }
}
```

### 3. `get_worker_stats`

Detailed token and progress breakdown for a specific worker.

```typescript
{
  name: 'get_worker_stats',
  description: 'Get detailed token usage and progress for a worker session',
  parameters: {
    worker_id: string,
  },
  returns: {
    worker_id: string,
    label: string,
    status: string,
    tokens: {
      total_input: number,
      total_output: number,
      total_cache_creation: number,
      total_cache_read: number,
      total_combined: number,     // sum of all
      context_current_k: number,  // estimated current context size in K
      context_percent: number,    // % of 1M used
      compaction_count: number,   // how many times context was compacted
    },
    cost: {
      input_usd: number,
      output_usd: number,
      total_usd: number,
    },
    progress: {
      message_count: number,
      tool_calls: number,
      files_read: string[],       // unique files read
      files_written: string[],    // unique files created/modified
      last_action: string,        // last tool call summary
      elapsed_minutes: number,
    },
    health: 'healthy' | 'high_context' | 'compacting' | 'stuck' | 'finished',
  }
}
```

### 4. `get_worker_activity`

Compact summary of recent worker actions (last N messages). Designed to be context-efficient for the orchestrator.

```typescript
{
  name: 'get_worker_activity',
  description: 'Get compact summary of recent worker actions (context-efficient)',
  parameters: {
    worker_id: string,
    last_n_messages?: number,  // default: 10
  },
  returns: {
    summary: string,  // 5-10 line compact summary
    // Example:
    // "Worker T80-Dashboard (running 12m, 45% ctx, $1.20):
    //  - PM agent completed task-description.md (320 lines)
    //  - Architect agent started, reading implementation-plan refs
    //  - Files written: task-description.md, context.md
    //  - Last action: Read(docs/32-agent-runtime-architecture.md)
    //  - Health: healthy"
  }
}
```

### 5. `kill_worker`

Terminate a worker session.

```typescript
{
  name: 'kill_worker',
  description: 'Terminate a worker session (sends SIGTERM, then SIGKILL after 5s)',
  parameters: {
    worker_id: string,
    reason?: string,  // logged for tracking
  },
  returns: {
    success: boolean,
    final_stats: { /* same as get_worker_stats */ }
  }
}
```

## JSONL Watcher Design

The watcher monitors `~/.claude/projects/<project-hash>/*.jsonl` for changes using chokidar.

```typescript
// Watches for new lines appended to JSONL files
class JsonlWatcher {
  // Map of session_id → parsed state
  private sessions: Map<string, SessionState>;

  // On new line appended to a watched JSONL:
  onNewMessage(sessionId: string, message: JsonlMessage) {
    if (message.type === 'assistant') {
      // Extract token usage
      this.updateTokens(sessionId, message.message.usage);
      // Track tool calls from content blocks
      this.trackToolCalls(sessionId, message.message.content);
    }
    if (message.type === 'user') {
      // Track user/system messages
      this.trackActivity(sessionId, message);
    }
  }

  // Detect compaction: context size drops significantly between turns
  detectCompaction(sessionId: string): boolean {
    const history = this.sessions.get(sessionId).tokenHistory;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    // If input tokens dropped by >30%, compaction happened
    return prev && last.input_tokens < prev.input_tokens * 0.7;
  }
}
```

### Session Discovery

To link a PID to a JSONL file:

```typescript
// 1. Read ~/.claude/sessions/<pid>.json → get sessionId
// 2. Find JSONL at ~/.claude/projects/<project-hash>/<sessionId>.jsonl
// 3. Start watching that file

function discoverSession(pid: number, projectPath: string): string {
  const sessionMeta = readJson(`~/.claude/sessions/${pid}.json`);
  const projectHash = projectPath.replace(/\//g, '-').replace(/^-/, '');
  const jsonlPath = `~/.claude/projects/${projectHash}/${sessionMeta.sessionId}.jsonl`;
  return jsonlPath;
}
```

## Token Cost Calculation

Based on Claude Opus 4.6 pricing (update as needed):

```typescript
const PRICING = {
  'claude-opus-4-6': {
    input_per_mtok: 15.00,
    output_per_mtok: 75.00,
    cache_creation_per_mtok: 18.75,
    cache_read_per_mtok: 1.50,
  },
  // Add other models as needed
};

function calculateCost(usage: TokenUsage, model: string): number {
  const p = PRICING[model];
  return (
    (usage.input_tokens / 1_000_000) * p.input_per_mtok +
    (usage.output_tokens / 1_000_000) * p.output_per_mtok +
    (usage.cache_creation_input_tokens / 1_000_000) * p.cache_creation_per_mtok +
    (usage.cache_read_input_tokens / 1_000_000) * p.cache_read_per_mtok
  );
}
```

## Health Detection

```typescript
function assessHealth(stats: WorkerStats): HealthStatus {
  if (!isProcessRunning(stats.pid)) return 'finished';
  if (stats.tokens.compaction_count >= 2) return 'compacting';
  if (stats.tokens.context_percent > 80) return 'high_context';
  if (stats.progress.last_action_age_seconds > 120) return 'stuck';
  return 'healthy';
}
```

## MCP Configuration

Add to any project's `~/.claude/mcp_config.json` or per-project `.mcp.json`:

```json
{
  "mcpServers": {
    "session-orchestrator": {
      "command": "node",
      "args": ["/path/to/session-orchestrator/dist/index.js"],
      "env": {
        "CLAUDE_HOME": "~/.claude",
        "DEFAULT_MODEL": "claude-sonnet-4-6"
      }
    }
  }
}
```

## Concurrency

- No limit on concurrent workers — each is an independent process + iTerm tab
- Worker registry tracks all of them
- `list_workers` shows all active sessions at a glance
- Orchestrator decides how many to run based on:
  - API rate limits (concurrent requests)
  - Machine resources (each claude process uses ~200-500MB RAM)
  - Cost budget

## Reusability

The MCP server is project-agnostic:
- No hardcoded paths or project-specific logic
- `working_directory` parameter in `spawn_worker` sets the project
- JSONL discovery uses the project path to find the right conversation files
- Can be published as an npm package or kept as a local tool

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Worker crashes mid-task | PID disappears → status = 'failed', final stats preserved |
| Worker hits rate limit | Detected via long gaps in JSONL → health = 'stuck' |
| iTerm not running | Fallback: open Terminal.app instead |
| Multiple projects | Each spawn_worker call specifies working_directory |
| Session JSONL not found yet | Poll with 1s interval for up to 10s after spawn |
| Worker finishes normally | PID disappears, last JSONL message has stop_reason → status = 'completed' |

## Future Enhancements

1. **Auto-kill on budget** — kill worker if cost exceeds threshold
2. **Auto-respawn** — if worker fails, respawn with same prompt + error context
3. **Progress webhooks** — notify orchestrator of milestones (file written, agent changed)
4. **Dashboard UI** — web-based dashboard showing all workers (stretch goal)
5. **Prompt templates** — pre-built prompts for common orchestration patterns
6. **Log persistence** — save worker stats to SQLite for historical analysis
