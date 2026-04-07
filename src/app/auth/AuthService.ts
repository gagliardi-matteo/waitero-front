import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { TokenPayload } from '../models/TokenPayload.model';
import { environment } from '../../environments/environment';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private readonly ACCESS_KEY = 'accessToken';
  private readonly REFRESH_KEY = 'refreshToken';
  private refreshPromise: Promise<string | null> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly authenticated = signal(false);

  constructor() {
    this.bootstrapSession();
  }

  loginWithGoogleIdToken(idToken: string): Promise<void> {
    return firstValueFrom(this.http.post<AuthTokens>(`${environment.apiUrl}/auth/login`, { idToken }))
      .then(tokens => {
        this.storeTokens(tokens);
        void this.router.navigate(['/menu-management']);
      });
  }

  async ensureValidAccessToken(): Promise<string | null> {
    const accessToken = this.getStoredAccessToken();
    if (this.isTokenUsable(accessToken)) {
      return accessToken;
    }

    const refreshToken = this.getStoredRefreshToken();
    if (!this.isTokenUsable(refreshToken)) {
      this.clearSession(false);
      return null;
    }

    return this.refreshAccessToken();
  }

  getToken(): string | null {
    return this.getStoredAccessToken();
  }

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  logout(): void {
    this.clearSession(true);
  }

  getUserIdFromToken(): number | null {
    const token = this.getStoredAccessToken();
    if (!token) {
      return null;
    }

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      return decoded.sub ?? null;
    } catch (err) {
      console.error('Errore nel decoding del token', err);
      return null;
    }
  }

  private bootstrapSession(): void {
    if (!this.isBrowser()) {
      this.authenticated.set(false);
      return;
    }

    const accessToken = this.getStoredAccessToken();
    const refreshToken = this.getStoredRefreshToken();

    if (this.isTokenUsable(accessToken)) {
      this.authenticated.set(true);
      if (accessToken) {
        this.scheduleRefresh(accessToken);
      }
      return;
    }

    if (this.isTokenUsable(refreshToken)) {
      void this.refreshAccessToken();
      return;
    }

    this.clearSession(false);
  }

  private refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getStoredRefreshToken();
    if (!this.isTokenUsable(refreshToken)) {
      this.clearSession(false);
      return Promise.resolve(null);
    }

    this.refreshPromise = firstValueFrom(
      this.http.post<AuthTokens>(`${environment.apiUrl}/auth/refresh-token`, { refreshToken })
    ).then(tokens => {
      this.storeTokens(tokens);
      return tokens.accessToken;
    }).catch(err => {
      console.error('Errore refresh access token', err);
      this.clearSession(false);
      return null;
    }).finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private storeTokens(tokens: AuthTokens): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(this.ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(this.REFRESH_KEY, tokens.refreshToken);
    this.authenticated.set(true);
    this.scheduleRefresh(tokens.accessToken);
  }

  private clearSession(navigateToLogin: boolean): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.isBrowser()) {
      localStorage.removeItem(this.ACCESS_KEY);
      localStorage.removeItem(this.REFRESH_KEY);
    }

    this.authenticated.set(false);

    if (navigateToLogin && this.isBrowser()) {
      void this.router.navigate(['/login']);
    }
  }

  private scheduleRefresh(accessToken: string): void {
    if (!this.isBrowser()) {
      return;
    }

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const expiresAtMs = this.getTokenExpirationMs(accessToken);
    if (!expiresAtMs) {
      return;
    }

    const refreshAtMs = expiresAtMs - 60_000;
    const delay = refreshAtMs - Date.now();
    if (delay <= 0) {
      void this.refreshAccessToken();
      return;
    }

    this.refreshTimer = setTimeout(() => {
      void this.refreshAccessToken();
    }, delay);
  }

  private getStoredAccessToken(): string | null {
    return this.isBrowser() ? localStorage.getItem(this.ACCESS_KEY) : null;
  }

  private getStoredRefreshToken(): string | null {
    return this.isBrowser() ? localStorage.getItem(this.REFRESH_KEY) : null;
  }

  private isTokenUsable(token: string | null): boolean {
    const expiresAtMs = this.getTokenExpirationMs(token);
    return expiresAtMs !== null && expiresAtMs > Date.now() + 10_000;
  }

  private getTokenExpirationMs(token: string | null): number | null {
    if (!token) {
      return null;
    }

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      return decoded.exp ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
