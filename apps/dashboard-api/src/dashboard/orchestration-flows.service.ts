import { Injectable } from '@nestjs/common';

export interface OrchestrationFlowPhase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isOptional: boolean;
  readonly outputs: readonly string[];
}

export interface OrchestrationFlow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly taskTypes: readonly string[];
  readonly phases: readonly OrchestrationFlowPhase[];
  readonly hasParallelReview: boolean;
  readonly strategy: string;
}

const ORCHESTRATION_FLOWS: readonly OrchestrationFlow[] = [
  {
    id: 'feature',
    name: 'Feature Implementation',
    description: 'Full feature development workflow with architecture review and parallel QA',
    taskTypes: ['FEATURE'],
    hasParallelReview: true,
    strategy: 'PM -> [Research] -> Architect -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker | Completion Worker]',
    phases: [
      { id: 'pm', name: 'PM', description: 'Gathers context, defines requirements and scope', isOptional: false, outputs: ['context.md', 'task-description.md'] },
      { id: 'research', name: 'Research', description: 'Investigates codebase patterns and dependencies', isOptional: true, outputs: ['research-findings'] },
      { id: 'architect', name: 'Architect', description: 'Designs technical approach and component structure', isOptional: false, outputs: ['plan.md'] },
      { id: 'team-leader', name: 'Team-Leader', description: 'Decomposes work into batches and coordinates developers', isOptional: false, outputs: ['tasks.md'] },
      { id: 'review-lead', name: 'Review Lead', description: 'Code style, logic, and security review', isOptional: false, outputs: ['review-code-style.md', 'review-code-logic.md', 'review-security.md'] },
      { id: 'test-lead', name: 'Test Lead', description: 'Validates build, tests, and acceptance criteria', isOptional: false, outputs: ['test-results'] },
      { id: 'fix-worker', name: 'Fix Worker', description: 'Addresses review findings and test failures', isOptional: true, outputs: ['fix-artifacts'] },
      { id: 'completion', name: 'Completion Worker', description: 'Final verification, status update, and commits', isOptional: true, outputs: ['completion-report.md'] },
    ],
  },
  {
    id: 'bugfix',
    name: 'Bug Fix',
    description: 'Targeted bug fix workflow with research-first approach',
    taskTypes: ['BUGFIX'],
    hasParallelReview: true,
    strategy: '[Research] -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker | Completion Worker]',
    phases: [
      { id: 'research', name: 'Research', description: 'Investigates root cause and affected code paths', isOptional: true, outputs: ['root-cause-analysis'] },
      { id: 'team-leader', name: 'Team-Leader', description: 'Plans fix approach and assigns to developer', isOptional: false, outputs: ['tasks.md'] },
      { id: 'review-lead', name: 'Review Lead', description: 'Code style, logic, and security review', isOptional: false, outputs: ['review-code-style.md', 'review-code-logic.md', 'review-security.md'] },
      { id: 'test-lead', name: 'Test Lead', description: 'Validates fix resolves the bug without regression', isOptional: false, outputs: ['test-results'] },
      { id: 'fix-worker', name: 'Fix Worker', description: 'Addresses review findings', isOptional: true, outputs: ['fix-artifacts'] },
      { id: 'completion', name: 'Completion Worker', description: 'Final verification and commits', isOptional: true, outputs: ['completion-report.md'] },
    ],
  },
  {
    id: 'refactoring',
    name: 'Code Refactoring',
    description: 'Structured refactoring with architecture review and parallel QA',
    taskTypes: ['REFACTORING'],
    hasParallelReview: true,
    strategy: 'Architect -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker | Completion Worker]',
    phases: [
      { id: 'architect', name: 'Architect', description: 'Analyzes current structure and plans refactoring approach', isOptional: false, outputs: ['plan.md'] },
      { id: 'team-leader', name: 'Team-Leader', description: 'Decomposes refactoring into safe incremental steps', isOptional: false, outputs: ['tasks.md'] },
      { id: 'review-lead', name: 'Review Lead', description: 'Reviews refactoring for correctness and consistency', isOptional: false, outputs: ['review-code-style.md', 'review-code-logic.md', 'review-security.md'] },
      { id: 'test-lead', name: 'Test Lead', description: 'Ensures no regressions from refactoring', isOptional: false, outputs: ['test-results'] },
      { id: 'fix-worker', name: 'Fix Worker', description: 'Addresses review findings', isOptional: true, outputs: ['fix-artifacts'] },
      { id: 'completion', name: 'Completion Worker', description: 'Final verification and commits', isOptional: true, outputs: ['completion-report.md'] },
    ],
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Streamlined documentation workflow with style review',
    taskTypes: ['DOCUMENTATION'],
    hasParallelReview: false,
    strategy: 'PM -> Developer -> Style Reviewer',
    phases: [
      { id: 'pm', name: 'PM', description: 'Defines documentation scope and audience', isOptional: false, outputs: ['task-description.md'] },
      { id: 'developer', name: 'Developer', description: 'Writes documentation content', isOptional: false, outputs: ['documentation-files'] },
      { id: 'style-reviewer', name: 'Style Reviewer', description: 'Reviews for clarity, accuracy, and formatting', isOptional: false, outputs: ['review-style.md'] },
    ],
  },
  {
    id: 'research',
    name: 'Research & Investigation',
    description: 'Research workflow that may lead to a follow-up feature task',
    taskTypes: ['RESEARCH'],
    hasParallelReview: false,
    strategy: 'PM -> Researcher -> [Architect] -> PM (close) -> [conditional FEATURE]',
    phases: [
      { id: 'pm', name: 'PM', description: 'Defines research questions and scope', isOptional: false, outputs: ['task-description.md'] },
      { id: 'researcher', name: 'Researcher', description: 'Conducts research and analysis', isOptional: false, outputs: ['research-findings.md'] },
      { id: 'architect', name: 'Architect', description: 'Evaluates technical feasibility if applicable', isOptional: true, outputs: ['technical-assessment.md'] },
      { id: 'pm-close', name: 'PM (close)', description: 'Summarizes findings and recommendations', isOptional: false, outputs: ['completion-report.md'] },
      { id: 'conditional-feature', name: 'FEATURE', description: 'Spawns a follow-up FEATURE task if research recommends implementation', isOptional: true, outputs: ['new-task'] },
    ],
  },
  {
    id: 'devops',
    name: 'DevOps / Infrastructure',
    description: 'Infrastructure workflow with architecture review and QA',
    taskTypes: ['DEVOPS'],
    hasParallelReview: false,
    strategy: 'PM -> Architect -> DevOps Engineer -> QA',
    phases: [
      { id: 'pm', name: 'PM', description: 'Defines infrastructure requirements', isOptional: false, outputs: ['task-description.md'] },
      { id: 'architect', name: 'Architect', description: 'Designs infrastructure approach and architecture', isOptional: false, outputs: ['plan.md'] },
      { id: 'devops', name: 'DevOps Engineer', description: 'Implements infrastructure changes', isOptional: false, outputs: ['infrastructure-configs'] },
      { id: 'qa', name: 'QA', description: 'Validates deployment and infrastructure health', isOptional: false, outputs: ['validation-results'] },
    ],
  },
  {
    id: 'ops',
    name: 'Operations',
    description: 'Operational setup workflow without architecture review',
    taskTypes: ['OPS'],
    hasParallelReview: false,
    strategy: 'PM -> DevOps Engineer -> QA',
    phases: [
      { id: 'pm', name: 'PM', description: 'Defines operational setup requirements', isOptional: false, outputs: ['task-description.md'] },
      { id: 'devops', name: 'DevOps Engineer', description: 'Executes operational setup tasks', isOptional: false, outputs: ['setup-configs'] },
      { id: 'qa', name: 'QA', description: 'Validates setup correctness', isOptional: false, outputs: ['validation-results'] },
    ],
  },
  {
    id: 'creative',
    name: 'Creative / Marketing',
    description: 'Creative content workflow with design-first approach',
    taskTypes: ['CREATIVE'],
    hasParallelReview: false,
    strategy: '[UI/UX Designer] -> Technical Content Writer -> Frontend Developer',
    phases: [
      { id: 'designer', name: 'UI/UX Designer', description: 'Creates visual design and layout', isOptional: true, outputs: ['design-specs.md'] },
      { id: 'content-writer', name: 'Content Writer', description: 'Writes marketing copy and content', isOptional: false, outputs: ['content-files'] },
      { id: 'frontend-dev', name: 'Frontend Developer', description: 'Implements the creative design in code', isOptional: false, outputs: ['frontend-code'] },
    ],
  },
  {
    id: 'content',
    name: 'Content Creation',
    description: 'Technical content writing workflow with research and style review',
    taskTypes: ['CONTENT'],
    hasParallelReview: false,
    strategy: 'PM -> [Researcher] -> Content Writer -> Style Reviewer',
    phases: [
      { id: 'pm', name: 'PM', description: 'Defines content requirements and audience', isOptional: false, outputs: ['task-description.md'] },
      { id: 'researcher', name: 'Researcher', description: 'Gathers data and supporting information', isOptional: true, outputs: ['research-data.md'] },
      { id: 'content-writer', name: 'Content Writer', description: 'Writes and structures the content', isOptional: false, outputs: ['content-files'] },
      { id: 'style-reviewer', name: 'Style Reviewer', description: 'Reviews for tone, clarity, and brand consistency', isOptional: false, outputs: ['review-style.md'] },
    ],
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Social media content creation with design and review',
    taskTypes: ['SOCIAL'],
    hasParallelReview: false,
    strategy: 'PM -> Content Writer -> [UI/UX Designer] -> Style Reviewer',
    phases: [
      { id: 'pm', name: 'PM', description: 'Defines social media campaign requirements', isOptional: false, outputs: ['task-description.md'] },
      { id: 'content-writer', name: 'Content Writer', description: 'Writes social media copy', isOptional: false, outputs: ['social-copy'] },
      { id: 'designer', name: 'UI/UX Designer', description: 'Creates visual assets for social posts', isOptional: true, outputs: ['visual-assets'] },
      { id: 'style-reviewer', name: 'Style Reviewer', description: 'Reviews for brand consistency and quality', isOptional: false, outputs: ['review-style.md'] },
    ],
  },
  {
    id: 'design',
    name: 'UI/UX Design',
    description: 'Design workflow from brief to reviewed design artifacts',
    taskTypes: ['DESIGN'],
    hasParallelReview: false,
    strategy: 'PM -> UI/UX Designer -> Style Reviewer',
    phases: [
      { id: 'pm', name: 'PM', description: 'Creates design brief with requirements', isOptional: false, outputs: ['task-description.md'] },
      { id: 'designer', name: 'UI/UX Designer', description: 'Produces design artifacts (wireframes, prototypes, specs)', isOptional: false, outputs: ['design-artifacts'] },
      { id: 'style-reviewer', name: 'Style Reviewer', description: 'Reviews design for consistency and usability', isOptional: false, outputs: ['review-style.md'] },
    ],
  },
];

@Injectable()
export class OrchestrationFlowsService {
  private readonly flowMap = new Map(ORCHESTRATION_FLOWS.map(f => [f.id, f]));

  public getAllFlows(): readonly OrchestrationFlow[] {
    return ORCHESTRATION_FLOWS;
  }

  public getFlowById(id: string): OrchestrationFlow | null {
    return this.flowMap.get(id) ?? null;
  }

  public getFlowsByTaskType(taskType: string): readonly OrchestrationFlow[] {
    return ORCHESTRATION_FLOWS.filter(f => f.taskTypes.includes(taskType));
  }

  public cloneFlow(sourceId: string, customName: string): OrchestrationFlow | null {
    const source = this.flowMap.get(sourceId);
    if (!source) return null;
    return {
      ...source,
      id: `custom-${sourceId}-${Date.now()}`,
      name: customName,
      description: `Custom clone of ${source.name}`,
    };
  }
}
