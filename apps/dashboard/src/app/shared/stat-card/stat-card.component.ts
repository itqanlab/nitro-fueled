import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="stat-card">
      <div class="stat-card-label">{{ label }}</div>
      <div class="stat-card-value" [ngClass]="valueClass">
        <ng-content></ng-content>
      </div>
      <ng-content select="[slot=extra]"></ng-content>
      @if (sub) {
        <div class="stat-card-sub">{{ sub }}</div>
      }
    </div>
  `,
  styles: [`
    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;
    }
    .stat-card-label {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .stat-card-value {
      font-size: 28px;
      font-weight: 600;
    }
    .stat-card-value.running { color: var(--running); }
    .stat-card-value.completed { color: var(--completed); }
    .stat-card-value.cost { color: var(--warning); }
    .stat-card-sub {
      font-size: 12px;
      color: var(--text-tertiary);
      margin-top: 4px;
    }
  `],
})
export class StatCardComponent {
  @Input({ required: true }) label!: string;
  @Input() valueClass = '';
  @Input() sub = '';
}
