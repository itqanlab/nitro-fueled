import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { MockDataService } from '../../services/mock-data.service';
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
  private readonly mockData = inject(MockDataService);

  public readonly data: ProviderHubData = this.mockData.getProviderHubData();

  public readonly budgetPercent =
    this.data.costSummary.totalCost / this.data.costSummary.budget;

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
