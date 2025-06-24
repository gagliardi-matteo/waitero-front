import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { jwtDecode } from 'jwt-decode';
import { TokenPayload } from '../models/TokenPayload.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authService = inject(SocialAuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  accessToken: string | null = null;
  refreshToken: string | null = null;

  private readonly ACCESS_KEY = 'accessToken';
  private readonly REFRESH_KEY = 'refreshToken';

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  loginWithGoogle() {
    this.authService.signIn(GoogleLoginProvider.PROVIDER_ID).then(user => {
      const idToken = user.idToken;
      this.http.post<{ accessToken: string; refreshToken: string }>(
        `${environment.apiUrl}/auth/login`,
        { idToken }
      ).subscribe(res => {
        this.accessToken = res.accessToken;
        this.refreshToken = res.refreshToken;

        if (this.isBrowser()) {
          localStorage.setItem(this.ACCESS_KEY, res.accessToken);
          localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
        }

        this.router.navigate(['/menu']);
      });
    });
  }

  getToken() {
    return this.accessToken || (this.isBrowser() ? localStorage.getItem(this.ACCESS_KEY) : null);
  }

  logout() {
    this.authService.signOut();
    if (this.isBrowser()) {
      localStorage.clear();
    }
    this.router.navigate(['/login']);
  }

  refreshAccessToken() {
    if (!this.isBrowser()) return;

    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    if (!refreshToken) return;

    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${environment.apiUrl}/auth/refresh-token`,
      { refreshToken }
    ).subscribe(res => {
      this.accessToken = res.accessToken;
      localStorage.setItem(this.ACCESS_KEY, res.accessToken);
      localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
    });
  }

  loginWithGoogleIdToken(idToken: string) {
    this.http.post<{ accessToken: string; refreshToken: string }>(
      `${environment.apiUrl}/auth/login`,
      { idToken }
    ).subscribe(res => {
      this.accessToken = res.accessToken;
      this.refreshToken = res.refreshToken;

      if (this.isBrowser()) {
        localStorage.setItem(this.ACCESS_KEY, res.accessToken);
        localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
      }

      this.router.navigate(['/menu-management']);
    });
  }

  isAuthenticated(): boolean {
    if (!this.isBrowser()) return false;

    const token = localStorage.getItem(this.ACCESS_KEY);
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp > now;
    } catch {
      return false;
    }
  }

  getUserIdFromToken(): number | null {
    if (!this.isBrowser()) return null;

    const token = localStorage.getItem(this.ACCESS_KEY);
    if (!token) return null;

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      return decoded.sub ?? null;
    } catch (err) {
      console.error('Errore nel decoding del token', err);
      return null;
    }
  }
}
