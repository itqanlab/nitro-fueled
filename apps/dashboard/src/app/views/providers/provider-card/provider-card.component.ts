import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass, DecimalPipe, UpperCasePipe } from '@angular/common';
import { ProviderConfig } from '../../../models/provider-hub.model';
import { ModelTableComponent } from '../model-table/model-table.component';

@Component({
  selector: 'app-provider-card',
  standalone: true,
  imports: [NgClass, DecimalPipe, UpperCasePipe, ModelTableComponent],
  templateUrl: './provider-card.component.html',
  styleUrl: './provider-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderCardComponent {
  public readonly provider = input.required<ProviderConfig>();
  public readonly expanded = input(false);
  public readonly toggleExpand = output<string>();
  public readonly toggleModel = output<{ providerId: string; modelId: string }>();

  public onHeaderClick(): void {
    this.toggleExpand.emit(this.provider().id);
  }

  public onModelToggle(modelId: string): void {
    this.toggleModel.emit({ providerId: this.provider().id, modelId });
  }
}
