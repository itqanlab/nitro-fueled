import { Injectable } from '@angular/core';
import { AgentEditorData } from '../models/agent-editor.model';
import { Project } from '../models/project.model';
import { Task } from '../models/task.model';
import { Agent } from '../models/agent.model';
import { ActivityEntry } from '../models/session.model';
import { AnalyticsSummary } from '../models/analytics-summary.model';
import { StatusIndicator } from '../models/provider.model';
import { SidebarSection } from '../models/sidebar.model';
import { McpServer, McpToolAccessRow, McpIntegration } from '../models/mcp.model';
import { AnalyticsData } from '../models/analytics.model';
import { ModelAssignmentsData } from '../models/model-assignment.model';
import { ProviderGroup } from '../models/new-task.model';
import { ProviderHubData } from '../models/provider-hub.model';
import { CommandCenterData } from '../models/dashboard.model';
import { MOCK_PROVIDER_HUB_DATA } from './provider-hub.constants';
import {
  MOCK_AGENT_EDITOR_LIST,
  MOCK_PROJECTS,
  MOCK_ACTIVE_TASKS,
  MOCK_COMPLETED_TASKS,
  MOCK_AGENTS,
  MOCK_ACTIVITY,
  MOCK_ANALYTICS,
  MOCK_STATUS_INDICATORS,
  MOCK_SIDEBAR_SECTIONS,
  MOCK_MCP_SERVERS,
  MOCK_MCP_TOOL_ACCESS,
  MOCK_MCP_INTEGRATIONS,
  MOCK_ANALYTICS_PAGE_DATA,
  MOCK_COMMAND_CENTER_DATA,
} from './mock-data.constants';
import { MOCK_MODEL_ASSIGNMENTS_DATA } from './model-assignment.constants';
import { MOCK_PROVIDER_GROUPS } from './new-task.constants';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  public getProjects(): readonly Project[] {
    return MOCK_PROJECTS;
  }

  public getActiveTasks(): readonly Task[] {
    return MOCK_ACTIVE_TASKS;
  }

  public getCompletedTasks(): readonly Task[] {
    return MOCK_COMPLETED_TASKS;
  }

  public getAgents(): readonly Agent[] {
    return MOCK_AGENTS;
  }

  public getActivity(): readonly ActivityEntry[] {
    return MOCK_ACTIVITY;
  }

  public getAnalytics(): AnalyticsSummary {
    return MOCK_ANALYTICS;
  }

  public getStatusIndicators(): readonly StatusIndicator[] {
    return MOCK_STATUS_INDICATORS;
  }

  public getSidebarSections(): readonly SidebarSection[] {
    return MOCK_SIDEBAR_SECTIONS;
  }

  public getMcpServers(): readonly McpServer[] {
    return MOCK_MCP_SERVERS;
  }

  public getMcpToolAccess(): readonly McpToolAccessRow[] {
    return MOCK_MCP_TOOL_ACCESS;
  }

  public getMcpIntegrations(): readonly McpIntegration[] {
    return MOCK_MCP_INTEGRATIONS;
  }

  public getMcpConnectionCount(): number {
    return 5;
  }

  public getAutoRunEnabled(): boolean {
    return false;
  }

  public getMonthlyBudget(): { readonly used: number; readonly total: number } {
    return { used: 47.30, total: 100 };
  }

  public getAnalyticsPageData(): AnalyticsData {
    return MOCK_ANALYTICS_PAGE_DATA;
  }

  public getAgentEditorList(): readonly AgentEditorData[] {
    return MOCK_AGENT_EDITOR_LIST;
  }

  public getAgentEditorData(id: string): AgentEditorData | undefined {
    return MOCK_AGENT_EDITOR_LIST.find((a) => a.id === id);
  }

  public getModelAssignmentsData(): ModelAssignmentsData {
    return MOCK_MODEL_ASSIGNMENTS_DATA;
  }

  public getProviderHubData(): ProviderHubData {
    return MOCK_PROVIDER_HUB_DATA;
  }

  public getProviderGroups(): readonly ProviderGroup[] {
    return MOCK_PROVIDER_GROUPS;
  }

  public getCommandCenterData(): CommandCenterData {
    return MOCK_COMMAND_CENTER_DATA;
  }
}
