import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './AuthService';

function isCustomerMenuUrl(url: string): boolean {
  return url === '/menu' || url.startsWith('/menu/');
}

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureValidAccessToken().then(token => {
    if (!token) {
      if (!isCustomerMenuUrl(state.url)) {
        void router.navigate(['/login']);
      }
      return false;
    }

    if (state.url.startsWith('/admin')) {
      if (!auth.isMaster()) {
        void router.navigate(['/menu-management']);
        return false;
      }
      return true;
    }

    if (auth.isMaster() && !auth.isImpersonating()) {
      void router.navigate(['/admin/restaurants']);
      return false;
    }

    return true;
  });
};

export const masterGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureValidAccessToken().then(token => {
    if (!token) {
      void router.navigate(['/login']);
      return false;
    }

    if (!auth.isMaster()) {
      void router.navigate(['/menu-management']);
      return false;
    }

    return true;
  });
};
