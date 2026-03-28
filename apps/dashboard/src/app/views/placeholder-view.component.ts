import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-placeholder-view',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="placeholder">
      <h2>{{ title$ | async }}</h2>
      <p>This view is under construction.</p>
    </div>
  `,
  styles: [`
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      color: var(--text-secondary);
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    p { font-size: 14px; }
  `],
})
export class PlaceholderViewComponent {
  private readonly route = inject(ActivatedRoute);
  public readonly title$ = this.route.data.pipe(
    map((data) => (data['title'] as string) ?? 'Coming Soon'),
  );
}
