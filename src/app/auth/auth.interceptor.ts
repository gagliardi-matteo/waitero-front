import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './AuthService';

const PUBLIC_API_PATTERNS = [
  '/api/auth/',
  '/api/customer/',
  '/api/table/access',
  '/api/image/'
];

function isPublicApiRequest(url: string): boolean {
  return PUBLIC_API_PATTERNS.some(pattern => url.includes(pattern));
}

function isCustomerRoute(platformId: object): boolean {
  if (!isPlatformBrowser(platformId)) {
    return false;
  }
  const path = window.location.pathname.toLowerCase();
  return path === '/menu' || path.startsWith('/menu/');
}

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  const requiresRestaurantAuth = !isPublicApiRequest(req.url);
  const onCustomerRoute = isCustomerRoute(platformId);

  if (!requiresRestaurantAuth) {
    return next(req);
  }

  return from(auth.ensureValidAccessToken()).pipe(
    switchMap(token => {
      const authorizedReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

      return next(authorizedReq).pipe(
        catchError((err: HttpErrorResponse) => {
          if (!onCustomerRoute && (err.status === 401 || err.status === 403)) {
            auth.logout();
            void router.navigate(['/login']);
          }
          return throwError(() => err);
        })
      );
    })
  );
};
