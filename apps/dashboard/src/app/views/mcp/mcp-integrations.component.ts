import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { MockDataService } from '../../services/mock-data.service';
import { CompatibilityMatrixComponent } from './compatibility-matrix/compatibility-matrix.component';
import { IntegrationsTabComponent } from './integrations-tab/integrations-tab.component';

@Component({
  selector: 'app-mcp-integrations',
  standalone: true,
  imports: [NgClass, CompatibilityMatrixComponent, IntegrationsTabComponent],
  templateUrl: './mcp-integrations.component.html',
  styleUrl: './mcp-integrations.component.scss',
})
export class McpIntegrationsComponent {
  private readonly mockData = inject(MockDataService);

  public readonly servers = this.mockData.getMcpServers();
  public readonly toolAccess = this.mockData.getMcpToolAccess();
  public readonly integrations = this.mockData.getMcpIntegrations();

  public activeTab: 'servers' | 'integrations' = 'servers';

  public readonly activeServerCount = this.servers.filter(
    (s) => s.status === 'active',
  ).length;

  public readonly totalToolCount = this.servers.reduce((sum, s) => {
    const n = parseInt(s.toolCount, 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  public switchTab(tab: 'servers' | 'integrations'): void {
    this.activeTab = tab;
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
}
