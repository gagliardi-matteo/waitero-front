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

export interface BackofficeProfile {
  userId: number;
  email: string;
  nome: string;
  role: TokenPayload['role'];
  restaurantId: number | null;
  hasPassword: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private readonly ACCESS_KEY = 'accessToken';
  private readonly REFRESH_KEY = 'refreshToken';
  private readonly IMPERSONATION_NAME_KEY = 'impersonatedRestaurantName';
  private refreshPromise: Promise<string | null> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly authenticated = signal(false);

  constructor() {
    this.bootstrapSession();
  }

  async loginWithGoogleIdToken(idToken: string): Promise<void> {
    const tokens = await firstValueFrom(this.http.post<AuthTokens>(`${environment.apiUrl}/auth/login`, { idToken }));
    this.storeTokens(tokens);
    await this.navigateAfterLogin(tokens.accessToken);
  }

  async loginWithLocalCredentials(email: string, password: string): Promise<void> {
    const tokens = await firstValueFrom(this.http.post<AuthTokens>(`${environment.apiUrl}/auth/local-login`, { email, password }));
    this.storeTokens(tokens);
    await this.navigateAfterLogin(tokens.accessToken);
  }

  getProfile() {
    return this.http.get<BackofficeProfile>(`${environment.apiUrl}/auth/profile`);
  }

  updateProfile(nome: string) {
    return this.http.put<BackofficeProfile>(`${environment.apiUrl}/auth/profile`, { nome });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<BackofficeProfile>(`${environment.apiUrl}/auth/password`, { currentPassword, newPassword });
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

  isMaster(): boolean {
    return this.getRole() === 'MASTER';
  }

  isImpersonating(): boolean {
    return this.getActingRestaurantId() !== null;
  }

  getRole(): TokenPayload['role'] | null {
    return this.getDecodedAccessToken()?.role ?? null;
  }

  getOwnedRestaurantId(): number | null {
    return this.getDecodedAccessToken()?.restaurantId ?? null;
  }

  getActingRestaurantId(): number | null {
    return this.getDecodedAccessToken()?.actingRestaurantId ?? null;
  }

  getImpersonatedRestaurantName(): string | null {
    return this.isBrowser() ? localStorage.getItem(this.IMPERSONATION_NAME_KEY) : null;
  }

  beginImpersonation(accessToken: string, restaurantName: string): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(this.ACCESS_KEY, accessToken);
    localStorage.setItem(this.IMPERSONATION_NAME_KEY, restaurantName);
    this.authenticated.set(true);
    this.scheduleRefresh(accessToken);
  }

  async stopImpersonation(): Promise<void> {
    if (!this.isImpersonating()) {
      return;
    }

    if (this.isBrowser()) {
      localStorage.removeItem(this.IMPERSONATION_NAME_KEY);
    }

    const token = await this.refreshAccessToken();
    if (!token) {
      this.clearSession(true);
    }
  }

  logout(): void {
    this.clearSession(true);
  }

  getUserIdFromToken(): number | null {
    return this.getDecodedAccessToken()?.sub ?? null;
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
        this.syncImpersonationState(accessToken);
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
    this.syncImpersonationState(tokens.accessToken);
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
      localStorage.removeItem(this.IMPERSONATION_NAME_KEY);
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
    const decoded = this.decodeToken(token);
    return decoded?.exp ? decoded.exp * 1000 : null;
  }

  private getDecodedAccessToken(): TokenPayload | null {
    return this.decodeToken(this.getStoredAccessToken());
  }

  private decodeToken(token: string | null): TokenPayload | null {
    if (!token) {
      return null;
    }

    try {
      return jwtDecode<TokenPayload>(token);
    } catch (err) {
      console.error('Errore nel decoding del token', err);
      return null;
    }
  }

  private syncImpersonationState(accessToken: string): void {
    if (!this.isBrowser()) {
      return;
    }

    const decoded = this.decodeToken(accessToken);
    if (!decoded?.actingRestaurantId) {
      localStorage.removeItem(this.IMPERSONATION_NAME_KEY);
    }
  }

  private navigateAfterLogin(accessToken: string): Promise<boolean> {
    const decoded = this.decodeToken(accessToken);
    const target = decoded?.role === 'MASTER' ? '/admin/restaurants' : '/menu-management';
    return this.router.navigate([target]);
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}



