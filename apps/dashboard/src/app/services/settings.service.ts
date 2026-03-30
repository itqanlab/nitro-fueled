import { computed, Injectable, signal } from '@angular/core';
import {
  ApiProviderId,
  ApiProviderOption,
  LauncherType,
  SettingsState,
  SubscriptionProviderOption,
} from '../models/settings.model';
import {
  MOCK_LAUNCHER_DETECTIONS,
  SUBSCRIPTION_PROVIDER_OPTIONS,
} from './settings.constants';
import {
  API_PROVIDER_OPTIONS,
  detectProviderFromKey,
  getProviderById,
  getProviderByName,
  maskApiKey,
} from './settings-provider.constants';
import {
  addLauncherToState,
  buildApiKeyEntry,
  cloneSettingsState,
  connectSubscriptionInState,
  disconnectSubscriptionInState,
  toggleActiveInState,
} from './settings-state.utils';

export type ToggleType = 'apiKey' | 'launcher' | 'subscription';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly state = signal<SettingsState>(cloneSettingsState());

  public readonly apiKeys = computed(() => this.state().apiKeys);
  public readonly launchers = computed(() => this.state().launchers);
  public readonly subscriptions = computed(() => this.state().subscriptions);
  public readonly mappings = computed(() => this.state().mappings);
  public readonly launcherDetections = computed(() => MOCK_LAUNCHER_DETECTIONS);
  public readonly providerOptions: readonly ApiProviderOption[] = API_PROVIDER_OPTIONS;
  public readonly subscriptionOptions: readonly SubscriptionProviderOption[] = SUBSCRIPTION_PROVIDER_OPTIONS;

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
      apiKeys: [buildApiKeyEntry(provider, label, keyValue), ...state.apiKeys],
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

  public addLauncher(name: string, type: LauncherType, path: string): void {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();

    if (trimmedName.length === 0 || trimmedPath.length === 0) {
      return;
    }

    this.state.update((state) => addLauncherToState(state, trimmedName, type, trimmedPath));
  }

  public connectSubscription(id: string): void {
    this.state.update((state) => connectSubscriptionInState(state, id, this.subscriptionOptions));
  }

  public disconnectSubscription(id: string): void {
    this.state.update((state) => disconnectSubscriptionInState(state, id));
  }

  public toggleActive(type: ToggleType, id: string): void {
    this.state.update((state) => toggleActiveInState(state, type, id));
  }
}
