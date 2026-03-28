import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { MockDataService } from '../../services/mock-data.service';
import { StatusIndicator } from '../../models/provider.model';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [NgClass],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
})
export class StatusBarComponent {
  private readonly mockData = inject(MockDataService);
  public readonly indicators: readonly StatusIndicator[] = this.mockData.getStatusIndicators();
  public readonly mcpCount: number = this.mockData.getMcpConnectionCount();
  public readonly autoRunEnabled: boolean = this.mockData.getAutoRunEnabled();
  public readonly budget = this.mockData.getMonthlyBudget();
}
