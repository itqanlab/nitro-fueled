export interface OnboardingClient {
  readonly name: string;
  readonly activeProjects: number;
  readonly budgetUsed: number;
  readonly budgetTotal: number;
}

export interface ExternalReference {
  readonly type: 'url' | 'file';
  readonly value: string;
}

export type RecommendationStatus = 'complete' | 'loading' | 'pending';

export interface AiRecommendation {
  readonly title: string;
  readonly status: RecommendationStatus;
  readonly description: string;
}

export interface FolderNode {
  readonly name: string;
  readonly type: 'dir' | 'file';
  readonly color?: 'moved' | 'new';
  readonly indent: number;
}

export interface ChatMessage {
  readonly sender: 'ai' | 'user';
  readonly text: string;
  readonly time: string;
}

export interface DataSummaryItem {
  readonly value: number;
  readonly label: string;
}

export interface WizardStep {
  readonly index: number;
  readonly label: string;
}

export const WIZARD_STEPS: readonly WizardStep[] = [
  { index: 1, label: 'Client' },
  { index: 2, label: 'Folder' },
  { index: 3, label: 'Data Collection' },
  { index: 4, label: 'AI Analysis' },
  { index: 5, label: 'Team' },
  { index: 6, label: 'Review' },
  { index: 7, label: 'Setup' },
];
