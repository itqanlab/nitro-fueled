import { Injectable } from '@nestjs/common';

export type TaskType = 'FEATURE' | 'BUGFIX' | 'REFACTORING' | 'DOCUMENTATION' | 'RESEARCH' | 'DEVOPS' | 'CREATIVE' | 'CONTENT';
export type Priority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';
export type Complexity = 'Simple' | 'Medium' | 'Complex';

export interface CreateTaskOverrides {
  type?: TaskType;
  priority?: Priority;
  complexity?: Complexity;
  model?: string;
  dependencies?: string[];
}

export interface CreateTaskRequest {
  description: string;
  overrides?: CreateTaskOverrides;
}

export interface CreatedTask {
  taskId: string;
  title: string;
  status: 'CREATED';
  folder: string;
}

export interface CreateTaskResponse {
  tasks: CreatedTask[];
  autoSplit?: boolean;
}

const KEYWORD_TYPE_MAP: ReadonlyArray<{ pattern: RegExp; type: TaskType }> = [
  { pattern: /\b(fix|bug|error|broken|crash|issue|problem|fail|regression)\b/i, type: 'BUGFIX' },
  { pattern: /\b(refactor|cleanup|clean up|restructure|reorganize|simplify)\b/i, type: 'REFACTORING' },
  { pattern: /\b(document|readme|guide|wiki|docs?)\b/i, type: 'DOCUMENTATION' },
  { pattern: /\b(research|investigate|explore|spike|poc|proof of concept)\b/i, type: 'RESEARCH' },
  { pattern: /\b(deploy|pipeline|ci|cd|docker|kubernetes|infra|infrastructure|devops)\b/i, type: 'DEVOPS' },
  { pattern: /\b(design|mockup|style|visual|creative|brand|logo)\b/i, type: 'CREATIVE' },
];

const COMPLEXITY_THRESHOLD_COMPLEX = 500;
const COMPLEXITY_THRESHOLD_MEDIUM = 150;

const MOCK_TASK_COUNTER_START = 200;

@Injectable()
export class TasksService {
  private mockCounter = MOCK_TASK_COUNTER_START;

  public create(req: CreateTaskRequest): CreateTaskResponse {
    const type = req.overrides?.type ?? this.detectType(req.description);
    const complexity = req.overrides?.complexity ?? this.detectComplexity(req.description);
    const autoSplit = complexity === 'Complex' && !req.overrides?.complexity;

    if (autoSplit) {
      return this.buildAutoSplitResponse(req.description, type, req.overrides);
    }

    const task = this.buildMockTask(req.description, type, req.overrides?.priority ?? 'P2-Medium', complexity);
    return { tasks: [task] };
  }

  private buildAutoSplitResponse(
    description: string,
    type: TaskType,
    overrides?: CreateTaskOverrides,
  ): CreateTaskResponse {
    const baseTitle = this.extractTitle(description);
    const tasks: CreatedTask[] = [
      this.buildMockTask(`${baseTitle} — Part 1: Backend`, type, overrides?.priority ?? 'P2-Medium', 'Medium'),
      this.buildMockTask(`${baseTitle} — Part 2: Frontend`, type, overrides?.priority ?? 'P2-Medium', 'Medium'),
    ];
    return { tasks, autoSplit: true };
  }

  private buildMockTask(
    description: string,
    type: TaskType,
    priority: Priority,
    complexity: Complexity,
  ): CreatedTask {
    const year = new Date().getFullYear();
    const id = ++this.mockCounter;
    const taskId = `TASK_${year}_${String(id).padStart(3, '0')}`;
    const title = this.extractTitle(description);
    return {
      taskId,
      title,
      status: 'CREATED',
      folder: `task-tracking/${taskId}/`,
    };
  }

  private detectType(description: string): TaskType {
    const match = KEYWORD_TYPE_MAP.find((entry) => entry.pattern.test(description));
    return match?.type ?? 'FEATURE';
  }

  private detectComplexity(description: string): Complexity {
    const len = description.trim().length;
    if (len > COMPLEXITY_THRESHOLD_COMPLEX) return 'Complex';
    if (len > COMPLEXITY_THRESHOLD_MEDIUM) return 'Medium';
    return 'Simple';
  }

  private extractTitle(description: string): string {
    const first = description.trim().split(/[.\n]/)[0] ?? description.trim();
    return first.length > 80 ? first.slice(0, 77) + '...' : first;
  }
}
