import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import type { ProviderQuotaItem } from '../../../models/api.types';

export type QuotaLoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-provider-quota',
  standalone: true,
  templateUrl: './provider-quota.component.html',
  styleUrl: './provider-quota.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderQuotaComponent {
  private readonly api = inject(ApiService);

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

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  public constructor() {
    this.loadQuota();
    this.startAutoRefresh();
  }

  private loadQuota(): void {
    this.loadState.set('loading');
    this.api
      .getProviderQuota()
      .pipe(takeUntilDestroyed())
      .subscribe({
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
    inject(DestroyRef).onDestroy(() => {
      if (this.refreshTimer !== null) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    });
  }

  public onRefresh(): void {
    this.loadQuota();
  }
}
