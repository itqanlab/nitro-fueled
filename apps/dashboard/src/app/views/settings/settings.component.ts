import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SETTINGS_TABS, SettingsTab, SettingsTabDefinition } from '../../models/settings.model';
import { SettingsService } from '../../services/settings.service';
import { ApiKeysComponent } from './api-keys/api-keys.component';
import { LaunchersComponent } from './launchers/launchers.component';
import { SubscriptionsComponent } from './subscriptions/subscriptions.component';
import { MappingComponent } from './mapping/mapping.component';
import { TabNavComponent, TabItem } from '../../shared/tab-nav/tab-nav.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TabNavComponent, ApiKeysComponent, LaunchersComponent, SubscriptionsComponent, MappingComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);

  public readonly tabs: readonly SettingsTabDefinition[] = SETTINGS_TABS;
  public readonly activeTab = signal<SettingsTab>('api-keys');

  public selectTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }
}
