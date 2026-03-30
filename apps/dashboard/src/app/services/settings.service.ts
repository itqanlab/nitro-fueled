import { computed, Injectable, signal } from '@angular/core';
import {
  ApiProviderId,
  ApiProviderOption,
  LauncherType,
  MappingLauncherEntry,
  MappingMatrixCell,
  MappingModelEntry,
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
  resetMappingsInState,
  toggleActiveInState,
  toggleMappingInState,
  updateDefaultsInState,
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

  public readonly activeModels = computed<readonly MappingModelEntry[]>(() => {
    const seen = new Set<string>();
    const models: MappingModelEntry[] = [];

    for (const key of this.state().apiKeys) {
      if (!key.isActive) {
        continue;
      }

      for (const modelId of key.detectedModels) {
        if (!seen.has(modelId)) {
          seen.add(modelId);
          models.push({ modelId, source: 'api-key', sourceLabel: key.provider });
        }
      }
    }

    for (const sub of this.state().subscriptions) {
      if (!sub.isActive) {
        continue;
      }

      for (const modelId of sub.availableModels) {
        if (!seen.has(modelId)) {
          seen.add(modelId);
          models.push({ modelId, source: 'subscription', sourceLabel: sub.provider });
        }
      }
    }

    return models;
  });

  public readonly activeLaunchers = computed<readonly MappingLauncherEntry[]>(() =>
    this.state().launchers.filter((l) => l.isActive).map((l) => ({
      launcherId: l.id,
      launcherName: l.name,
    })),
  );

  public readonly mappingMatrix = computed<readonly MappingMatrixCell[]>(() => {
    const models = this.activeModels();
    const launchers = this.activeLaunchers();
    const existing = this.state().mappings;
    const cells: MappingMatrixCell[] = [];

    for (const model of models) {
      for (const launcher of launchers) {
        const match = existing.find(
          (m) => m.modelId === model.modelId && m.launcherId === launcher.launcherId,
        );

        cells.push({
          modelId: model.modelId,
          launcherId: launcher.launcherId,
          enabled: match !== undefined,
          isDefault: match?.isDefault ?? false,
        });
      }
    }

    return cells;
  });

  public toggleMapping(modelId: string, launcherId: string): void {
    this.state.update((state) => toggleMappingInState(state, modelId, launcherId));
  }

  public setDefaultMapping(modelId: string, launcherId: string): void {
    this.state.update((state) => updateDefaultsInState(state, modelId, launcherId));
  }

  public readonly defaultModel = computed(() => {
    const defaultMapping = this.state().mappings.find((m) => m.isDefault);
    return defaultMapping?.modelId ?? null;
  });

  public readonly defaultLauncher = computed(() => {
    const defaultMapping = this.state().mappings.find((m) => m.isDefault);
    return defaultMapping?.launcherId ?? null;
  });

  public setDefaultModel(modelId: string): void {
    const launcherId = this.defaultLauncher() ?? this.activeLaunchers()[0]?.launcherId;

    if (launcherId === undefined) {
      return;
    }

    this.state.update((state) => updateDefaultsInState(state, modelId, launcherId));
  }

  public setDefaultLauncher(launcherId: string): void {
    const modelId = this.defaultModel() ?? this.activeModels()[0]?.modelId;

    if (modelId === undefined) {
      return;
    }

    this.state.update((state) => updateDefaultsInState(state, modelId, launcherId));
  }

  public saveMappings(): void {
    console.log('[SettingsService] Mapping configuration saved:', {
      mappings: this.state().mappings,
      timestamp: new Date().toISOString(),
    });
  }

  public resetMappings(): void {
    this.state.update((state) => resetMappingsInState(state));
  }
}
