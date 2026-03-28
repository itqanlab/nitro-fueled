import { Component, input, output } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { AgentAssignment, SubAgentAssignment } from '../../../models/model-assignment.model';

@Component({
  selector: 'app-assignments-table',
  standalone: true,
  imports: [DecimalPipe, NgClass],
  templateUrl: './assignments-table.component.html',
  styleUrl: './assignments-table.component.scss',
})
export class AssignmentsTableComponent {
  public readonly assignments = input.required<readonly AgentAssignment[]>();
  public readonly subAgents = input.required<readonly SubAgentAssignment[]>();
  public readonly totalCost = input.required<number>();
  public readonly budgetUsed = input.required<number>();
  public readonly budgetTotal = input.required<number>();

  public readonly resetRole = output<string>();
  public readonly resetAll = output<void>();
  public readonly save = output<void>();

  public subAgentsExpanded = true;

  public get budgetPercent(): number {
    const total = this.budgetTotal();
    return total > 0 ? (this.budgetUsed() / total) * 100 : 0;
  }

  public get budgetIsWarning(): boolean {
    return this.budgetPercent > 50;
  }

  public toggleSubAgents(): void {
    this.subAgentsExpanded = !this.subAgentsExpanded;
  }

  public getSelectedLabel(assignment: AgentAssignment): string {
    for (const group of assignment.modelOptgroups) {
      const match = group.options.find((o) => o.value === assignment.selectedModel);
      if (match) {
        return match.label;
      }
    }
    return assignment.selectedModel;
  }

  public getProviderBadgeClass(type: string): string {
    if (type === 'CLI') return 'badge-cli';
    if (type === 'OAuth') return 'badge-oauth';
    return 'badge-api';
  }

  public getSubAgentIconClass(color: string): string {
    return `sub-icon-${color}`;
  }
}
