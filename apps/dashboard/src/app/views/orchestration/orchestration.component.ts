import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import type { OrchestrationFlow, OrchestrationFlowPhase } from '../../models/api.types';

@Component({
  selector: 'app-orchestration',
  standalone: true,
  imports: [NgClass],
  templateUrl: './orchestration.component.html',
  styleUrl: './orchestration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrchestrationComponent {
  private readonly api = inject(ApiService);

  public readonly flows = toSignal(
    this.api.getOrchestrationFlows().pipe(catchError(() => of([] as OrchestrationFlow[]))),
    { initialValue: [] as OrchestrationFlow[] },
  );

  public readonly selectedFlowId = signal<string | null>(null);
  public readonly selectedPhaseId = signal<string | null>(null);
  public readonly cloneFlowId = signal<string | null>(null);
  public readonly cloneFlowName = signal('');
  public readonly cloneStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  public readonly taskTypeFilter = signal<string>('ALL');

  public readonly selectedFlow = computed<OrchestrationFlow | null>(() => {
    const id = this.selectedFlowId();
    const list = this.flows() ?? [];
    if (!id) return list[0] ?? null;
    return list.find(f => f.id === id) ?? list[0] ?? null;
  });

  public readonly selectedPhase = computed<OrchestrationFlowPhase | null>(() => {
    const flow = this.selectedFlow();
    const phaseId = this.selectedPhaseId();
    if (!flow || !phaseId) return null;
    return flow.phases.find(p => p.id === phaseId) ?? null;
  });

  public readonly allTaskTypes = computed(() => {
    const types = new Set<string>();
    for (const flow of (this.flows() ?? [])) {
      for (const tt of flow.taskTypes) {
        types.add(tt);
      }
    }
    return ['ALL', ...Array.from(types).sort()];
  });

  public readonly filteredFlows = computed(() => {
    const filter = this.taskTypeFilter();
    const all = this.flows() ?? [];
    if (filter === 'ALL') return all;
    return all.filter(f => f.taskTypes.includes(filter));
  });

  public readonly svgWidth = computed(() => {
    const flow = this.selectedFlow();
    if (!flow) return 600;
    const phaseCount = flow.phases.length;
    return Math.max(600, phaseCount * 150 + 100);
  });

  public selectFlow(flowId: string): void {
    this.selectedFlowId.set(flowId);
    this.selectedPhaseId.set(null);
  }

  public selectPhase(phaseId: string): void {
    const current = this.selectedPhaseId();
    this.selectedPhaseId.set(current === phaseId ? null : phaseId);
  }

  public setTaskTypeFilter(type: string): void {
    this.taskTypeFilter.set(type);
    this.selectedFlowId.set(null);
    this.selectedPhaseId.set(null);
  }

  public startClone(flowId: string): void {
    const flow = this.flows().find(f => f.id === flowId);
    this.cloneFlowId.set(flowId);
    this.cloneFlowName.set(flow ? `Custom ${flow.name}` : '');
    this.cloneStatus.set('idle');
  }

  public cancelClone(): void {
    this.cloneFlowId.set(null);
    this.cloneFlowName.set('');
    this.cloneStatus.set('idle');
  }

  public executeClone(): void {
    const sourceId = this.cloneFlowId();
    const name = this.cloneFlowName();
    if (!sourceId || !name.trim()) return;

    this.cloneStatus.set('loading');
    this.api.cloneOrchestrationFlow(sourceId, name.trim()).subscribe({
      next: () => {
        this.cloneStatus.set('success');
        setTimeout(() => this.cancelClone(), 2000);
      },
      error: () => {
        this.cloneStatus.set('error');
      },
    });
  }

  public getPhaseX(index: number): number {
    return 80 + index * 150;
  }

  public getPhaseColor(phase: OrchestrationFlowPhase): string {
    const name = phase.name.toLowerCase();
    if (name.includes('pm')) return '#3b82f6';
    if (name.includes('architect')) return '#8b5cf6';
    if (name.includes('team-leader') || name.includes('developer') || name.includes('devops'))
      return '#10b981';
    if (name.includes('review') || name.includes('style')) return '#f59e0b';
    if (name.includes('test') || name.includes('qa')) return '#ef4444';
    if (name.includes('design')) return '#ec4899';
    if (name.includes('content') || name.includes('writer')) return '#14b8a6';
    if (name.includes('research')) return '#6366f1';
    if (name.includes('fix') || name.includes('completion')) return '#84cc16';
    return '#6b7280';
  }

  public trackByFlowId(_index: number, flow: OrchestrationFlow): string {
    return flow.id;
  }
}
