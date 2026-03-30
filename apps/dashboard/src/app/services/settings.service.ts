import { Injectable } from '@angular/core';
import { ApiKeyEntry, LauncherEntry, ModelMapping, SettingsState, SubscriptionEntry } from '../models/settings.model';
import {
  MOCK_API_KEYS,
  MOCK_LAUNCHERS,
  MOCK_MODEL_MAPPINGS,
  MOCK_SETTINGS_STATE,
  MOCK_SUBSCRIPTIONS,
} from './settings.constants';

type ToggleType = 'apiKey' | 'launcher' | 'subscription' | 'mapping';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private state: SettingsState = { ...MOCK_SETTINGS_STATE };

  public getApiKeys(): readonly ApiKeyEntry[] {
    return this.state.apiKeys;
  }

  public getLaunchers(): readonly LauncherEntry[] {
    return this.state.launchers;
  }

  public getSubscriptions(): readonly SubscriptionEntry[] {
    return this.state.subscriptions;
  }

  public getMappings(): readonly ModelMapping[] {
    return this.state.mappings;
  }

  public toggleActive(type: ToggleType, id: string): void {
    switch (type) {
      case 'apiKey':
        this.state = {
          ...this.state,
          apiKeys: this.state.apiKeys.map((entry) =>
            entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
          ),
        };
        break;
      case 'launcher':
        this.state = {
          ...this.state,
          launchers: this.state.launchers.map((entry) =>
            entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
          ),
        };
        break;
      case 'subscription':
        this.state = {
          ...this.state,
          subscriptions: this.state.subscriptions.map((entry) =>
            entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
          ),
        };
        break;
      case 'mapping':
        this.state = {
          ...this.state,
          mappings: this.state.mappings.map((entry) =>
            entry.id === id ? { ...entry, isDefault: !entry.isDefault } : entry,
          ),
        };
        break;
    }
  }
}
