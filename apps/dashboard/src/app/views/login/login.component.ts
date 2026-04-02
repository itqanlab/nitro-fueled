import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzAlertModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public apiKeyInput = '';
  public readonly loading = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  public onConnect(): void {
    if (!this.apiKeyInput.trim()) {
      this.errorMessage.set('Please enter an API key.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.verifyApiKey(this.apiKeyInput).subscribe({
      next: (valid) => {
        this.loading.set(false);
        if (valid) {
          this.authService.setApiKey(this.apiKeyInput);
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(
            'Invalid API key. Please check your configuration.',
          );
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set(
          'Invalid API key. Please check your configuration.',
        );
      },
    });
  }
}
