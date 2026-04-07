import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './AuthService';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureValidAccessToken().then(token => {
    if (!token) {
      if (!(state.url === '/menu' || state.url.startsWith('/menu/'))) {
        void router.navigate(['/login']);
      }
      return false;
    }

    return true;
  });
};
