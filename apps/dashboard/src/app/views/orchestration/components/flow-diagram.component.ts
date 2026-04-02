import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { OrchestrationFlowPhase } from '../../../models/api.types';

@Component({
  selector: 'app-flow-diagram',
  standalone: true,
  imports: [],
  template: '',
  styles: [':host { display: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowDiagramComponent {
  @Input() public flow: OrchestrationFlowPhase[] = [];
}
