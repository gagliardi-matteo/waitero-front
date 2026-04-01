import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './AuthService';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    if (!(state.url === '/menu' || state.url.startsWith('/menu/'))) {
      router.navigate(['/login']);
    }
    return false;
  }

  return true;
};
