import { computed, Injectable, signal } from '@angular/core';
import {
  ApiKeyEntry,
  ApiProviderId,
  ApiProviderOption,
  LauncherEntry,
  ModelMapping,
  SettingsState,
  SubscriptionEntry,
} from '../models/settings.model';
import {
  MOCK_SETTINGS_STATE,
} from './settings.constants';
import {
  API_PROVIDER_OPTIONS,
  detectProviderFromKey,
  getProviderById,
  getProviderByName,
  maskApiKey,
} from './settings-provider.constants';

export type ToggleType = 'apiKey' | 'launcher' | 'subscription';

function cloneState(): SettingsState {
  return {
    apiKeys: MOCK_SETTINGS_STATE.apiKeys.map((entry) => {
      const provider = API_PROVIDER_OPTIONS.find((option) => option.name === entry.provider);

      return {
        ...entry,
        label: entry.label ?? `${entry.provider} key`,
        providerId: entry.providerId ?? provider?.id,
      };
    }),
    launchers: [...MOCK_SETTINGS_STATE.launchers],
    subscriptions: [...MOCK_SETTINGS_STATE.subscriptions],
    mappings: [...MOCK_SETTINGS_STATE.mappings],
  };
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly state = signal<SettingsState>(cloneState());

  public readonly apiKeys = computed(() => this.state().apiKeys);
  public readonly launchers = computed(() => this.state().launchers);
  public readonly subscriptions = computed(() => this.state().subscriptions);
  public readonly mappings = computed(() => this.state().mappings);
  public readonly providerOptions: readonly ApiProviderOption[] = API_PROVIDER_OPTIONS;

  public getApiKeys(): readonly ApiKeyEntry[] {
    return this.state().apiKeys;
  }

  public getLaunchers(): readonly LauncherEntry[] {
    return this.state().launchers;
  }

  public getSubscriptions(): readonly SubscriptionEntry[] {
    return this.state().subscriptions;
  }

  public getMappings(): readonly ModelMapping[] {
    return this.state().mappings;
  }

  public getProviderById(providerId: ApiProviderId | null): ApiProviderOption | null {
    return getProviderById(providerId);
  }

  public getProviderByName(name: string): ApiProviderOption | null {
    return getProviderByName(name);
  }

  public detectProvider(keyValue: string): ApiProviderOption | null {
    return detectProviderFromKey(keyValue);
  }

  public addApiKey(label: string, keyValue: string, providerId: ApiProviderId): void {
    const provider = this.getProviderById(providerId);

    if (provider === null) {
      return;
    }

    this.state.update((state) => ({
      ...state,
      apiKeys: [
        {
          id: `key-${Date.now()}`,
          key: maskApiKey(keyValue),
          label,
          providerId,
          provider: provider.name,
          status: 'untested',
          isActive: true,
          detectedModels: provider.modelIds,
        },
        ...state.apiKeys,
      ],
    }));
  }

  public updateApiKey(id: string, label: string, keyValue: string, providerId: ApiProviderId): void {
    const provider = this.getProviderById(providerId);

    if (provider === null) {
      return;
    }

    this.state.update((state) => ({
      ...state,
      apiKeys: state.apiKeys.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }

        return {
          ...entry,
          key: keyValue.trim().length > 0 ? maskApiKey(keyValue) : entry.key,
          label,
          providerId,
          provider: provider.name,
          status: keyValue.trim().length > 0 ? 'untested' : entry.status,
          detectedModels: provider.modelIds,
        };
      }),
    }));
  }

  public deleteApiKey(id: string): boolean {
    const previousLength = this.state().apiKeys.length;

    this.state.update((state) => ({
      ...state,
      apiKeys: state.apiKeys.filter((entry) => entry.id !== id),
    }));

    return this.state().apiKeys.length < previousLength;
  }

  public toggleActive(type: ToggleType, id: string): void {
    switch (type) {
      case 'apiKey':
        this.state.update((s) => ({
          ...s,
          apiKeys: s.apiKeys.map((entry) =>
            entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
          ),
        }));
        break;
      case 'launcher':
        this.state.update((s) => ({
          ...s,
          launchers: s.launchers.map((entry) =>
            entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
          ),
        }));
        break;
      case 'subscription':
        this.state.update((s) => ({
          ...s,
          subscriptions: s.subscriptions.map((entry) =>
            entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
          ),
        }));
        break;
    }
  }

  public toggleDefault(id: string): void {
    this.state.update((s) => ({
      ...s,
      mappings: s.mappings.map((entry) =>
        entry.id === id ? { ...entry, isDefault: !entry.isDefault } : entry,
      ),
    }));
  }
}
