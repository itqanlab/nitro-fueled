import {
  ApiKeyEntry,
  LauncherEntry,
  ModelMapping,
  SettingsState,
  SubscriptionEntry,
} from '../models/settings.model';

export const MOCK_API_KEYS: readonly ApiKeyEntry[] = [
  {
    id: 'key-001',
    key: 'sk-ant-••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••ABCD',
    provider: 'Anthropic',
    status: 'valid',
    isActive: true,
    detectedModels: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'key-002',
    key: 'sk-••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••EFGH',
    provider: 'OpenAI',
    status: 'valid',
    isActive: true,
    detectedModels: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  },
  {
    id: 'key-003',
    key: 'AIza••••••••••••••••••••••••••••••••••••••IJKL',
    provider: 'Google',
    status: 'untested',
    isActive: false,
    detectedModels: [],
  },
  {
    id: 'key-004',
    key: '••••••••••••••••••••••••••••••••MNOP',
    provider: 'Mistral',
    status: 'invalid',
    isActive: false,
    detectedModels: [],
  },
];

export const MOCK_LAUNCHERS: readonly LauncherEntry[] = [
  {
    id: 'launcher-001',
    name: 'Claude Code',
    type: 'cli',
    path: '/usr/local/bin/claude',
    status: 'detected',
    isActive: true,
  },
  {
    id: 'launcher-002',
    name: 'Cursor',
    type: 'ide',
    path: '/Applications/Cursor.app',
    status: 'detected',
    isActive: true,
  },
  {
    id: 'launcher-003',
    name: 'Windsurf',
    type: 'ide',
    path: '/Applications/Windsurf.app',
    status: 'manual',
    isActive: false,
  },
  {
    id: 'launcher-004',
    name: 'VS Code',
    type: 'ide',
    path: '/usr/local/bin/code',
    status: 'missing',
    isActive: false,
  },
];

export const MOCK_SUBSCRIPTIONS: readonly SubscriptionEntry[] = [
  {
    id: 'sub-001',
    provider: 'Anthropic',
    connectionStatus: 'connected',
    isActive: true,
    availableModels: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'sub-002',
    provider: 'OpenAI',
    connectionStatus: 'connected',
    isActive: true,
    availableModels: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'],
  },
  {
    id: 'sub-003',
    provider: 'Google',
    connectionStatus: 'disconnected',
    isActive: false,
    availableModels: [],
  },
  {
    id: 'sub-004',
    provider: 'Mistral',
    connectionStatus: 'expired',
    isActive: false,
    availableModels: [],
  },
];

export const MOCK_MODEL_MAPPINGS: readonly ModelMapping[] = [
  {
    id: 'mapping-001',
    modelId: 'claude-sonnet-4-6',
    launcherId: 'launcher-001',
    isDefault: true,
  },
  {
    id: 'mapping-002',
    modelId: 'gpt-4o',
    launcherId: 'launcher-002',
    isDefault: true,
  },
  {
    id: 'mapping-003',
    modelId: 'claude-opus-4-6',
    launcherId: 'launcher-001',
    isDefault: false,
  },
  {
    id: 'mapping-004',
    modelId: 'gpt-4o-mini',
    launcherId: 'launcher-003',
    isDefault: false,
  },
];

export const MOCK_SETTINGS_STATE: SettingsState = {
  apiKeys: MOCK_API_KEYS,
  launchers: MOCK_LAUNCHERS,
  subscriptions: MOCK_SUBSCRIPTIONS,
  mappings: MOCK_MODEL_MAPPINGS,
};
