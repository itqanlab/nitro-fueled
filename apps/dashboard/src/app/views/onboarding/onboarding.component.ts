import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NgClass, DecimalPipe, UpperCasePipe } from '@angular/common';
import {
  WIZARD_STEPS,
  OnboardingClient,
  ExternalReference,
  AiRecommendation,
  FolderNode,
  ChatMessage,
  DataSummaryItem,
} from '../../models/onboarding.model';
import { WizardStepIndicatorComponent } from './wizard/wizard-step.component';
import { ChatPanelComponent } from './chat-panel/chat-panel.component';
import { FolderTreeComponent } from './folder-tree/folder-tree.component';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [NgClass, DecimalPipe, UpperCasePipe, WizardStepIndicatorComponent, ChatPanelComponent, FolderTreeComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent {
  public readonly steps = WIZARD_STEPS;
  public readonly currentStep = signal(4);

  public readonly clients: readonly OnboardingClient[] = [
    { name: 'Acme Corp', activeProjects: 3, budgetUsed: 2400, budgetTotal: 5000 },
    { name: 'Internal', activeProjects: 1, budgetUsed: 800, budgetTotal: 2000 },
    { name: 'TechStart', activeProjects: 2, budgetUsed: 1200, budgetTotal: 3000 },
  ];

  public readonly selectedClient = signal<OnboardingClient>(this.clients[0]);

  public readonly projectPath = '/Users/dev/projects/e-commerce-api';

  public readonly externalRefs: readonly ExternalReference[] = [
    { type: 'url', value: 'https://figma.com/file/abc123/e-commerce-designs' },
    { type: 'file', value: '/Users/dev/docs/api-requirements.pdf' },
  ];

  public readonly dataSummary: readonly DataSummaryItem[] = [
    { value: 247, label: 'Files scanned' },
    { value: 38, label: 'Dependencies found' },
    { value: 12, label: 'Config files detected' },
  ];

  public readonly recommendations: readonly AiRecommendation[] = [
    {
      title: 'Stack Detection',
      status: 'complete',
      description: 'Detected <strong>8 technologies</strong> from package.json, nx.json, and tsconfig.base.json: Angular 19, NestJS 10, PostgreSQL, Prisma 5, Nx Monorepo, Tailwind, Jest, GitHub Actions',
    },
    {
      title: 'Team Composition',
      status: 'complete',
      description: 'Recommending <strong>10 agents</strong> based on stack: Project Manager, Software Architect, Team Leader, Frontend Developer (Angular), Backend Developer (NestJS + Prisma), Senior Tester (Jest), Code Logic Reviewer, Code Style Reviewer, DevOps Engineer (GitHub Actions), Researcher Expert',
    },
    {
      title: 'Workflow Patterns',
      status: 'loading',
      description: 'Determining optimal workflow based on monorepo structure and team size...',
    },
    {
      title: 'Folder Organization',
      status: 'pending',
      description: 'Waiting for workflow analysis to complete...',
    },
  ];

  public readonly recommendationViews = this.recommendations.map((r) => ({
    ...r,
    icon: r.status === 'complete' ? '✅' : '⏳',
    badgeLabel: r.status === 'complete' ? 'AI Recommended' : r.status === 'loading' ? 'Analyzing...' : 'Pending',
    isPending: r.status === 'pending',
    isLoading: r.status === 'loading',
  }));

  public readonly foldersBefore: readonly FolderNode[] = [
    { name: '/e-commerce-api', type: 'dir', indent: 0 },
    { name: 'README.md', type: 'file', indent: 1 },
    { name: 'meeting-notes.docx', type: 'file', indent: 1, color: 'moved' },
    { name: 'design-v2-final.fig', type: 'file', indent: 1, color: 'moved' },
    { name: 'api-spec-draft.pdf', type: 'file', indent: 1, color: 'moved' },
    { name: '/src', type: 'dir', indent: 1 },
    { name: '/app', type: 'file', indent: 2 },
    { name: '/libs', type: 'file', indent: 2 },
    { name: '/docs', type: 'dir', indent: 1 },
    { name: 'setup.md', type: 'file', indent: 2 },
  ];

  public readonly foldersAfter: readonly FolderNode[] = [
    { name: '/e-commerce-api', type: 'dir', indent: 0 },
    { name: 'README.md', type: 'file', indent: 1 },
    { name: '/src', type: 'dir', indent: 1 },
    { name: '/app', type: 'file', indent: 2 },
    { name: '/libs', type: 'file', indent: 2 },
    { name: '/docs', type: 'dir', indent: 1 },
    { name: 'setup.md', type: 'file', indent: 2 },
    { name: 'api-spec-draft.pdf', type: 'file', indent: 2, color: 'new' },
    { name: '/assets', type: 'dir', indent: 1, color: 'new' },
    { name: 'design-v2-final.fig', type: 'file', indent: 2, color: 'new' },
    { name: '/notes', type: 'dir', indent: 1, color: 'new' },
    { name: 'meeting-notes.docx', type: 'file', indent: 2, color: 'new' },
  ];

  public readonly chatMessages = signal<readonly ChatMessage[]>([
    { sender: 'ai', text: 'I\'ve analyzed your project at <strong>/Users/dev/projects/e-commerce-api</strong>. Here\'s what I found: Angular 19 frontend with NestJS 10 backend in an Nx monorepo. 247 files, 38 dependencies.', time: '2:34 PM' },
    { sender: 'ai', text: 'I recommend an <strong>Engineering team with 10 agents</strong>. Would you also like a Design team? I noticed Figma references in your external links.', time: '2:34 PM' },
    { sender: 'user', text: 'Yes, add a Design team. Also, do we need a devops-engineer?', time: '2:35 PM' },
    { sender: 'ai', text: 'Added! For DevOps — I see GitHub Actions configs in your repo, so I\'d recommend including <strong>devops-engineer</strong>. I\'ve updated the team recommendations above.', time: '2:35 PM' },
    { sender: 'ai', text: 'Any other changes before we proceed to Team Assembly?', time: '2:36 PM' },
  ]);

  public readonly nextStepLabel = computed(() => {
    const next = this.currentStep() + 1;
    const step = this.steps.find((s) => s.index === next);
    return step ? step.label : 'Finish';
  });

  public readonly isFirstStep = computed(() => this.currentStep() === 1);
  public readonly isLastStep = computed(() => this.currentStep() === this.steps.length);

  public goNext(): void {
    if (!this.isLastStep()) {
      this.currentStep.update((s) => s + 1);
    }
  }

  public goBack(): void {
    if (!this.isFirstStep()) {
      this.currentStep.update((s) => s - 1);
    }
  }

  public onClientChange(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    const client = this.clients.find((c) => c.name === name);
    if (client) this.selectedClient.set(client);
  }

  public onChatMessage(text: string): void {
    this.chatMessages.update((msgs) => [
      ...msgs,
      { sender: 'user' as const, text, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) },
    ]);
  }
}
