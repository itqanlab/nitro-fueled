import { ProviderGroup } from '../models/new-task.model';

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
