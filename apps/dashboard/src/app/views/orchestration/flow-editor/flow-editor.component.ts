import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import type { CustomFlow, CustomFlowPhase } from '../../../models/api.types';

@Component({
  selector: 'app-flow-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './flow-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowEditorComponent implements OnInit {
  private readonly api = inject(ApiService);

  /** null = new flow mode; non-null = editing existing flow */
  public readonly flow = input<CustomFlow | null>(null);

  @Output() public readonly saved = new EventEmitter<CustomFlow>();
  @Output() public readonly cancelled = new EventEmitter<void>();

  public readonly editedName = signal('');
  public readonly editedDescription = signal('');
  public readonly editedPhases = signal<CustomFlowPhase[]>([]);
  public readonly isSaving = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly newPhaseAgentName = signal('');

  public readonly canSave = computed(
    () => this.editedName().trim().length > 0 && !this.isSaving(),
  );

  public ngOnInit(): void {
    const existing = this.flow();
    if (existing) {
      this.editedName.set(existing.name);
      this.editedDescription.set(existing.description ?? '');
      this.editedPhases.set([...existing.phases] as CustomFlowPhase[]);
    }
  }

  public movePhaseUp(index: number): void {
    if (index === 0) return;
    const phases = [...this.editedPhases()];
    [phases[index - 1], phases[index]] = [phases[index], phases[index - 1]];
    this.editedPhases.set(this.reorder(phases));
  }

  public movePhaseDown(index: number): void {
    const phases = [...this.editedPhases()];
    if (index >= phases.length - 1) return;
    [phases[index], phases[index + 1]] = [phases[index + 1], phases[index]];
    this.editedPhases.set(this.reorder(phases));
  }

  public removePhase(index: number): void {
    const phases = [...this.editedPhases()];
    phases.splice(index, 1);
    this.editedPhases.set(this.reorder(phases));
  }

  public addPhase(): void {
    const agentName = this.newPhaseAgentName().trim();
    if (!agentName) return;
    const phases = [...this.editedPhases()];
    phases.push({
      order: phases.length + 1,
      agentName,
      agentTitle: agentName,
      optional: false,
      estimatedDuration: 1,
      deliverables: [],
    });
    this.editedPhases.set(phases);
    this.newPhaseAgentName.set('');
  }

  public updatePhaseAgentName(index: number, value: string): void {
    const phases = [...this.editedPhases()];
    phases[index] = { ...phases[index], agentName: value, agentTitle: value };
    this.editedPhases.set(phases);
  }

  public togglePhaseOptional(index: number): void {
    const phases = [...this.editedPhases()];
    phases[index] = { ...phases[index], optional: !phases[index].optional };
    this.editedPhases.set(phases);
  }

  public save(): void {
    if (!this.canSave()) return;
    this.isSaving.set(true);
    this.errorMessage.set(null);

    const dto = {
      name: this.editedName().trim(),
      description: this.editedDescription().trim() || undefined,
      phases: this.editedPhases() as CustomFlowPhase[],
    };

    const existing = this.flow();
    const request$ = existing
      ? this.api.updateCustomFlow(existing.id, dto)
      : this.api.createCustomFlow(dto);

    request$.subscribe({
      next: (result) => {
        this.isSaving.set(false);
        this.saved.emit(result);
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.errorMessage.set(
          err instanceof Error ? err.message : 'Failed to save. Please try again.',
        );
      },
    });
  }

  public cancel(): void {
    this.cancelled.emit();
  }

  private reorder(phases: CustomFlowPhase[]): CustomFlowPhase[] {
    return phases.map((p, i) => ({ ...p, order: i + 1 }));
  }
}
