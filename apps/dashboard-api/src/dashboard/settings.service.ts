import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface ApiKeyEntry {
  id: string;
  key: string;
  label?: string;
  providerId?: string;
  provider: string;
  status: 'valid' | 'invalid' | 'untested';
  isActive: boolean;
  detectedModels: string[];
}

export interface LauncherEntry {
  id: string;
  name: string;
  type: 'cli' | 'ide' | 'desktop';
  path: string;
  status: 'detected' | 'manual' | 'missing';
  isActive: boolean;
}

export interface SubscriptionEntry {
  id: string;
  providerId: string;
  provider: string;
  connectionStatus: 'connected' | 'disconnected' | 'expired';
  isActive: boolean;
  availableModels: string[];
}

export interface ModelMapping {
  id: string;
  modelId: string;
  launcherId: string;
  isDefault: boolean;
}

interface SettingsData {
  apiKeys: ApiKeyEntry[];
  launchers: LauncherEntry[];
  subscriptions: SubscriptionEntry[];
  mappings: ModelMapping[];
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly settingsPath: string;
  private cache: SettingsData | null = null;

  public constructor(private readonly projectRoot: string) {
    this.settingsPath = join(projectRoot, '.nitro-fueled', 'settings.json');
  }

  private load(): SettingsData {
    if (this.cache !== null) return this.cache;

    if (!existsSync(this.settingsPath)) {
      this.cache = { apiKeys: [], launchers: [], subscriptions: [], mappings: [] };
      return this.cache;
    }

    try {
      this.cache = JSON.parse(readFileSync(this.settingsPath, 'utf-8')) as SettingsData;
      this.cache.apiKeys ??= [];
      this.cache.launchers ??= [];
      this.cache.subscriptions ??= [];
      this.cache.mappings ??= [];
    } catch (err) {
      this.logger.warn(`Failed to parse settings at ${this.settingsPath}`, err);
      this.cache = { apiKeys: [], launchers: [], subscriptions: [], mappings: [] };
    }

    return this.cache;
  }

  private persist(): void {
    const dir = dirname(this.settingsPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.settingsPath, JSON.stringify(this.cache, null, 2) + '\n', 'utf-8');
  }

  private generateId(): string {
    return `id-${Date.now()}`;
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  public listApiKeys(): ApiKeyEntry[] {
    return this.load().apiKeys;
  }

  public createApiKey(data: {
    label?: string;
    key: string;
    providerId?: string;
    provider: string;
    detectedModels?: string[];
  }): ApiKeyEntry {
    const settings = this.load();
    const entry: ApiKeyEntry = {
      id: this.generateId(),
      key: data.key,
      label: data.label,
      providerId: data.providerId,
      provider: data.provider,
      status: 'untested',
      isActive: true,
      detectedModels: data.detectedModels ?? [],
    };
    settings.apiKeys.push(entry);
    this.persist();
    return entry;
  }

  public updateApiKey(id: string, patch: Partial<Omit<ApiKeyEntry, 'id'>>): ApiKeyEntry | null {
    const settings = this.load();
    const index = settings.apiKeys.findIndex((k) => k.id === id);
    if (index === -1) return null;
    settings.apiKeys[index] = { ...settings.apiKeys[index], ...patch };
    this.persist();
    return settings.apiKeys[index];
  }

  public deleteApiKey(id: string): boolean {
    const settings = this.load();
    const before = settings.apiKeys.length;
    settings.apiKeys = settings.apiKeys.filter((k) => k.id !== id);
    if (settings.apiKeys.length === before) return false;
    this.persist();
    return true;
  }

  public setApiKeyActive(id: string, isActive: boolean): ApiKeyEntry | null {
    return this.updateApiKey(id, { isActive });
  }

  // ── Launchers ─────────────────────────────────────────────────────────────

  public listLaunchers(): LauncherEntry[] {
    return this.load().launchers;
  }

  public createLauncher(data: {
    name: string;
    type: 'cli' | 'ide' | 'desktop';
    path: string;
  }): LauncherEntry {
    const settings = this.load();
    const entry: LauncherEntry = {
      id: this.generateId(),
      name: data.name,
      type: data.type,
      path: data.path,
      status: 'manual',
      isActive: true,
    };
    settings.launchers.push(entry);
    this.persist();
    return entry;
  }

  public setLauncherActive(id: string, isActive: boolean): LauncherEntry | null {
    const settings = this.load();
    const index = settings.launchers.findIndex((l) => l.id === id);
    if (index === -1) return null;
    settings.launchers[index] = { ...settings.launchers[index], isActive };
    this.persist();
    return settings.launchers[index];
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  public listSubscriptions(): SubscriptionEntry[] {
    return this.load().subscriptions;
  }

  public connectSubscription(id: string): SubscriptionEntry | null {
    const settings = this.load();
    const index = settings.subscriptions.findIndex((s) => s.id === id);
    if (index === -1) return null;
    settings.subscriptions[index] = {
      ...settings.subscriptions[index],
      connectionStatus: 'connected',
      isActive: true,
    };
    this.persist();
    return settings.subscriptions[index];
  }

  public disconnectSubscription(id: string): SubscriptionEntry | null {
    const settings = this.load();
    const index = settings.subscriptions.findIndex((s) => s.id === id);
    if (index === -1) return null;
    settings.subscriptions[index] = {
      ...settings.subscriptions[index],
      connectionStatus: 'disconnected',
      isActive: false,
    };
    this.persist();
    return settings.subscriptions[index];
  }

  // ── Model Mapping ─────────────────────────────────────────────────────────

  public listMappings(): ModelMapping[] {
    return this.load().mappings;
  }

  public replaceMappings(mappings: ModelMapping[]): ModelMapping[] {
    const settings = this.load();
    settings.mappings = mappings;
    this.persist();
    return settings.mappings;
  }
}
