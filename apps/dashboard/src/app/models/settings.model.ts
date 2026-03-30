export type ApiKeyStatus = 'valid' | 'invalid' | 'untested';
export type ApiProviderId = 'anthropic' | 'openai' | 'google' | 'mistral' | 'groq';
export type LauncherType = 'cli' | 'ide' | 'desktop';
export type LauncherStatus = 'detected' | 'manual' | 'missing';
export type SubscriptionConnectionStatus = 'connected' | 'disconnected' | 'expired';

export interface ApiKeyEntry {
  readonly id: string;
  readonly key: string;
  readonly label?: string;
  readonly providerId?: ApiProviderId;
  readonly provider: string;
  readonly status: ApiKeyStatus;
  readonly isActive: boolean;
  readonly detectedModels: readonly string[];
}

export interface ApiProviderOption {
  readonly id: ApiProviderId;
  readonly name: string;
  readonly iconLabel: string;
  readonly modelIds: readonly string[];
}

export interface LauncherEntry {
  readonly id: string;
  readonly name: string;
  readonly type: LauncherType;
  readonly path: string;
  readonly status: LauncherStatus;
  readonly isActive: boolean;
}

export interface SubscriptionEntry {
  readonly id: string;
  readonly provider: string;
  readonly connectionStatus: SubscriptionConnectionStatus;
  readonly isActive: boolean;
  readonly availableModels: readonly string[];
}

export interface ModelMapping {
  readonly id: string;
  readonly modelId: string;
  readonly launcherId: string;
  readonly isDefault: boolean;
}

export interface SettingsState {
  readonly apiKeys: readonly ApiKeyEntry[];
  readonly launchers: readonly LauncherEntry[];
  readonly subscriptions: readonly SubscriptionEntry[];
  readonly mappings: readonly ModelMapping[];
}

export type SettingsTab = 'api-keys' | 'launchers' | 'subscriptions' | 'mapping';

export interface SettingsTabDefinition {
  readonly id: SettingsTab;
  readonly label: string;
  readonly icon: string;
}

export interface MappingDisplayEntry extends ModelMapping {
  readonly launcherName: string;
}

export const SETTINGS_TABS: readonly SettingsTabDefinition[] = [
  { id: 'api-keys', label: 'API Keys', icon: '🔑' },
  { id: 'launchers', label: 'Launchers', icon: '🚀' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📡' },
  { id: 'mapping', label: 'Mapping', icon: '🗺️' },
];
