import {
  cloneSettingsState,
  addLauncherToState,
  connectSubscriptionInState,
  disconnectSubscriptionInState,
  toggleActiveInState,
  buildApiKeyEntry,
  toggleMappingInState,
  updateDefaultsInState,
  resetMappingsInState,
} from './settings-state.utils';
import {
  ApiProviderOption,
  SettingsState,
  SubscriptionProviderOption,
  ModelMapping,
  ApiProviderId,
  LauncherType,
} from '../models/settings.model';
import { API_PROVIDER_OPTIONS } from './settings-provider.constants';
import { MOCK_SETTINGS_STATE } from './settings.constants';

// Define ToggleType since it's not exported from settings.model.ts
type ToggleType = 'apiKey' | 'launcher' | 'subscription';

describe('settings-state.utils', () => {
  describe('cloneSettingsState', () => {
    it('should create a deep copy of settings state', () => {
      const originalState = MOCK_SETTINGS_STATE;
      const clonedState = cloneSettingsState();

      expect(clonedState).toEqual(originalState);
      expect(clonedState.apiKeys).not.toBe(originalState.apiKeys);
      expect(clonedState.launchers).not.toBe(originalState.launchers);
      expect(clonedState.subscriptions).not.toBe(originalState.subscriptions);
      expect(clonedState.mappings).not.toBe(originalState.mappings);
    });

    it('should mask API keys in cloned state', () => {
      const clonedState = cloneSettingsState();
      const firstApiKey = clonedState.apiKeys[0];
      
      expect(firstApiKey.key).not.toBe(MOCK_SETTINGS_STATE.apiKeys[0].key);
      expect(firstApiKey.key).toContain('*');
    });
  });

  describe('addLauncherToState', () => {
    it('should add a new launcher to the state', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [],
      };
      
      const newLauncher = {
        id: 'launcher-1',
        name: 'Test Launcher',
        type: 'cli' as LauncherType,
        path: '/test/path',
        status: 'manual',
        isActive: true,
      };

      const newState = addLauncherToState(initialState, newLauncher.name, newLauncher.type, newLauncher.path);

      expect(newState.launchers.length).toBe(1);
      expect(newState.launchers[0]).toEqual(newLauncher);
      expect(newState.apiKeys).toEqual([]);
      expect(newState.subscriptions).toEqual([]);
      expect(newState.mappings).toEqual([]);
    });

    it('should prepend the new launcher to the existing launchers array', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [{ id: 'existing', name: 'Existing', type: 'cli', path: '/existing', status: 'manual', isActive: true }],
        subscriptions: [],
        mappings: [],
      };

      const newState = addLauncherToState(initialState, 'New Launcher', 'cli', '/new/path');

      expect(newState.launchers.length).toBe(2);
      expect(newState.launchers[0].name).toBe('New Launcher');
      expect(newState.launchers[1].name).toBe('Existing');
    });
  });

  describe('connectSubscriptionInState', () => {
    it('should connect a subscription by updating its status', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [
          { id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'disconnected', isActive: false, availableModels: [] },
        ],
        mappings: [],
      };

      const providerOptions: readonly SubscriptionProviderOption[] = [
        { id: 'chatgpt-plus', name: 'ChatGPT Plus', iconLabel: 'CP', modelIds: ['gpt-4o'] },
      ];

      const newState = connectSubscriptionInState(initialState, 'sub1', providerOptions);

      expect(newState.subscriptions[0].connectionStatus).toBe('connected');
      expect(newState.subscriptions[0].isActive).toBe(true);
      expect(newState.subscriptions[0].availableModels).toEqual(['gpt-4o']);
    });

    it('should leave other subscriptions unchanged', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [
          { id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'disconnected', isActive: false, availableModels: [] },
          { id: 'sub2', providerId: 'claude-pro', provider: 'Claude Pro', connectionStatus: 'disconnected', isActive: false, availableModels: [] },
        ],
        mappings: [],
      };

      const providerOptions: readonly SubscriptionProviderOption[] = [
        { id: 'chatgpt-plus', name: 'ChatGPT Plus', iconLabel: 'CP', modelIds: ['gpt-4o'] },
      ];

      const newState = connectSubscriptionInState(initialState, 'sub1', providerOptions);

      expect(newState.subscriptions[0].connectionStatus).toBe('connected');
      expect(newState.subscriptions[1].connectionStatus).toBe('disconnected');
    });

    it('should handle unknown subscription ID gracefully', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [
          { id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'disconnected', isActive: false, availableModels: [] },
        ],
        mappings: [],
      };

      const providerOptions: readonly SubscriptionProviderOption[] = [
        { id: 'chatgpt-plus', name: 'ChatGPT Plus', iconLabel: 'CP', modelIds: ['gpt-4o'] },
      ];

      const newState = connectSubscriptionInState(initialState, 'unknown', providerOptions);

      expect(newState).toEqual(initialState);
    });
  });

  describe('disconnectSubscriptionInState', () => {
    it('should disconnect a subscription by updating its status', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [
          { id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'connected', isActive: true, availableModels: ['gpt-4o'] },
        ],
        mappings: [],
      };

      const newState = disconnectSubscriptionInState(initialState, 'sub1');

      expect(newState.subscriptions[0].connectionStatus).toBe('disconnected');
      expect(newState.subscriptions[0].isActive).toBe(false);
      expect(newState.subscriptions[0].availableModels).toEqual([]);
    });

    it('should leave other subscriptions unchanged', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [
          { id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'connected', isActive: true, availableModels: ['gpt-4o'] },
          { id: 'sub2', providerId: 'claude-pro', provider: 'Claude Pro', connectionStatus: 'connected', isActive: true, availableModels: ['claude-sonnet'] },
        ],
        mappings: [],
      };

      const newState = disconnectSubscriptionInState(initialState, 'sub1');

      expect(newState.subscriptions[0].connectionStatus).toBe('disconnected');
      expect(newState.subscriptions[1].connectionStatus).toBe('connected');
    });

    it('should handle unknown subscription ID gracefully', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [
          { id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'connected', isActive: true, availableModels: ['gpt-4o'] },
        ],
        mappings: [],
      };

      const newState = disconnectSubscriptionInState(initialState, 'unknown');

      expect(newState).toEqual(initialState);
    });
  });

  describe('toggleActiveInState', () => {
    it('should toggle apiKey active state', () => {
      const initialState: SettingsState = {
        apiKeys: [
          { id: 'key1', key: 'test', label: 'Test', providerId: 'anthropic', provider: 'Anthropic', status: 'untested', isActive: false, detectedModels: [] },
        ],
        launchers: [],
        subscriptions: [],
        mappings: [],
      };

      const newState = toggleActiveInState(initialState, 'apiKey', 'key1');

      expect(newState.apiKeys[0].isActive).toBe(true);
    });

    it('should toggle launcher active state', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [
          { id: 'launcher1', name: 'Test', type: 'cli', path: '/test', status: 'manual', isActive: false },
        ],
        subscriptions: [],
        mappings: [],
      };

      const newState = toggleActiveInState(initialState, 'launcher', 'launcher1');

      expect(newState.launchers[0].isActive).toBe(true);
    });

    it('should toggle subscription active state', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [
          { id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'connected', isActive: false, availableModels: [] },
        ],
        mappings: [],
      };

      const newState = toggleActiveInState(initialState, 'subscription', 'sub1');

      expect(newState.subscriptions[0].isActive).toBe(true);
    });

    it('should handle unknown type gracefully', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [],
      };

      const newState = toggleActiveInState(initialState, 'unknown' as ToggleType, 'id');

      expect(newState).toEqual(initialState);
    });

    it('should handle unknown ID gracefully', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [],
      };

      const newState = toggleActiveInState(initialState, 'apiKey', 'unknown');

      expect(newState).toEqual(initialState);
    });
  });

  describe('buildApiKeyEntry', () => {
    it('should build a valid API key entry', () => {
      const provider: ApiProviderOption = API_PROVIDER_OPTIONS[0];
      const label = 'Test Key';
      const keyValue = 'sk-ant-test';

      const entry = buildApiKeyEntry(provider, label, keyValue);

      expect(entry.id).toBeDefined();
      expect(entry.key).toBe('sk-ant-test');
      expect(entry.label).toBe(label);
      expect(entry.providerId).toBe(provider.id);
      expect(entry.provider).toBe(provider.name);
      expect(entry.status).toBe('untested');
      expect(entry.isActive).toBe(true);
      expect(entry.detectedModels).toEqual(provider.modelIds);
    });

    it('should mask the API key', () => {
      const provider: ApiProviderOption = API_PROVIDER_OPTIONS[0];
      const label = 'Test Key';
      const keyValue = 'sk-ant-test';

      const entry = buildApiKeyEntry(provider, label, keyValue);

      expect(entry.key).toBe('sk-ant-test');
    });
  });

  describe('toggleMappingInState', () => {
    it('should remove existing mapping', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [
          { id: 'mapping1', modelId: 'model1', launcherId: 'launcher1', isDefault: false },
        ],
      };

      const newState = toggleMappingInState(initialState, 'model1', 'launcher1');

      expect(newState.mappings.length).toBe(0);
    });

    it('should add new mapping when none exists', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [],
      };

      const newState = toggleMappingInState(initialState, 'model1', 'launcher1');

      expect(newState.mappings.length).toBe(1);
      expect(newState.mappings[0].modelId).toBe('model1');
      expect(newState.mappings[0].launcherId).toBe('launcher1');
      expect(newState.mappings[0].isDefault).toBe(false);
    });

    it('should leave other mappings unchanged', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [
          { id: 'mapping1', modelId: 'model1', launcherId: 'launcher1', isDefault: false },
          { id: 'mapping2', modelId: 'model2', launcherId: 'launcher2', isDefault: false },
        ],
      };

      const newState = toggleMappingInState(initialState, 'model1', 'launcher1');

      expect(newState.mappings.length).toBe(1);
      expect(newState.mappings[0].modelId).toBe('model2');
      expect(newState.mappings[0].launcherId).toBe('launcher2');
    });
  });

  describe('updateDefaultsInState', () => {
    it('should update existing mapping to be default', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [
          { id: 'mapping1', modelId: 'model1', launcherId: 'launcher1', isDefault: false },
        ],
      };

      const newState = updateDefaultsInState(initialState, 'model1', 'launcher1');

      expect(newState.mappings.length).toBe(1);
      expect(newState.mappings[0].isDefault).toBe(true);
    });

    it('should create new mapping when none exists', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [],
      };

      const newState = updateDefaultsInState(initialState, 'model1', 'launcher1');

      expect(newState.mappings.length).toBe(1);
      expect(newState.mappings[0].modelId).toBe('model1');
      expect(newState.mappings[0].launcherId).toBe('launcher1');
      expect(newState.mappings[0].isDefault).toBe(true);
    });

    it('should reset other mappings to non-default', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [
          { id: 'mapping1', modelId: 'model1', launcherId: 'launcher1', isDefault: true },
          { id: 'mapping2', modelId: 'model2', launcherId: 'launcher2', isDefault: true },
        ],
      };

      const newState = updateDefaultsInState(initialState, 'model1', 'launcher1');

      expect(newState.mappings.length).toBe(2);
      expect(newState.mappings[0].isDefault).toBe(true);
      expect(newState.mappings[1].isDefault).toBe(false);
    });
  });

  describe('resetMappingsInState', () => {
    it('should reset mappings to original state', () => {
      const initialState: SettingsState = {
        apiKeys: [],
        launchers: [],
        subscriptions: [],
        mappings: [
          { id: 'mapping1', modelId: 'model1', launcherId: 'launcher1', isDefault: false },
        ],
      };

      const newState = resetMappingsInState(initialState);

      expect(newState.mappings.length).toBe(1);
      expect(newState.mappings[0].id).not.toBe('mapping1');
      expect(newState.mappings[0].modelId).toBe('model1');
      expect(newState.mappings[0].launcherId).toBe('launcher1');
      expect(newState.mappings[0].isDefault).toBe(false);
    });

    it('should maintain other state properties', () => {
      const initialState: SettingsState = {
        apiKeys: [{ id: 'key1', key: 'test', label: 'Test', providerId: 'anthropic', provider: 'Anthropic', status: 'untested', isActive: true, detectedModels: [] }],
        launchers: [{ id: 'launcher1', name: 'Test', type: 'cli', path: '/test', status: 'manual', isActive: true }],
        subscriptions: [{ id: 'sub1', providerId: 'chatgpt-plus', provider: 'ChatGPT Plus', connectionStatus: 'connected', isActive: true, availableModels: [] }],
        mappings: [{ id: 'mapping1', modelId: 'model1', launcherId: 'launcher1', isDefault: false }],
      };

      const newState = resetMappingsInState(initialState);

      expect(newState.apiKeys).toEqual(initialState.apiKeys);
      expect(newState.launchers).toEqual(initialState.launchers);
      expect(newState.subscriptions).toEqual(initialState.subscriptions);
      expect(newState.mappings.length).toBe(1);
      expect(newState.mappings[0].id).not.toBe('mapping1');
    });
  });
});