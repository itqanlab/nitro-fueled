import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { ApiKeysComponent } from './api-keys/api-keys.component';

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
  imports: [NgClass, ApiKeysComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);

  public readonly tabs: readonly TabDefinition[] = SETTINGS_TABS;
  public readonly activeTab = signal<SettingsTab>('api-keys');

  public readonly launchers = this.settingsService.launchers;
  public readonly subscriptions = this.settingsService.subscriptions;
  public readonly mappings = this.settingsService.mappings;

  public readonly launcherNames = computed(() =>
    new Map(this.settingsService.launchers().map((l) => [l.id, l.name])),
  );

  public selectTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }
}
