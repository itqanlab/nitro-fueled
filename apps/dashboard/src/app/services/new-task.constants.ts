import type { TaskCreationComplexity, TaskPriority, TaskType } from '../models/api.types';
import type { ProviderGroup } from '../models/new-task.model';

export const TASK_TYPES: readonly TaskType[] = [
  'FEATURE',
  'BUGFIX',
  'REFACTORING',
  'DOCUMENTATION',
  'RESEARCH',
  'DEVOPS',
  'CREATIVE',
  'CONTENT',
];

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  'P0-Critical',
  'P1-High',
  'P2-Medium',
  'P3-Low',
];

export const TASK_COMPLEXITIES: readonly TaskCreationComplexity[] = [
  'Simple',
  'Medium',
  'Complex',
];

export const MOCK_PROVIDER_GROUPS: readonly ProviderGroup[] = [
  {
    provider: 'Anthropic',
    models: ['Claude Opus 4', 'Claude Sonnet 4', 'Claude Haiku 4'],
  },
  {
    provider: 'OpenAI',
    models: ['GPT-4o', 'Codex Mini'],
  },
];
