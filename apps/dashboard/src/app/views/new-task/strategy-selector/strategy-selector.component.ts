import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StrategyCard, StrategyType } from '../../../models/new-task.model';

@Component({
  selector: 'app-strategy-selector',
  standalone: true,
  templateUrl: './strategy-selector.component.html',
  styleUrl: './strategy-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategySelectorComponent {
  public readonly strategies = input.required<readonly StrategyCard[]>();
  public readonly selected = input.required<StrategyType>();
  public readonly autoDetectLabel = input<string | null>(null);
  public readonly selectionChange = output<StrategyType>();

  public select(type: StrategyType): void {
    this.selectionChange.emit(type);
  }
}
