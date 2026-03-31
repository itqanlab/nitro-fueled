import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { StatusIndicator } from '../../models/provider.model';
import type { DashboardStats } from '../../models/api.types';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [NgClass],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBarComponent {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly statsSignal = toSignal(
    this.api.getStats().pipe(catchError(() => of(null as DashboardStats | null))),
    { initialValue: null as DashboardStats | null },
  );

  public indicators: readonly StatusIndicator[] = [];
  public mcpCount = 0;
  public readonly autoRunEnabled = false;
  public budget: { used: number; total: number } = { used: 0, total: 100 };

  constructor() {
    effect(() => {
      const stats = this.statsSignal();
      if (!stats) return;
      this.mcpCount = stats.activeWorkers;
      this.budget = { used: parseFloat(stats.totalCost.toFixed(2)), total: 100 };
      this.indicators = this.buildIndicators(stats);
      this.cdr.markForCheck();
    });
  }

  private buildIndicators(stats: DashboardStats): readonly StatusIndicator[] {
    return [
      {
        label: 'API',
        status: 'ok',
      },
      {
        label: `${stats.activeWorkers} worker${stats.activeWorkers !== 1 ? 's' : ''} active`,
        status: stats.activeWorkers > 0 ? 'busy' : 'ok',
      },
    ];
  }
}
