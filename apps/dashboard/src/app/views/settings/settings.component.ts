import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { MappingDisplayEntry, SETTINGS_TABS, SettingsTab, SettingsTabDefinition } from '../../models/settings.model';
import { SettingsService } from '../../services/settings.service';
import { ApiKeysComponent } from './api-keys/api-keys.component';
import { LaunchersComponent } from './launchers/launchers.component';
import { SubscriptionsComponent } from './subscriptions/subscriptions.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [NgClass, ApiKeysComponent, LaunchersComponent, SubscriptionsComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);

  public readonly tabs: readonly SettingsTabDefinition[] = SETTINGS_TABS;
  public readonly activeTab = signal<SettingsTab>('api-keys');

  public readonly mappings = computed<readonly MappingDisplayEntry[]>(() => {
    const launcherNames = new Map(this.settingsService.launchers().map((launcher) => [launcher.id, launcher.name]));

    return this.settingsService.mappings().map((mapping) => ({
      ...mapping,
      launcherName: launcherNames.get(mapping.launcherId) ?? mapping.launcherId,
    }));
  });

  public selectTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }
}
