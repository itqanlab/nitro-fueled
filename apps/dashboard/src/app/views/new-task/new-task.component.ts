import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgClass, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MOCK_PROVIDER_GROUPS } from '../../services/new-task.constants';
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

const COST_RANGES: Record<StrategyType, string> = {
  feature:  '$2.50 \u2013 $5.00',
  bugfix:   '$1.00 \u2013 $2.50',
  refactor: '$1.50 \u2013 $3.00',
  docs:     '$0.50 \u2013 $1.50',
  research: '$1.00 \u2013 $2.00',
  devops:   '$2.00 \u2013 $4.00',
  creative: '$1.00 \u2013 $2.50',
  custom:   '$1.00 \u2013 $5.00',
};

const KEYWORD_STRATEGY_MAP: ReadonlyArray<{ pattern: RegExp; type: StrategyType }> = [
  { pattern: /\b(fix|bug|error|broken|crash|issue|problem|fail|regression)\b/i, type: 'bugfix' },
  { pattern: /\b(refactor|cleanup|clean up|restructure|reorganize|simplify)\b/i, type: 'refactor' },
  { pattern: /\b(document|readme|guide|wiki|docs?|write up)\b/i, type: 'docs' },
  { pattern: /\b(research|investigate|explore|spike|poc|proof of concept)\b/i, type: 'research' },
  { pattern: /\b(deploy|pipeline|ci|cd|docker|kubernetes|infra|infrastructure|devops)\b/i, type: 'devops' },
  { pattern: /\b(design|mockup|style|visual|creative|brand|logo)\b/i, type: 'creative' },
];

@Component({
  selector: 'app-new-task',
  standalone: true,
  imports: [NgClass, UpperCasePipe, FormsModule, RouterLink, StrategySelectorComponent, WorkflowPreviewComponent],
  templateUrl: './new-task.component.html',
  styleUrl: './new-task.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewTaskComponent {
  private readonly router = inject(Router);

  public readonly strategies = STRATEGY_CARDS;
  public readonly workflowSteps = WORKFLOW_STEPS;
  public readonly agentRoles = AGENT_ROLES;
  public readonly providerGroups: readonly ProviderGroup[] = MOCK_PROVIDER_GROUPS;

  public title = '';
  public description = '';
  public selectedStrategy: StrategyType = 'feature';
  public advancedOpen = false;
  public modelOverrideEnabled = false;
  public modelOverrides: Record<string, string> = {};
  public attachedFiles: readonly File[] = [];
  public isDragging = false;

  public get autoDetectLabel(): string | null {
    if (!this.description.trim()) return null;
    const detected = KEYWORD_STRATEGY_MAP.find((entry) => entry.pattern.test(this.description));
    const type = detected?.type ?? 'feature';
    const card = this.strategies.find((s) => s.type === type);
    return `${card?.name.toUpperCase() ?? 'FEATURE'} \u2014 based on keywords`;
  }

  public get costEstimate(): string {
    return COST_RANGES[this.selectedStrategy];
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
    if (!(event.target instanceof HTMLSelectElement)) return;
    const value = event.target.value;
    if (value === '') {
      delete this.modelOverrides[role];
    } else {
      this.modelOverrides[role] = value;
    }
  }

  public getDefaultLabel(role: AgentRoleOverride): string {
    return `Use default (${role.projectDefault})`;
  }

  public onAttachmentZoneClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  public onAttachmentFileSelect(event: Event): void {
    if (!(event.target instanceof HTMLInputElement) || !event.target.files) return;
    this.attachedFiles = [...this.attachedFiles, ...Array.from(event.target.files)];
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  public onDragLeave(): void {
    this.isDragging = false;
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    if (!event.dataTransfer?.files) return;
    this.attachedFiles = [...this.attachedFiles, ...Array.from(event.dataTransfer.files)];
  }

  public onCancel(): void {
    void this.router.navigate(['/dashboard']);
  }

  public onSaveDraft(): void {
    // Draft persistence will be implemented when the task API is wired
  }

  public onStartTask(): void {
    // Task creation will be implemented when the task API is wired
  }
}
