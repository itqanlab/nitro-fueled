import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { MOCK_MODEL_ASSIGNMENTS_DATA } from '../../services/model-assignment.constants';
import { AssignmentsTableComponent } from './assignments-table/assignments-table.component';
import { PresetCardsComponent } from './preset-cards/preset-cards.component';

@Component({
  selector: 'app-model-assignments',
  standalone: true,
  imports: [NgClass, AssignmentsTableComponent, PresetCardsComponent],
  templateUrl: './model-assignments.component.html',
  styleUrl: './model-assignments.component.scss',
})
export class ModelAssignmentsComponent {
  public readonly data = MOCK_MODEL_ASSIGNMENTS_DATA;
  public activeScope = 'Global Defaults';

  public setActiveScope(label: string): void {
    this.activeScope = label;
  }

  public onResetRole(role: string): void {
    // Mock: would reset specific role to global default
  }

  public onResetAll(): void {
    // Mock: would reset all assignments
  }

  public onSave(): void {
    // Mock: would save assignments to API
  }

  public onPresetSelected(presetName: string): void {
    // Mock: would apply preset to assignments table
  }
}
