import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgClass, UpperCasePipe } from '@angular/common';
import { MockDataService } from '../../services/mock-data.service';
import { StrategySelectorComponent } from './strategy-selector/strategy-selector.component';
import { WorkflowPreviewComponent } from './workflow-preview/workflow-preview.component';
import {
  StrategyCard,
  StrategyType,
  WorkflowStep,
  AgentRoleOverride,
  ProviderGroup,
} from '../../models/new-task.model';

const STRATEGY_CARDS: readonly StrategyCard[] = [
  { type: 'feature', icon: '\u2B50', name: 'Feature', description: 'New functionality' },
  { type: 'bugfix', icon: '\uD83D\uDC1B', name: 'Bugfix', description: 'Fix an issue' },
  { type: 'refactor', icon: '\uD83D\uDD27', name: 'Refactor', description: 'Improve code' },
  { type: 'docs', icon: '\uD83D\uDCDA', name: 'Docs', description: 'Documentation' },
  { type: 'research', icon: '\uD83D\uDD0E', name: 'Research', description: 'Investigation' },
  { type: 'devops', icon: '\u2699\uFE0F', name: 'DevOps', description: 'Infrastructure' },
  { type: 'creative', icon: '\uD83C\uDFA8', name: 'Creative', description: 'Design & content' },
  { type: 'custom', icon: '\uD83D\uDE80', name: 'Custom', description: 'Build your own' },
];

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { icon: '\u2714', label: 'Scope', kind: 'checkpoint' },
  { icon: '\uD83E\uDDD1', label: 'PM', kind: 'agent' },
  { icon: '\u2714', label: 'Requirements', kind: 'checkpoint' },
  { icon: '\uD83C\uDFD7\uFE0F', label: 'Architect', kind: 'agent' },
  { icon: '\u2714', label: 'Architecture', kind: 'checkpoint' },
  { icon: '\uD83D\uDC68\u200D\uD83D\uDCBC', label: 'Team Lead', kind: 'agent' },
  { icon: '\uD83D\uDD04', label: 'Dev Loop', kind: 'agent' },
  { icon: '\u2714', label: 'QA Choice', kind: 'checkpoint' },
  { icon: '\uD83E\uDDEA', label: 'QA', kind: 'agent' },
];

const AGENT_ROLES: readonly AgentRoleOverride[] = [
  { role: 'PM', badgeLabel: 'PM', badgeColor: 'blue', agentName: 'project-manager', projectDefault: 'Claude Sonnet' },
  { role: 'Architect', badgeLabel: 'Arch', badgeColor: 'purple', agentName: 'architect', projectDefault: 'Claude Opus' },
  { role: 'Team Lead', badgeLabel: 'TL', badgeColor: 'orange', agentName: 'team-leader', projectDefault: 'Claude Opus' },
  { role: 'Frontend Dev', badgeLabel: 'FE', badgeColor: 'green', agentName: 'frontend-dev', projectDefault: 'Claude Sonnet' },
  { role: 'Backend Dev', badgeLabel: 'BE', badgeColor: 'green', agentName: 'backend-dev', projectDefault: 'Codex Mini' },
];

@Component({
  selector: 'app-new-task',
  standalone: true,
  imports: [NgClass, UpperCasePipe, StrategySelectorComponent, WorkflowPreviewComponent],
  templateUrl: './new-task.component.html',
  styleUrl: './new-task.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewTaskComponent {
  private readonly mockData = inject(MockDataService);

  public readonly strategies = STRATEGY_CARDS;
  public readonly workflowSteps = WORKFLOW_STEPS;
  public readonly agentRoles = AGENT_ROLES;
  public readonly providerGroups: readonly ProviderGroup[] = this.mockData.getProviderGroups();

  public title = '';
  public description = '';
  public selectedStrategy: StrategyType = 'feature';
  public advancedOpen = false;
  public modelOverrideEnabled = false;
  public modelOverrides: Record<string, string> = {};

  public get autoDetectLabel(): string | null {
    if (!this.description.trim()) return null;
    return 'FEATURE \u2014 based on keywords';
  }

  public get costEstimate(): string {
    return '$2.50 \u2013 $5.00';
  }

  public onTitleInput(event: Event): void {
    this.title = (event.target as HTMLInputElement).value;
  }

  public onDescriptionInput(event: Event): void {
    this.description = (event.target as HTMLTextAreaElement).value;
  }

  public onStrategyChange(type: StrategyType): void {
    this.selectedStrategy = type;
  }

  public toggleAdvanced(): void {
    this.advancedOpen = !this.advancedOpen;
  }

  public toggleModelOverride(): void {
    this.modelOverrideEnabled = !this.modelOverrideEnabled;
  }

  public onModelOverrideChange(role: string, event: Event): void {
    this.modelOverrides[role] = (event.target as HTMLSelectElement).value;
  }

  public getDefaultLabel(role: AgentRoleOverride): string {
    return `Use default (${role.projectDefault})`;
  }
}
