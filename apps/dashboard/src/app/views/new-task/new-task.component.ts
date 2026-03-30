import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import type { CreateTaskOverrides, CreatedTask, TaskCreationComplexity, TaskPriority, TaskType } from '../../models/api.types';
import { TASK_COMPLEXITIES, TASK_PRIORITIES, TASK_TYPES } from '../../services/new-task.constants';

interface AdvancedOverrides {
  type: TaskType | '';
  priority: TaskPriority | '';
  complexity: TaskCreationComplexity | '';
  model: string;
  dependencies: string;
}

@Component({
  selector: 'app-new-task',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './new-task.component.html',
  styleUrl: './new-task.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewTaskComponent {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  public readonly description = signal('');
  public readonly advancedOpen = signal(false);
  public readonly isSubmitting = signal(false);
  public readonly createdTasks = signal<CreatedTask[] | null>(null);
  public readonly autoSplit = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  public readonly overrides: AdvancedOverrides = {
    type: '',
    priority: '',
    complexity: '',
    model: '',
    dependencies: '',
  };

  public readonly canSubmit = computed(() => this.description().trim().length > 0 && !this.isSubmitting());

  public readonly taskTypes = TASK_TYPES;
  public readonly priorities = TASK_PRIORITIES;
  public readonly complexities = TASK_COMPLEXITIES;

  public castToInput(target: EventTarget | null): HTMLTextAreaElement | null {
    return target instanceof HTMLTextAreaElement ? target : null;
  }

  public onDescriptionChange(value: string): void {
    this.description.set(value);
    if (this.errorMessage() !== null) {
      this.errorMessage.set(null);
    }
  }

  public toggleAdvanced(): void {
    this.advancedOpen.set(!this.advancedOpen());
  }

  public onCancel(): void {
    void this.router.navigate(['/dashboard']);
  }

  public onCreateAnother(): void {
    this.description.set('');
    this.createdTasks.set(null);
    this.autoSplit.set(false);
    this.errorMessage.set(null);
    this.overrides.type = '';
    this.overrides.priority = '';
    this.overrides.complexity = '';
    this.overrides.model = '';
    this.overrides.dependencies = '';
  }

  public onSubmit(): void {
    const desc = this.description().trim();
    if (!desc || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.createdTasks.set(null);

    const overrides = this.buildOverrides();

    this.api.createTask({ description: desc, overrides }).subscribe({
      next: (res) => {
        this.createdTasks.set(res.tasks);
        this.autoSplit.set(res.autoSplit ?? false);
        this.isSubmitting.set(false);
      },
      error: (err: unknown) => {
        let message = 'Failed to create task. Please try again.';
        if (err instanceof HttpErrorResponse) {
          message = (err.error as { message?: string })?.message ?? message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        this.errorMessage.set(message);
        this.isSubmitting.set(false);
      },
    });
  }

  private buildOverrides(): CreateTaskOverrides | undefined {
    const o = this.overrides;
    const deps = o.dependencies
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    const hasAny =
      o.type !== '' ||
      o.priority !== '' ||
      o.complexity !== '' ||
      o.model.trim() !== '' ||
      deps.length > 0;

    if (!hasAny) return undefined;

    return {
      ...(o.type !== '' ? { type: o.type as TaskType } : {}),
      ...(o.priority !== '' ? { priority: o.priority as TaskPriority } : {}),
      ...(o.complexity !== '' ? { complexity: o.complexity as TaskCreationComplexity } : {}),
      ...(o.model.trim() !== '' ? { model: o.model.trim() } : {}),
      ...(deps.length > 0 ? { dependencies: deps } : {}),
    };
  }
}
