import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { QuickPreset } from '../../../models/model-assignment.model';

@Component({
  selector: 'app-preset-cards',
  standalone: true,
  imports: [NgClass],
  templateUrl: './preset-cards.component.html',
  styleUrl: './preset-cards.component.scss',
})
export class PresetCardsComponent {
  public readonly presets = input.required<readonly QuickPreset[]>();

  public readonly presetSelected = output<string>();

  public onPresetClick(presetName: string): void {
    this.presetSelected.emit(presetName);
  }
}
