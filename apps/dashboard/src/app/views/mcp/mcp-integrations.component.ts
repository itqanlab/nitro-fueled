import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, McpServerEntry, McpInstallRequest } from '../../services/api.service';
import { MOCK_MCP_INTEGRATIONS } from '../../services/mock-data.constants';
import { McpServer, McpToolAccessRow } from '../../models/mcp.model';
import { CompatibilityMatrixComponent } from './compatibility-matrix/compatibility-matrix.component';
import { IntegrationsTabComponent } from './integrations-tab/integrations-tab.component';
import { TabNavComponent, TabItem } from '../../shared/tab-nav/tab-nav.component';

interface ServerFormModel {
  package: string;
  transport: 'stdio' | 'HTTP';
}

function mapServerEntry(entry: McpServerEntry): McpServer {
  return {
    name: entry.name,
    icon: entry.name.slice(0, 2).toUpperCase(),
    iconClass: entry.source === 'project' ? 'icon-builtin' : 'icon-user',
    status: entry.status === 'active' ? 'active' : 'inactive',
    badgeType: entry.source === 'project' ? 'Built-in' : 'User',
    transport: entry.command === 'http' ? 'HTTP' : 'stdio',
    toolCount: '0',
    teams: ['All teams'],
    tools: [],
  };
}

@Component({
  selector: 'app-mcp-integrations',
  standalone: true,
  imports: [NgClass, TabNavComponent, CompatibilityMatrixComponent, IntegrationsTabComponent, FormsModule],
  templateUrl: './mcp-integrations.component.html',
  styleUrl: './mcp-integrations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class McpIntegrationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  public servers: McpServer[] = [];
  public toolAccess: McpToolAccessRow[] = [];
  public readonly integrations = MOCK_MCP_INTEGRATIONS;

  public readonly tabs: TabItem[] = [
    { id: 'servers', label: 'MCP Servers', count: 0 },
    { id: 'integrations', label: 'Integrations', count: this.integrations.length },
  ];

  public activeTab: 'servers' | 'integrations' = 'servers';
  public get activeTabStr(): string {
    return this.activeTab;
  }
  public serverFormModel: ServerFormModel = {
    package: '',
    transport: 'stdio',
  };
  public serverFormSubmitted = false;

  public get activeServerCount(): number {
    return this.servers.filter((s) => s.status === 'active').length;
  }

  public get totalToolCount(): number {
    return this.servers.reduce((sum, s) => {
      const n = parseInt(s.toolCount, 10);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }

  public ngOnInit(): void {
    this.loadServers();
    this.loadToolAccess();
  }

  private loadServers(): void {
    this.api
      .getMcpServers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entries) => {
        this.servers = entries.map(mapServerEntry);
        this.cdr.markForCheck();
      });
  }

  private loadToolAccess(): void {
    this.api
      .getMcpToolAccess()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((matrix) => {
        this.toolAccess = matrix.agents.map((row) => ({ agent: row.agent, access: row.access }));
        this.cdr.markForCheck();
      });
  }

  public getTeamClass(team: string): string {
    if (team === 'All teams') return 'all';
    if (team === 'Engineering') return 'eng';
    if (team === 'Design') return 'design';
    return '';
  }

  public getBadgeTypeClass(badgeType: string): string {
    return badgeType === 'Built-in' ? 'badge-builtin' : 'badge-user';
  }

  public getTransportClass(transport: string): string {
    return transport === 'stdio' ? 'badge-stdio' : 'badge-http';
  }

  public onRestartServer(server: McpServer): void {
    this.api
      .restartMcpServer(server.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadServers();
      });
  }

  public onRemoveServer(server: McpServer): void {
    this.api
      .removeMcpServer(server.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.servers = this.servers.filter((s) => s.name !== server.name);
        this.cdr.markForCheck();
      });
  }

  public onAddServerSubmit(event: Event): void {
    event.preventDefault();
    this.serverFormSubmitted = true;

    if (this.serverFormModel.package.length === 0) {
      return;
    }

    const req: McpInstallRequest = {
      name: this.serverFormModel.package,
      command: this.serverFormModel.transport === 'HTTP' ? 'http' : 'npx',
      args: this.serverFormModel.transport === 'stdio' ? [this.serverFormModel.package] : [],
    };

    this.api
      .addMcpServer(req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entry) => {
        this.servers = [...this.servers, mapServerEntry(entry)];
        this.resetForm();
        this.cdr.markForCheck();
      });
  }

  private resetForm(): void {
    this.serverFormModel = {
      package: '',
      transport: 'stdio',
    };
    this.serverFormSubmitted = false;
  }

  public handleTabChange(tabId: string): void {
    const validTabs: ('servers' | 'integrations')[] = ['servers', 'integrations'];
    if (validTabs.includes(tabId as 'servers' | 'integrations')) {
      this.activeTab = tabId as 'servers' | 'integrations';
    } else {
      this.activeTab = 'servers';
    }
  }
}
