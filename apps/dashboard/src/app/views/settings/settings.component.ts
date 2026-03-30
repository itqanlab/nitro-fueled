import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { SettingsService } from '../../services/settings.service';

type SettingsTab = 'api-keys' | 'launchers' | 'subscriptions' | 'mapping';

interface TabDefinition {
  readonly id: SettingsTab;
  readonly label: string;
  readonly icon: string;
}

const SETTINGS_TABS: readonly TabDefinition[] = [
  { id: 'api-keys', label: 'API Keys', icon: '🔑' },
  { id: 'launchers', label: 'Launchers', icon: '🚀' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📡' },
  { id: 'mapping', label: 'Mapping', icon: '🗺️' },
];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [NgClass],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);

  public readonly tabs: readonly TabDefinition[] = SETTINGS_TABS;
  public readonly activeTab = signal<SettingsTab>('api-keys');

  public readonly apiKeys = this.settingsService.getApiKeys();
  public readonly launchers = this.settingsService.getLaunchers();
  public readonly subscriptions = this.settingsService.getSubscriptions();
  public readonly mappings = this.settingsService.getMappings();

  public selectTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }

  public trackById(_index: number, item: { readonly id: string }): string {
    return item.id;
  }
}
