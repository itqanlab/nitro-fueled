import { computed, Injectable, signal } from '@angular/core';
import { ApiKeyEntry, LauncherEntry, ModelMapping, SettingsState, SubscriptionEntry } from '../models/settings.model';
import {
  MOCK_SETTINGS_STATE,
} from './settings.constants';

export type ToggleType = 'apiKey' | 'launcher' | 'subscription';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly state = signal<SettingsState>({ ...MOCK_SETTINGS_STATE });

  public readonly apiKeys = computed(() => this.state().apiKeys);
  public readonly launchers = computed(() => this.state().launchers);
  public readonly subscriptions = computed(() => this.state().subscriptions);
  public readonly mappings = computed(() => this.state().mappings);

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
