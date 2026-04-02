import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface McpToolAccess {
  name: string;
  enabled: boolean;
}

export interface CompatibilityEntry {
  label: string;
  version: string;
}

export type AgentCategory = 'Planning' | 'Coordination' | 'Development' | 'Quality' | 'Specialist';
export type AgentType = 'base_template' | 'stack_module';
export type KnowledgeScope = 'global' | 'project' | 'team';

export interface AgentEntry {
  id: string;
  name: string;
  displayName: string;
  category: AgentCategory;
  tags: string[];
  type: AgentType;
  usedIn: string[];
  mcpTools: McpToolAccess[];
  knowledgeScope: KnowledgeScope[];
  currentVersion: number;
  changelog: string;
  isBreakingChange: boolean;
  compatibility: CompatibilityEntry[];
  content: string;
}

export type CreateAgentDto = Omit<AgentEntry, 'id'>;
export type UpdateAgentDto = Partial<Omit<AgentEntry, 'id'>>;

interface AgentsData {
  agents: AgentEntry[];
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly storagePath: string;
  private cache: AgentsData | null = null;

  public constructor(private readonly projectRoot: string) {
    this.storagePath = join(projectRoot, '.nitro-fueled', 'agents.json');
  }

  private load(): AgentsData {
    if (this.cache !== null) return this.cache;

    if (!existsSync(this.storagePath)) {
      this.cache = { agents: [] };
      return this.cache;
    }

    try {
      this.cache = JSON.parse(readFileSync(this.storagePath, 'utf-8')) as AgentsData;
      this.cache.agents ??= [];
    } catch (err) {
      this.logger.warn(`Failed to parse agents at ${this.storagePath}`, err);
      this.cache = { agents: [] };
    }

    return this.cache;
  }

  private persist(): void {
    const data = this.load();
    const dir = dirname(this.storagePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.storagePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  public list(): AgentEntry[] {
    return this.load().agents;
  }

  public getById(id: string): AgentEntry | undefined {
    return this.load().agents.find((a) => a.id === id);
  }

  public create(dto: CreateAgentDto): AgentEntry {
    const data = this.load();
    const id = `agent-${dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
    const entry: AgentEntry = { id, ...dto };
    data.agents.push(entry);
    this.persist();
    return entry;
  }

  public update(id: string, dto: UpdateAgentDto): AgentEntry | null {
    const data = this.load();
    const idx = data.agents.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    data.agents[idx] = { ...data.agents[idx], ...dto };
    this.persist();
    return data.agents[idx];
  }

  public delete(id: string): boolean {
    const data = this.load();
    const idx = data.agents.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    data.agents.splice(idx, 1);
    this.persist();
    return true;
  }
}
