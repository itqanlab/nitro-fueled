import {
  ApiProviderOption,
  LauncherType,
  SettingsState,
  SubscriptionProviderOption,
} from '../models/settings.model';
import { MOCK_SETTINGS_STATE } from './settings.constants';
import type { ToggleType } from './settings.service';
import { API_PROVIDER_OPTIONS, maskApiKey } from './settings-provider.constants';

export function cloneSettingsState(): SettingsState {
  return {
    apiKeys: MOCK_SETTINGS_STATE.apiKeys.map((entry) => {
      const provider = API_PROVIDER_OPTIONS.find((option) => option.name === entry.provider);

      return {
        ...entry,
        key: maskApiKey(entry.key),
        label: entry.label ?? `${entry.provider} key`,
        providerId: entry.providerId ?? provider?.id,
      };
    }),
    launchers: [...MOCK_SETTINGS_STATE.launchers],
    subscriptions: [...MOCK_SETTINGS_STATE.subscriptions],
    mappings: [...MOCK_SETTINGS_STATE.mappings],
  };
}

export function addLauncherToState(state: SettingsState, name: string, type: LauncherType, path: string): SettingsState {
  return {
    ...state,
    launchers: [
      {
        id: `launcher-${Date.now()}`,
        name,
        type,
        path,
        status: 'manual',
        isActive: true,
      },
      ...state.launchers,
    ],
  };
}

export function connectSubscriptionInState(
  state: SettingsState,
  id: string,
  options: readonly SubscriptionProviderOption[],
): SettingsState {
  return {
    ...state,
    subscriptions: state.subscriptions.map((entry) => {
      if (entry.id !== id) {
        return entry;
      }

      const provider = options.find((option) => option.id === entry.providerId);

      if (provider === undefined) {
        return entry;
      }

      return {
        ...entry,
        connectionStatus: 'connected',
        isActive: true,
        availableModels: provider.modelIds,
      };
    }),
  };
}

export function disconnectSubscriptionInState(state: SettingsState, id: string): SettingsState {
  return {
    ...state,
    subscriptions: state.subscriptions.map((entry) => {
      if (entry.id !== id) {
        return entry;
      }

      return {
        ...entry,
        connectionStatus: 'disconnected',
        isActive: false,
        availableModels: [],
      };
    }),
  };
}

export function toggleActiveInState(state: SettingsState, type: ToggleType, id: string): SettingsState {
  switch (type) {
    case 'apiKey':
      return {
        ...state,
        apiKeys: state.apiKeys.map((entry) =>
          entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
        ),
      };
    case 'launcher':
      return {
        ...state,
        launchers: state.launchers.map((entry) =>
          entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
        ),
      };
    case 'subscription':
      return {
        ...state,
        subscriptions: state.subscriptions.map((entry) =>
          entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
        ),
      };
  }
}

export function buildApiKeyEntry(
  provider: ApiProviderOption,
  label: string,
  keyValue: string,
): SettingsState['apiKeys'][number] {
  return {
    id: `key-${Date.now()}`,
    key: maskApiKey(keyValue),
    label,
    providerId: provider.id,
    provider: provider.name,
    status: 'untested',
    isActive: true,
    detectedModels: provider.modelIds,
  };
}
