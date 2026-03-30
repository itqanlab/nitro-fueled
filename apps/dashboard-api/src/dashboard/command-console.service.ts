import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PipelineService } from './pipeline.service';

export interface CommandCatalogEntry {
  readonly name: string;
  readonly slashCommand: string;
  readonly description: string;
  readonly category: string;
  readonly args?: readonly string[];
}

export interface CommandSuggestion {
  readonly command: string;
  readonly label: string;
  readonly reason: string;
}

export interface CommandExecuteRequest {
  readonly command: string;
  readonly args?: Record<string, unknown>;
}

export interface CommandExecuteResult {
  readonly success: boolean;
  readonly output: string;
  readonly data?: Record<string, unknown>;
}

const COMMAND_CATALOG: readonly CommandCatalogEntry[] = [
  {
    name: 'nitro-status',
    slashCommand: '/nitro-status',
    description: 'Show compact project status report',
    category: 'status',
  },
  {
    name: 'nitro-project-status',
    slashCommand: '/nitro-project-status',
    description: 'Generate a verified project status report',
    category: 'status',
  },
  {
    name: 'nitro-auto-pilot',
    slashCommand: '/nitro-auto-pilot',
    description: 'Start the Supervisor loop for task processing',
    category: 'execution',
    args: ['taskId', 'dryRun', 'concurrency', 'interval'],
  },
  {
    name: 'nitro-orchestrate',
    slashCommand: '/nitro-orchestrate',
    description: 'Orchestrate development workflow for a task',
    category: 'execution',
    args: ['taskId'],
  },
  {
    name: 'nitro-create-task',
    slashCommand: '/nitro-create-task',
    description: 'Create a new task with pre-filled template',
    category: 'creation',
  },
  {
    name: 'nitro-create',
    slashCommand: '/nitro-create',
    description: 'Create project artifacts',
    category: 'creation',
  },
  {
    name: 'nitro-burn',
    slashCommand: '/nitro-burn',
    description: 'Show token and cost burn analytics',
    category: 'analytics',
    args: ['since', 'taskId'],
  },
  {
    name: 'nitro-run',
    slashCommand: '/nitro-run',
    description: 'Run a command or script',
    category: 'execution',
  },
  {
    name: 'nitro-plan',
    slashCommand: '/nitro-plan',
    description: 'Plan orchestration strategy',
    category: 'planning',
  },
  {
    name: 'nitro-orchestrate-help',
    slashCommand: '/nitro-orchestrate-help',
    description: 'Quick reference for orchestrator commands',
    category: 'help',
  },
  {
    name: 'nitro-review-code',
    slashCommand: '/nitro-review-code',
    description: 'Run code style review',
    category: 'review',
  },
  {
    name: 'nitro-review-logic',
    slashCommand: '/nitro-review-logic',
    description: 'Run code logic review',
    category: 'review',
  },
  {
    name: 'nitro-review-security',
    slashCommand: '/nitro-review-security',
    description: 'Run security review',
    category: 'review',
  },
  {
    name: 'nitro-create-agent',
    slashCommand: '/nitro-create-agent',
    description: 'Create a new agent definition',
    category: 'creation',
  },
  {
    name: 'nitro-create-skill',
    slashCommand: '/nitro-create-skill',
    description: 'Create a new skill definition',
    category: 'creation',
  },
  {
    name: 'nitro-initialize-workspace',
    slashCommand: '/nitro-initialize-workspace',
    description: 'Initialize workspace with required structure',
    category: 'setup',
  },
  {
    name: 'nitro-evaluate-agent',
    slashCommand: '/nitro-evaluate-agent',
    description: 'Evaluate an agent against benchmarks',
    category: 'analytics',
  },
  {
    name: 'nitro-retrospective',
    slashCommand: '/nitro-retrospective',
    description: 'Run a retrospective on completed work',
    category: 'analytics',
  },
];

const SUGGESTION_MAP: Record<string, readonly CommandSuggestion[]> = {
  '/': [
    { command: '/nitro-status', label: 'Project Status', reason: 'View overall project status' },
    { command: '/nitro-auto-pilot', label: 'Run Auto-Pilot', reason: 'Start processing tasks' },
    { command: '/nitro-burn', label: 'View Costs', reason: 'Check token and cost usage' },
  ],
  '/tasks': [
    { command: '/nitro-create-task', label: 'Create Task', reason: 'Add a new task to the backlog' },
    { command: '/nitro-status', label: 'Project Status', reason: 'Check task status overview' },
  ],
  '/tasks/': [
    { command: '/nitro-orchestrate', label: 'Orchestrate Task', reason: 'Run orchestration for this task' },
    { command: '/nitro-auto-pilot', label: 'Auto-Pilot Task', reason: 'Process this task with auto-pilot' },
    { command: '/nitro-burn', label: 'Task Costs', reason: 'View cost details for this task' },
  ],
  '/sessions': [
    { command: '/nitro-auto-pilot', label: 'Run Auto-Pilot', reason: 'Start or resume a session' },
    { command: '/nitro-status', label: 'Project Status', reason: 'Check overall status' },
  ],
  '/analytics': [
    { command: '/nitro-burn', label: 'View Costs', reason: 'Detailed cost analytics' },
    { command: '/nitro-evaluate-agent', label: 'Evaluate Agent', reason: 'Run agent benchmarks' },
  ],
};

