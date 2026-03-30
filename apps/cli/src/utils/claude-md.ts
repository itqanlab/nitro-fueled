import { existsSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

export function generateClaudeMd(cwd: string, overwrite: boolean): boolean {
  const claudeMdPath = resolve(cwd, 'CLAUDE.md');

  if (existsSync(claudeMdPath) && !overwrite) {
    console.log('  CLAUDE.md already exists (skipped). Use --overwrite to replace.');
    return true;
  }

  const projectName = basename(resolve(cwd)) || 'project';

  const content = `# ${projectName}

## Project Structure
\`\`\`
.claude/
  agents/       # Agent definitions (core + project-specific developers)
  skills/       # Orchestration skills (auto-pilot, orchestration, etc.)
  commands/     # Slash commands (/orchestrate, /plan, /create-task, etc.)
  review-lessons/  # Accumulated QA findings (grows over time)
  anti-patterns.md # Common pitfalls checklist
task-tracking/
  registry.md   # Task index with statuses
  task-template.md  # Template for new tasks
\`\`\`

## Orchestration
This project uses [Nitro-Fueled](https://github.com/anthropics/nitro-fueled) for AI-assisted development orchestration.

### Quick Start
\`\`\`bash
npx nitro-fueled create          # Create a new task (interactive)
npx nitro-fueled run             # Auto-pilot: process task backlog
npx nitro-fueled run TASK_ID     # Run a specific task
npx nitro-fueled status          # Show project status
\`\`\`

### Task States
CREATED -> IN_PROGRESS -> IMPLEMENTED -> IN_REVIEW -> FIXING -> COMPLETE (or FAILED/BLOCKED/CANCELLED)

## Task Status Queries
- When asked about project status, remaining tasks, what's next, or any task-related question:
  1. **Run \`npx nitro-fueled status\`** first — this rebuilds \`task-tracking/registry.md\` from all status files on disk
  2. **Then read \`task-tracking/registry.md\` ONLY** — do NOT read individual \`task.md\` files
- The registry contains all task IDs, statuses, types, and descriptions — that is sufficient for status queries.

## Conventions
- Git: conventional commits with scopes
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | FIXING | COMPLETE | FAILED | BLOCKED | CANCELLED
- Do NOT start git commit/push without explicit user instruction
`;

  try {
    writeFileSync(claudeMdPath, content, 'utf-8');
    console.log('  CLAUDE.md generated');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: Could not write CLAUDE.md: ${msg}`);
    return false;
  }
  return true;
}
