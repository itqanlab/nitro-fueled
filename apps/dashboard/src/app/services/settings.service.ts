import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ApiProviderId,
  ApiProviderOption,
  LauncherType,
  MappingLauncherEntry,
  MappingMatrixCell,
  MappingModelEntry,
  ModelMapping,
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
  toggleMappingInState,
  updateDefaultsInState,
} from './settings-state.utils';
import { ApiService } from './api.service';

export type ToggleType = 'apiKey' | 'launcher' | 'subscription';

const EMPTY_STATE: SettingsState = {
  apiKeys: [],
  launchers: [],
  subscriptions: [],
  mappings: [],
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);
  private readonly state = signal<SettingsState>(EMPTY_STATE);

  public readonly apiKeys = computed(() => this.state().apiKeys);
  public readonly launchers = computed(() => this.state().launchers);
  public readonly subscriptions = computed(() => this.state().subscriptions);
  public readonly mappings = computed(() => this.state().mappings);
  public readonly launcherDetections = computed(() => MOCK_LAUNCHER_DETECTIONS);
  public readonly providerOptions: readonly ApiProviderOption[] = API_PROVIDER_OPTIONS;
  public readonly subscriptionOptions: readonly SubscriptionProviderOption[] = SUBSCRIPTION_PROVIDER_OPTIONS;

  constructor() {
    this.loadAll();
  }

  private loadAll(): void {
    this.api.getSettingsApiKeys().subscribe({
      next: (keys) => this.state.update((s) => ({ ...s, apiKeys: keys })),
    });
    this.api.getSettingsLaunchers().subscribe({
      next: (launchers) => this.state.update((s) => ({ ...s, launchers })),
    });
    this.api.getSettingsSubscriptions().subscribe({
      next: (subscriptions) => this.state.update((s) => ({ ...s, subscriptions })),
    });
    this.api.getSettingsMappings().subscribe({
      next: (mappings) => this.state.update((s) => ({ ...s, mappings })),
    });
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
    if (provider === null) return;

    this.api.createSettingsApiKey({
      label,
      key: maskApiKey(keyValue),
      providerId,
      provider: provider.name,
      detectedModels: [...provider.modelIds],
    }).subscribe({
      next: (entry) => {
        this.state.update((s) => ({ ...s, apiKeys: [entry, ...s.apiKeys] }));
      },
    });
  }

  public updateApiKey(id: string, label: string, keyValue: string, providerId: ApiProviderId): void {
    const provider = this.getProviderById(providerId);
    if (provider === null) return;

    const hasNewKey = keyValue.trim().length > 0;
    const patch = {
      label,
      providerId,
      provider: provider.name,
      detectedModels: [...provider.modelIds] as string[],
      ...(hasNewKey ? { key: maskApiKey(keyValue), status: 'untested' as const } : {}),
    };

    this.api.updateSettingsApiKey(id, patch).subscribe({
      next: (updated) => {
        this.state.update((s) => ({
          ...s,
          apiKeys: s.apiKeys.map((k) => (k.id === id ? updated : k)),
        }));
      },
    });
  }

  public deleteApiKey(id: string): void {
    this.api.deleteSettingsApiKey(id).subscribe({
      next: () => {
        this.state.update((s) => ({
          ...s,
          apiKeys: s.apiKeys.filter((k) => k.id !== id),
        }));
      },
    });
  }

  public addLauncher(name: string, type: LauncherType, path: string): void {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();
    if (trimmedName.length === 0 || trimmedPath.length === 0) return;

    this.api.createSettingsLauncher({ name: trimmedName, type, path: trimmedPath }).subscribe({
      next: (entry) => {
        this.state.update((s) => ({ ...s, launchers: [entry, ...s.launchers] }));
      },
    });
  }

  public connectSubscription(id: string): void {
    this.api.connectSettingsSubscription(id).subscribe({
      next: (updated) => {
        this.state.update((s) => ({
          ...s,
          subscriptions: s.subscriptions.map((sub) => (sub.id === id ? updated : sub)),
        }));
      },
    });
  }

  public disconnectSubscription(id: string): void {
    this.api.disconnectSettingsSubscription(id).subscribe({
      next: (updated) => {
        this.state.update((s) => ({
          ...s,
          subscriptions: s.subscriptions.map((sub) => (sub.id === id ? updated : sub)),
        }));
      },
    });
  }

  public toggleActive(type: ToggleType, id: string): void {
    if (type === 'apiKey') {
      const current = this.state().apiKeys.find((k) => k.id === id);
      if (current === undefined) return;
      this.api.setSettingsApiKeyActive(id, !current.isActive).subscribe({
        next: (updated) => {
          this.state.update((s) => ({
            ...s,
            apiKeys: s.apiKeys.map((k) => (k.id === id ? updated : k)),
          }));
        },
      });
    } else if (type === 'launcher') {
      const current = this.state().launchers.find((l) => l.id === id);
      if (current === undefined) return;
      this.api.setSettingsLauncherActive(id, !current.isActive).subscribe({
        next: (updated) => {
          this.state.update((s) => ({
            ...s,
            launchers: s.launchers.map((l) => (l.id === id ? updated : l)),
          }));
        },
      });
    } else if (type === 'subscription') {
      const current = this.state().subscriptions.find((sub) => sub.id === id);
      if (current === undefined) return;
      if (current.isActive) {
        this.disconnectSubscription(id);
      } else {
        this.connectSubscription(id);
      }
    }
  }

  public readonly activeModels = computed<readonly MappingModelEntry[]>(() => {
    const seen = new Set<string>();
    const models: MappingModelEntry[] = [];

    for (const key of this.state().apiKeys) {
      if (!key.isActive) continue;
      for (const modelId of key.detectedModels) {
        if (!seen.has(modelId)) {
          seen.add(modelId);
          models.push({ modelId, source: 'api-key', sourceLabel: key.provider });
        }
      }
    }

    for (const sub of this.state().subscriptions) {
      if (!sub.isActive) continue;
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
    if (launcherId === undefined) return;
    this.state.update((state) => updateDefaultsInState(state, modelId, launcherId));
  }

  public setDefaultLauncher(launcherId: string): void {
    const modelId = this.defaultModel() ?? this.activeModels()[0]?.modelId;
    if (modelId === undefined) return;
    this.state.update((state) => updateDefaultsInState(state, modelId, launcherId));
  }

  public saveMappings(): void {
    const mappings = [...this.state().mappings] as ModelMapping[];
    this.api.replaceSettingsMappings(mappings).subscribe({
      next: (saved) => {
        this.state.update((s) => ({ ...s, mappings: saved }));
      },
    });
  }

  public resetMappings(): void {
    this.api.replaceSettingsMappings([]).subscribe({
      next: () => {
        this.state.update((s) => ({ ...s, mappings: [] }));
      },
    });
  }
}
