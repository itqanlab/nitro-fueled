import { Injectable, Logger } from '@nestjs/common';

export type ProviderId = 'glm' | 'anthropic' | 'openai';

export interface ProviderQuotaAvailable {
  readonly provider: ProviderId;
  readonly unavailable: false;
  readonly plan: string;
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: string | null;
  readonly currency: string;
  readonly costThisPeriod: number;
}

export interface ProviderQuotaUnavailable {
  readonly provider: ProviderId;
  readonly unavailable: true;
  readonly reason: string;
}

export type ProviderQuotaItem = ProviderQuotaAvailable | ProviderQuotaUnavailable;

interface CacheEntry {
  readonly items: ProviderQuotaItem[];
  readonly expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private readonly cache = new Map<string, CacheEntry>();

  public async getQuota(): Promise<ProviderQuotaItem[]> {
    const cached = this.cache.get('quota');
    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }

    const [glm, anthropic, openai] = await Promise.allSettled([
      this.fetchGlm(),
      this.fetchAnthropic(),
      this.fetchOpenai(),
    ]);

    const items: ProviderQuotaItem[] = [
      glm.status === 'fulfilled' ? glm.value : this.unavailable('glm', glm.reason),
      anthropic.status === 'fulfilled' ? anthropic.value : this.unavailable('anthropic', anthropic.reason),
      openai.status === 'fulfilled' ? openai.value : this.unavailable('openai', openai.reason),
    ];

    this.cache.set('quota', { items, expiresAt: Date.now() + CACHE_TTL_MS });
    return items;
  }

  private unavailable(provider: ProviderId, reason: unknown): ProviderQuotaUnavailable {
    const message = reason instanceof Error ? reason.message : String(reason);
    this.logger.warn(`Provider ${provider} unavailable: ${message.slice(0, 200)}`);
    const statusMatch = message.match(/returned (\d{3})/);
    const publicReason = statusMatch
      ? `Provider API returned HTTP ${statusMatch[1]}`
      : 'Provider API unavailable';
    return { provider, unavailable: true, reason: publicReason };
  }

  private async fetchGlm(): Promise<ProviderQuotaItem> {
    const key = process.env['ZAI_API_KEY'];
    if (!key) {
      return { provider: 'glm', unavailable: true, reason: 'ZAI_API_KEY not set' };
    }

    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/user/usage', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      throw new Error(`GLM API returned ${resp.status}`);
    }

    const body = await resp.json() as Record<string, unknown>;
    const data = body['data'] as Record<string, number> | undefined;
    if (!data) {
      throw new Error('GLM API returned unexpected response shape');
    }

    const total = data['total_tokens'] ?? 0;
    const remaining = data['remaining_tokens'] ?? 0;
    const used = Math.max(0, total - remaining);

    return {
      provider: 'glm',
      unavailable: false,
      plan: 'ZAI Coding Plan',
      used,
      limit: total,
      remaining,
      resetAt: null,
      currency: 'CNY',
      costThisPeriod: 0,
    };
  }

  private async fetchAnthropic(): Promise<ProviderQuotaItem> {
    const key = process.env['ANTHROPIC_ADMIN_KEY'];
    if (!key) {
      return { provider: 'anthropic', unavailable: true, reason: 'ANTHROPIC_ADMIN_KEY not set' };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startTs = Math.floor(startOfMonth.getTime() / 1000);
    const endTs = Math.floor(now.getTime() / 1000);

    const resp = await fetch(
      `https://api.anthropic.com/v1/organizations/usage?start_time=${startTs}&end_time=${endTs}`,
      {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!resp.ok) {
      throw new Error(`Anthropic API returned ${resp.status}`);
    }

    const body = await resp.json() as Record<string, unknown>;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    const usageRows = body['usage'] as Array<Record<string, number>> | undefined;
    if (usageRows && Array.isArray(usageRows)) {
      for (const row of usageRows) {
        totalInputTokens += row['input_tokens'] ?? 0;
        totalOutputTokens += row['output_tokens'] ?? 0;
        totalCost += row['cost'] ?? 0;
      }
    }

    return {
      provider: 'anthropic',
      unavailable: false,
      plan: 'Anthropic API',
      used: totalInputTokens + totalOutputTokens,
      limit: 0,
      remaining: 0,
      resetAt: null,
      currency: 'USD',
      costThisPeriod: totalCost,
    };
  }

  private async fetchOpenai(): Promise<ProviderQuotaItem> {
    const key = process.env['OPENAI_ADMIN_KEY'];
    if (!key) {
      return { provider: 'openai', unavailable: true, reason: 'OPENAI_ADMIN_KEY not set' };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startTs = Math.floor(startOfMonth.getTime() / 1000);

    const resp = await fetch(
      `https://api.openai.com/v1/organization/usage?start_time=${startTs}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!resp.ok) {
      throw new Error(`OpenAI API returned ${resp.status}`);
    }

    const body = await resp.json() as Record<string, unknown>;
    let contextTokens = 0;
    let generatedTokens = 0;
    let totalCost = 0;

    const buckets = body['data'] as Array<Record<string, number>> | undefined;
    if (buckets && Array.isArray(buckets)) {
      for (const bucket of buckets) {
        contextTokens += bucket['n_context_tokens_total'] ?? 0;
        generatedTokens += bucket['n_generated_tokens_total'] ?? 0;
        totalCost += bucket['cost'] ?? 0;
      }
    }

    return {
      provider: 'openai',
      unavailable: false,
      plan: 'OpenAI API',
      used: contextTokens + generatedTokens,
      limit: 0,
      remaining: 0,
      resetAt: null,
      currency: 'USD',
      costThisPeriod: totalCost,
    };
  }
}
