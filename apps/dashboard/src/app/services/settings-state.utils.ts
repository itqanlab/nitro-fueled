import {
  ApiProviderOption,
  LauncherType,
  ModelMapping,
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
    default:
      return state;
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

export function toggleMappingInState(state: SettingsState, modelId: string, launcherId: string): SettingsState {
  const existing = state.mappings.find(
    (m) => m.modelId === modelId && m.launcherId === launcherId,
  );

  if (existing !== undefined) {
    return {
      ...state,
      mappings: state.mappings.filter((m) => m.id !== existing.id),
    };
  }

  const newMapping: ModelMapping = {
    id: `mapping-${Date.now()}`,
    modelId,
    launcherId,
    isDefault: false,
  };

  return {
    ...state,
    mappings: [...state.mappings, newMapping],
  };
}

export function updateDefaultsInState(state: SettingsState, modelId: string, launcherId: string): SettingsState {
  let found = state.mappings.find(
    (m) => m.modelId === modelId && m.launcherId === launcherId,
  );

  let mappings = state.mappings.map((m) => ({ ...m, isDefault: false }));

  if (found === undefined) {
    found = {
      id: `mapping-${Date.now()}`,
      modelId,
      launcherId,
      isDefault: true,
    };
    mappings = [...mappings, found];
  } else {
    mappings = mappings.map((m) =>
      m.id === found!.id ? { ...m, isDefault: true } : m,
    );
  }

  return { ...state, mappings };
}

export function resetMappingsInState(state: SettingsState): SettingsState {
  return {
    ...state,
    mappings: MOCK_SETTINGS_STATE.mappings.map((m) => ({ ...m })),
  };
}
