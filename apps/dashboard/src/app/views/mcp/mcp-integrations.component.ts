import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import {
  MOCK_MCP_SERVERS,
  MOCK_MCP_TOOL_ACCESS,
  MOCK_MCP_INTEGRATIONS,
} from '../../services/mock-data.constants';
import { CompatibilityMatrixComponent } from './compatibility-matrix/compatibility-matrix.component';
import { IntegrationsTabComponent } from './integrations-tab/integrations-tab.component';
import { TabNavComponent, TabItem } from '../../shared/tab-nav/tab-nav.component';

interface ServerFormModel {
  package: string;
  transport: 'stdio' | 'HTTP';
}

@Component({
  selector: 'app-mcp-integrations',
  standalone: true,
  imports: [NgClass, TabNavComponent, CompatibilityMatrixComponent, IntegrationsTabComponent, FormsModule],
  templateUrl: './mcp-integrations.component.html',
  styleUrl: './mcp-integrations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class McpIntegrationsComponent {
  public readonly servers = MOCK_MCP_SERVERS;
  public readonly toolAccess = MOCK_MCP_TOOL_ACCESS;
  public readonly integrations = MOCK_MCP_INTEGRATIONS;

  public readonly tabs: TabItem[] = [
    { id: 'servers', label: 'MCP Servers', count: this.servers.length },
    { id: 'integrations', label: 'Integrations', count: this.integrations.length },
  ];

  public activeTab: 'servers' | 'integrations' = 'servers';
  public get activeTabStr(): string {
    return this.activeTab;
  }
  public serverFormModel: ServerFormModel = {
    package: '',
    transport: 'stdio'
  };
  public serverFormSubmitted = false;

  public readonly activeServerCount = this.servers.filter(
    (s) => s.status === 'active',
  ).length;

  public readonly totalToolCount = this.servers.reduce((sum, s) => {
    const n = parseInt(s.toolCount, 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

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

  public onAddServerSubmit(event: Event): void {
    event.preventDefault();
    this.serverFormSubmitted = true;

    if (this.validateServerForm()) {
      this.processServerInstallation();
    }
  }

  private validateServerForm(): boolean {
    const isValid = this.serverFormModel.package.length > 0 && 
                   this.serverFormModel.transport.length > 0;
    
    if (!isValid) {
      console.error('Server form validation failed');
    }

    return isValid;
  }

  private processServerInstallation(): void {
    console.log('Processing server installation:', this.serverFormModel);
    
    this.resetForm();
    
    console.log('Server installation process completed');
  }

  private resetForm(): void {
    this.serverFormModel = {
      package: '',
      transport: 'stdio'
    };
    this.serverFormSubmitted = false;
  }

  handleTabChange(tabId: string): void {
    const validTabs: ('servers' | 'integrations')[] = ['servers', 'integrations'];
    if (validTabs.includes(tabId as 'servers' | 'integrations')) {
      this.activeTab = tabId as 'servers' | 'integrations';
    } else {
      console.warn(`Invalid tab ID: ${tabId}. Defaulting to 'servers'.`);
      this.activeTab = 'servers';
    }
  }
}