@Injectable()
export class CommandConsoleService {
  private readonly logger = new Logger(CommandConsoleService.name);
  private readonly commandsDir: string;
  private readonly catalog: readonly CommandCatalogEntry[];

  public constructor(private readonly pipelineService: PipelineService) {
    this.commandsDir = path.resolve(process.cwd(), '.claude', 'commands');
    this.catalog = this.loadCatalog();
  }

  public getCatalog(): readonly CommandCatalogEntry[] {
    return this.catalog;
  }

  public getSuggestions(route?: string, taskId?: string): readonly CommandSuggestion[] {
    const results: CommandSuggestion[] = [];

    if (route) {
      const normalizedRoute = route.replace(/\/$/, '') || '/';
      for (const [pattern, suggestions] of Object.entries(SUGGESTION_MAP)) {
        if (normalizedRoute === pattern || normalizedRoute.startsWith(pattern)) {
          results.push(...suggestions);
        }
      }
    }

    if (taskId) {
      results.push(
        { command: `/nitro-orchestrate ${taskId}`, label: `Orchestrate ${taskId}`, reason: 'Run this specific task' },
        { command: `/nitro-auto-pilot ${taskId}`, label: `Auto-Pilot ${taskId}`, reason: 'Process this task' },
      );
    }

    if (results.length === 0) {
      return SUGGESTION_MAP['/'];
    }

    const seen = new Set<string>();
    return results.filter((s) => {
      if (seen.has(s.command)) return false;
      seen.add(s.command);
      return true;
    });
  }

  public async executeCommand(request: CommandExecuteRequest): Promise<CommandExecuteResult> {
    const commandName = request.command.replace(/^\//, '').split(' ')[0];
    const commandEntry = COMMAND_CATALOG.find((c) => c.name === commandName);

    if (!commandEntry) {
      return {
        success: false,
        output: `Unknown command: ${request.command}. Type /nitro-orchestrate-help to see available commands.`,
      };
    }

    switch (commandName) {
      case 'nitro-status':
        return this.executeStatus();
      case 'nitro-burn':
        return this.executeBurn();
      default:
        return {
          success: false,
          output: `Command "${request.command}" is available in the CLI but not yet supported in the dashboard console. Use the terminal to run this command.`,
        };
    }
  }

  private loadCatalog(): readonly CommandCatalogEntry[] {
    return COMMAND_CATALOG.map((entry) => {
      const mdPath = path.join(this.commandsDir, `${entry.name}.md`);
      let description = entry.description;
      try {
        const content = fs.readFileSync(mdPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.length > 0) {
            description = trimmed.replace(/^[-*>]+\s*/, '').slice(0, 120);
            break;
          }
        }
      } catch {
        this.logger.debug(`Command md not found for ${entry.name}, using static description`);
      }
      return { ...entry, description };
    });
  }

  private executeStatus(): CommandExecuteResult {
    try {
      const registry = this.pipelineService.getRegistry();
      const byStatus: Record<string, number> = {};
      for (const task of registry) {
        byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      }

      const lines: string[] = [
        '# Project Status',
        `**Generated:** ${new Date().toISOString()}`,
        '',
        '## Summary',
        `**Total:** ${registry.length}`,
      ];

      for (const [status, count] of Object.entries(byStatus)) {
        lines.push(`- **${status}**: ${count}`);
      }

      const active = registry.filter((t) => !['COMPLETE', 'CANCELLED'].includes(t.status));
      if (active.length > 0) {
        lines.push('', '## Active Tasks');
        lines.push('| Task ID | Status | Type | Description |');
        lines.push('|---------|--------|------|-------------|');
        for (const t of active) {
          lines.push(`| ${this.escapeMarkdownCell(t.id)} | ${this.escapeMarkdownCell(t.status)} | ${this.escapeMarkdownCell(t.type)} | ${this.escapeMarkdownCell(t.description.slice(0, 50))} |`);
        }
      }

      return {
        success: true,
        output: lines.join('\n'),
        data: { total: registry.length, byStatus },
      };
    } catch (err) {
      return {
        success: false,
        output: `Failed to retrieve project status: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private executeBurn(): CommandExecuteResult {
    try {
      const stats = this.pipelineService.getStats();
      const lines: string[] = [
        '# Token & Cost Burn',
        '',
        `**Total Cost:** $${stats.totalCost.toFixed(4)}`,
        `**Total Tokens:** ${stats.totalTokens.toLocaleString()}`,
        `**Total Tasks:** ${stats.totalTasks}`,
        '',
        '## Cost by Model',
      ];

      for (const [model, cost] of Object.entries(stats.costByModel)) {
        lines.push(`- **${model}**: $${cost.toFixed(4)}`);
      }

      return {
        success: true,
        output: lines.join('\n'),
        data: { totalCost: stats.totalCost, totalTokens: stats.totalTokens },
      };
    } catch (err) {
      return {
        success: false,
        output: `Failed to retrieve burn data: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private escapeMarkdownCell(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/[`*_{}\[\]()#+.!-]/g, '\\$&')
      .replace(/[\r\n]+/g, ' ');
  }
}
