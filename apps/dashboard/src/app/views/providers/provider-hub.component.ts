import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { MOCK_PROVIDER_HUB_DATA } from '../../services/provider-hub.constants';
import { ProviderHubData } from '../../models/provider-hub.model';
import { ProviderCardComponent } from './provider-card/provider-card.component';

@Component({
  selector: 'app-provider-hub',
  standalone: true,
  imports: [DecimalPipe, PercentPipe, ProviderCardComponent],
  templateUrl: './provider-hub.component.html',
  styleUrl: './provider-hub.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderHubComponent {
  public readonly data: ProviderHubData = MOCK_PROVIDER_HUB_DATA;

  public readonly budgetPercent =
    this.data.costSummary.budget > 0
      ? this.data.costSummary.totalCost / this.data.costSummary.budget
      : 0;

  public readonly budgetBarWidth = Math.min(100, this.budgetPercent * 100);

  public expandedProviderId: string | null = 'anthropic';

  public isExpanded(providerId: string): boolean {
    return this.expandedProviderId === providerId;
  }

  public onToggleExpand(providerId: string): void {
    this.expandedProviderId =
      this.expandedProviderId === providerId ? null : providerId;
  }

  public onToggleModel(event: { providerId: string; modelId: string }): void {
    // Model toggle — no-op with mock data
  }
}
