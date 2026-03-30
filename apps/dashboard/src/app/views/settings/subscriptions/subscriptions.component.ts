import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  templateUrl: './subscriptions.component.html',
  styleUrl: './subscriptions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionsComponent {
  private readonly settingsService = inject(SettingsService);

  public readonly subscriptions = computed(() => this.settingsService.subscriptions().map((entry) => {
    const provider = this.settingsService.subscriptionOptions.find((option) => option.id === entry.providerId);

    return {
      ...entry,
      iconLabel: provider?.iconLabel ?? entry.provider.slice(0, 2),
      supportedModels: provider?.modelIds ?? [],
    };
  }));

  public onConnect(id: string): void {
    this.settingsService.connectSubscription(id);
  }

  public onDisconnect(id: string): void {
    this.settingsService.disconnectSubscription(id);
  }

  public onToggle(id: string): void {
    this.settingsService.toggleActive('subscription', id);
  }
}
