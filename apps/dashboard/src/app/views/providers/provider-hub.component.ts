import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import type { ProviderQuotaItem } from '../../models/api.types';
import type {
  ProviderConfig,
  ProviderHubData,
  ProviderModel,
} from '../../models/provider-hub.model';
import { ProviderCardComponent } from './provider-card/provider-card.component';

interface StaticProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly iconLetter: string;
  readonly iconClass: string;
  readonly apiType: 'api' | 'cli' | 'oauth';
  readonly authType: 'api-key' | 'oauth' | 'cli';
  readonly maskedKey?: string;
  readonly baseUrl?: string;
  readonly models: readonly ProviderModel[];
}

const PROVIDER_STATIC: Record<string, StaticProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    subtitle: 'API Provider',
    iconLetter: 'A',
    iconClass: 'icon-claude',
    apiType: 'api',
    authType: 'api-key',
    maskedKey: 'sk-ant-***',
    baseUrl: '',
    models: [
      {
        name: 'Claude Opus 4',
        id: 'claude-opus-4',
        capability: 'high',
        capabilityLabel: 'Reasoning',
        context: '200K',
        inputPrice: '$15',
        outputPrice: '$75',
        enabled: true,
      },
      {
        name: 'Claude Sonnet 4',
        id: 'claude-sonnet-4',
        capability: 'medium',
        capabilityLabel: 'Balanced',
        context: '200K',
        inputPrice: '$3',
        outputPrice: '$15',
        enabled: true,
      },
      {
        name: 'Claude Haiku 4',
        id: 'claude-haiku-4',
        capability: 'fast',
        capabilityLabel: 'Fast',
        context: '200K',
        inputPrice: '$0.25',
        outputPrice: '$1.25',
        enabled: true,
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    subtitle: 'API Provider',
    iconLetter: 'O',
    iconClass: 'icon-openai',
    apiType: 'api',
    authType: 'api-key',
    maskedKey: 'sk-proj-***',
    baseUrl: '',
    models: [
      {
        name: 'GPT-4o',
        id: 'gpt-4o',
        capability: 'high',
        capabilityLabel: 'Reasoning',
        context: '128K',
        inputPrice: '$5',
        outputPrice: '$15',
        enabled: true,
      },
      {
        name: 'GPT-4o Mini',
        id: 'gpt-4o-mini',
        capability: 'fast',
        capabilityLabel: 'Fast',
        context: '128K',
        inputPrice: '$0.15',
        outputPrice: '$0.60',
        enabled: true,
      },
    ],
  },
  glm: {
    id: 'glm',
    name: 'ZAI / GLM',
    subtitle: 'API Provider',
    iconLetter: 'Z',
    iconClass: 'icon-glm',
    apiType: 'api',
    authType: 'api-key',
    maskedKey: '***',
    baseUrl: '',
    models: [
      {
        name: 'GLM-4',
        id: 'glm-4',
        capability: 'high',
        capabilityLabel: 'Reasoning',
        context: '128K',
        inputPrice: '$0.10',
        outputPrice: '$0.10',
        enabled: true,
      },
    ],
  },
};

const PROVIDER_COLOR_CLASS: Record<string, string> = {
  anthropic: 'cost-bar-claude',
  openai: 'cost-bar-openai',
  glm: 'cost-bar-glm',
};

const STATIC_BUDGET = 100;

function buildProviderHubData(quota: readonly ProviderQuotaItem[]): ProviderHubData {
  const totalCost = quota.reduce((sum, item) => {
    return sum + (!item.unavailable ? item.costThisPeriod : 0);
  }, 0);

  const costBars = quota
    .filter((item): item is typeof item & { unavailable: false } => !item.unavailable)
    .map(item => ({
      provider: PROVIDER_STATIC[item.provider]?.name ?? item.provider,
      amount: item.costThisPeriod,
      percent: totalCost > 0 ? Math.round((item.costThisPeriod / totalCost) * 100) : 0,
      colorClass: PROVIDER_COLOR_CLASS[item.provider] ?? 'cost-bar-default',
    }));

  const providers: ProviderConfig[] = quota.map(item => {
    const staticCfg = PROVIDER_STATIC[item.provider];
    const base: StaticProviderConfig = staticCfg ?? {
      id: item.provider,
      name: item.provider,
      subtitle: 'API Provider',
      iconLetter: item.provider[0]?.toUpperCase() ?? '?',
      iconClass: '',
      apiType: 'api',
      authType: 'api-key',
      models: [],
    };

    if (item.unavailable) {
      return {
        ...base,
        connectionStatus: 'disconnected',
        connectionLabel: item.reason,
        monthlyCost: null,
        testResult: item.reason,
      } satisfies ProviderConfig;
    }

    return {
      ...base,
      connectionStatus: 'connected',
      connectionLabel: 'Connected',
      monthlyCost: item.costThisPeriod,
      testResult: `${item.plan} — ${item.used.toLocaleString()} tokens used`,
    } satisfies ProviderConfig;
  });

  const connected = providers.filter(p => p.connectionStatus === 'connected').length;
  const disconnected = providers.filter(p => p.connectionStatus === 'disconnected').length;

  return {
    costSummary: { totalCost, budget: STATIC_BUDGET, costBars },
    providers,
    bottomPanel: {
      totalProviders: providers.length,
      connected,
      expired: disconnected,
      notConfigured: 0,
    },
  };
}

@Component({
  selector: 'app-provider-hub',
  standalone: true,
  imports: [DecimalPipe, PercentPipe, ProviderCardComponent],
  templateUrl: './provider-hub.component.html',
  styleUrl: './provider-hub.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderHubComponent {
  private readonly api = inject(ApiService);

  private readonly quotaRaw = toSignal(
    this.api.getProviderQuota().pipe(
      catchError(() => of(null as ProviderQuotaItem[] | null)),
    ),
  );

  public readonly loading = computed(() => this.quotaRaw() === undefined);
  public readonly error = computed(() => this.quotaRaw() === null);

  public readonly data = computed<ProviderHubData | null>(() => {
    const raw = this.quotaRaw();
    if (raw === undefined || raw === null) return null;
    return buildProviderHubData(raw);
  });

  public readonly budgetPercent = computed(() => {
    const hub = this.data();
    if (!hub) return 0;
    return hub.costSummary.budget > 0
      ? hub.costSummary.totalCost / hub.costSummary.budget
      : 0;
  });

  public readonly budgetBarWidth = computed(() =>
    Math.min(100, this.budgetPercent() * 100),
  );

  public readonly expandedProviderId = signal<string | null>('anthropic');

  public isExpanded(providerId: string): boolean {
    return this.expandedProviderId() === providerId;
  }

  public onToggleExpand(providerId: string): void {
    this.expandedProviderId.update(current =>
      current === providerId ? null : providerId,
    );
  }

  public onToggleModel(_event: { providerId: string; modelId: string }): void {
    // Model toggle — managed server-side in a future iteration
  }
}
