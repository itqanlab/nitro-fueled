import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import type { ProviderQuotaItem } from '../../../models/api.types';

export type QuotaLoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-provider-quota',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './provider-quota.component.html',
  styleUrl: './provider-quota.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderQuotaComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private loadSub: Subscription | null = null;

  public readonly items = signal<ProviderQuotaItem[]>([]);
  public readonly loadState = signal<QuotaLoadState>('loading');

  public readonly glmCard = computed(() =>
    this.items().find((i) => i.provider === 'glm') ?? null,
  );
  public readonly anthropicCard = computed(() =>
    this.items().find((i) => i.provider === 'anthropic') ?? null,
  );
  public readonly openaiCard = computed(() =>
    this.items().find((i) => i.provider === 'openai') ?? null,
  );

  public readonly cardBarWidths = computed(() => {
    const map = new Map<string, number>();
    for (const item of this.items()) {
      if (!item.unavailable && item.limit > 0) {
        map.set(item.provider, Math.min(100, (item.used / item.limit) * 100));
      } else {
        map.set(item.provider, 0);
      }
    }
    return map;
  });

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  public constructor() {
    this.loadQuota();
    this.startAutoRefresh();
  }

  private loadQuota(): void {
    this.loadSub?.unsubscribe();
    this.loadState.set('loading');
    this.loadSub = this.api.getProviderQuota().subscribe({
      next: (data) => {
        this.items.set(data);
        this.loadState.set('loaded');
      },
      error: () => {
        this.loadState.set('error');
      },
    });
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => this.loadQuota(), 5 * 60 * 1000);
    this.destroyRef.onDestroy(() => {
      if (this.refreshTimer !== null) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      this.loadSub?.unsubscribe();
    });
  }

  public onRefresh(): void {
    this.loadQuota();
  }
}
