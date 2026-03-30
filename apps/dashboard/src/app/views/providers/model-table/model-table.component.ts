import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { ProviderModel } from '../../../models/provider-hub.model';

@Component({
  selector: 'app-model-table',
  standalone: true,
  imports: [NgClass],
  templateUrl: './model-table.component.html',
  styleUrl: './model-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelTableComponent {
  public readonly models = input.required<readonly ProviderModel[]>();
  public readonly cliMode = input(false);
  public readonly toggleModel = output<string>();

  public onToggle(modelId: string): void {
    this.toggleModel.emit(modelId);
  }
}
