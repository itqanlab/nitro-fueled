import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  template: `
    <div class="dashboard-root">
      <h1>Nitro-Fueled Dashboard</h1>
      <p>Orchestration control panel loading...</p>
    </div>
  `,
  styles: [`
    .dashboard-root {
      min-height: 100vh;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      padding: 2rem;
    }
  `],
})
export class AppComponent {
  public readonly title = 'dashboard';
}
