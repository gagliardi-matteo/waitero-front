import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

const PUBLIC_API_PATTERNS = [
  '/api/auth/',
  '/api/customer/',
  '/api/table/access',
  '/api/image/'
];

function isPublicApiRequest(url: string): boolean {
  return PUBLIC_API_PATTERNS.some(pattern => url.includes(pattern));
}

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  let token: string | null = null;

  if (isPlatformBrowser(platformId)) {
    token = localStorage.getItem('accessToken');
  }

  const requiresRestaurantAuth = !isPublicApiRequest(req.url);

  const cloned = token && requiresRestaurantAuth
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned).pipe(
    catchError(err => {
      if (requiresRestaurantAuth && (err.status === 401 || err.status === 403)) {
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
