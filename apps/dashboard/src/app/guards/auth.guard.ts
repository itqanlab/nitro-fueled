import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Probe server — if auth is disabled (local dev), skip login
  return auth.checkAuthRequired().pipe(
    map((authRequired) => authRequired ? router.createUrlTree(['/login']) : true),
  );
};
