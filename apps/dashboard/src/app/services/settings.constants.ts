import {
  ApiKeyEntry,
  LauncherDetectionEntry,
  LauncherEntry,
  ModelMapping,
  SettingsState,
  SubscriptionEntry,
  SubscriptionProviderOption,
} from '../models/settings.model';

export const MOCK_API_KEYS: readonly ApiKeyEntry[] = [
  {
    id: 'key-001',
    key: 'MOCK-ANT-••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••ABCD',
    provider: 'Anthropic',
    status: 'valid',
    isActive: true,
    detectedModels: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'key-002',
    key: 'MOCK-OAI-••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••EFGH',
    provider: 'OpenAI',
    status: 'valid',
    isActive: true,
    detectedModels: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  },
  {
    id: 'key-003',
    key: 'MOCK-GOOG-••••••••••••••••••••••••••••••••••IJKL',
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
    name: 'Claude Code CLI',
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
    name: 'VS Code',
    type: 'ide',
    path: '/usr/local/bin/code',
    status: 'detected',
    isActive: true,
  },
  {
    id: 'launcher-004',
    name: 'Windsurf',
    type: 'ide',
    path: '/Applications/Windsurf.app',
    status: 'missing',
    isActive: false,
  },
];

export const MOCK_LAUNCHER_DETECTIONS: readonly LauncherDetectionEntry[] = [
  {
    id: 'scan-001',
    name: 'Claude Code CLI',
    status: 'detected',
    path: '/usr/local/bin/claude',
  },
  {
    id: 'scan-002',
    name: 'VS Code',
    status: 'detected',
    path: '/usr/local/bin/code',
  },
  {
    id: 'scan-003',
    name: 'Cursor',
    status: 'detected',
    path: '/Applications/Cursor.app',
  },
  {
    id: 'scan-004',
    name: 'Windsurf',
    status: 'not-found',
    path: '/Applications/Windsurf.app',
  },
];

export const SUBSCRIPTION_PROVIDER_OPTIONS: readonly SubscriptionProviderOption[] = [
  {
    id: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    iconLabel: 'CG',
    modelIds: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    id: 'claude-pro',
    name: 'Claude Pro',
    iconLabel: 'CP',
    modelIds: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    iconLabel: 'AG',
    modelIds: ['antigravity-pro', 'antigravity-fast', 'antigravity-reasoner'],
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    iconLabel: 'GH',
    modelIds: ['gpt-4.1', 'claude-sonnet-4-6', 'gemini-2.5-pro'],
  },
];

export const MOCK_SUBSCRIPTIONS: readonly SubscriptionEntry[] = [
  {
    id: 'sub-001',
    providerId: 'chatgpt-plus',
    provider: 'ChatGPT Plus',
    connectionStatus: 'connected',
    isActive: true,
    availableModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    id: 'sub-002',
    providerId: 'claude-pro',
    provider: 'Claude Pro',
    connectionStatus: 'expired',
    isActive: true,
    availableModels: ['claude-sonnet-4-6'],
  },
  {
    id: 'sub-003',
    providerId: 'antigravity',
    provider: 'Antigravity',
    connectionStatus: 'disconnected',
    isActive: false,
    availableModels: [],
  },
  {
    id: 'sub-004',
    providerId: 'github-copilot',
    provider: 'GitHub Copilot',
    connectionStatus: 'disconnected',
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
