import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WorkflowStep } from '../../../models/new-task.model';

@Component({
  selector: 'app-workflow-preview',
  standalone: true,
  templateUrl: './workflow-preview.component.html',
  styleUrl: './workflow-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowPreviewComponent {
  public readonly steps = input.required<readonly WorkflowStep[]>();
  public readonly hintText = input('Dashed borders = user checkpoints (you\'ll review and approve before continuing)');
}
