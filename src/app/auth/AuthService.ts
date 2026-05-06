import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { firstValueFrom } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { TokenPayload } from '../models/TokenPayload.model';
import { environment } from '../../environments/environment';
import { BusinessType } from '../models/business-type.model';

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
  businessType?: BusinessType | null;
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
  private readonly nativePlatform = Capacitor.isNativePlatform();
  private refreshPromise: Promise<string | null> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionBootstrapPromise: Promise<void>;
  private accessTokenCache: string | null = null;
  private refreshTokenCache: string | null = null;
  private impersonationNameCache: string | null = null;

  readonly authenticated = signal(false);

  constructor() {
    this.sessionBootstrapPromise = this.bootstrapSession();
  }

  async loginWithGoogleIdToken(idToken: string): Promise<void> {
    console.info('[Auth] loginWithGoogleIdToken -> POST', `${environment.apiUrl}/auth/login`, {
      tokenLength: idToken.length
    });
    const tokens = await firstValueFrom(this.http.post<AuthTokens>(`${environment.apiUrl}/auth/login`, { idToken }));
    console.info('[Auth] loginWithGoogleIdToken <- success');
    await this.storeTokens(tokens);
    await this.navigateAfterLogin(tokens.accessToken);
  }

  async loginWithLocalCredentials(email: string, password: string): Promise<void> {
    const tokens = await firstValueFrom(this.http.post<AuthTokens>(`${environment.apiUrl}/auth/local-login`, { email, password }));
    await this.storeTokens(tokens);
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
    await this.sessionBootstrapPromise;

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

  getDefaultAuthenticatedRoute(): string {
    if (this.isMaster() && !this.isImpersonating()) {
      return '/admin/restaurants';
    }

    return '/tables-dashboard';
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
    if (this.isNativeApp()) {
      return this.impersonationNameCache;
    }

    return this.isBrowser() ? localStorage.getItem(this.IMPERSONATION_NAME_KEY) : null;
  }

  beginImpersonation(accessToken: string, restaurantName: string): void {
    this.setStoredAccessToken(accessToken);
    this.setStoredImpersonationName(restaurantName);
    this.authenticated.set(true);
    this.scheduleRefresh(accessToken);
  }

  async stopImpersonation(): Promise<void> {
    if (!this.isImpersonating()) {
      return;
    }

    this.removeStoredImpersonationName();

    const token = await this.refreshAccessToken();
    if (!token) {
      this.clearSession(true);
    }
  }

  logout(): void {
    void this.logoutNativeGoogleSession();
    this.clearSession(true);
  }

  getUserIdFromToken(): number | null {
    return this.getDecodedAccessToken()?.sub ?? null;
  }

  private async bootstrapSession(): Promise<void> {
    if (!this.canUseClientStorage()) {
      this.authenticated.set(false);
      return;
    }

    await this.hydrateNativeSession();

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
    ).then(async tokens => {
      await this.storeTokens(tokens);
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

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    this.setStoredAccessToken(tokens.accessToken);
    this.setStoredRefreshToken(tokens.refreshToken);
    this.syncImpersonationState(tokens.accessToken);
    this.authenticated.set(true);
    this.scheduleRefresh(tokens.accessToken);
  }

  private clearSession(navigateToLogin: boolean): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.removeStoredAccessToken();
    this.removeStoredRefreshToken();
    this.removeStoredImpersonationName();

    this.authenticated.set(false);

    if (navigateToLogin && this.isBrowser()) {
      void this.router.navigate(['/login']);
    }
  }

  private async logoutNativeGoogleSession(): Promise<void> {
    if (!this.isNativeApp()) {
      return;
    }

    try {
      await SocialLogin.logout({ provider: 'google' });
    } catch {
      // Ignore when no native Google session is active.
    }
  }

  private scheduleRefresh(accessToken: string): void {
    if (!this.canUseClientStorage()) {
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
    if (this.isNativeApp()) {
      return this.accessTokenCache;
    }

    return this.isBrowser() ? localStorage.getItem(this.ACCESS_KEY) : null;
  }

  private getStoredRefreshToken(): string | null {
    if (this.isNativeApp()) {
      return this.refreshTokenCache;
    }

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
    const decoded = this.decodeToken(accessToken);
    if (!decoded?.actingRestaurantId) {
      this.removeStoredImpersonationName();
    }
  }

  private async navigateAfterLogin(accessToken: string): Promise<void> {
    const decoded = this.decodeToken(accessToken);
    const target = decoded?.role === 'MASTER' && !decoded?.actingRestaurantId
      ? '/admin/restaurants'
      : '/tables-dashboard';
    const navigated = await this.router.navigate([target]);
    if (!navigated) {
      throw new Error(`Navigation to ${target} failed`);
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private isNativeApp(): boolean {
    return this.isBrowser() && this.nativePlatform;
  }

  private canUseClientStorage(): boolean {
    return this.isBrowser();
  }

  private async hydrateNativeSession(): Promise<void> {
    if (!this.isNativeApp()) {
      return;
    }

    const [accessToken, refreshToken, impersonationName] = await Promise.all([
      Preferences.get({ key: this.ACCESS_KEY }),
      Preferences.get({ key: this.REFRESH_KEY }),
      Preferences.get({ key: this.IMPERSONATION_NAME_KEY })
    ]);

    this.accessTokenCache = accessToken.value;
    this.refreshTokenCache = refreshToken.value;
    this.impersonationNameCache = impersonationName.value;
  }

  private setStoredAccessToken(accessToken: string): void {
    if (this.isNativeApp()) {
      this.accessTokenCache = accessToken;
      void Preferences.set({ key: this.ACCESS_KEY, value: accessToken });
      return;
    }

    if (this.isBrowser()) {
      localStorage.setItem(this.ACCESS_KEY, accessToken);
    }
  }

  private setStoredRefreshToken(refreshToken: string): void {
    if (this.isNativeApp()) {
      this.refreshTokenCache = refreshToken;
      void Preferences.set({ key: this.REFRESH_KEY, value: refreshToken });
      return;
    }

    if (this.isBrowser()) {
      localStorage.setItem(this.REFRESH_KEY, refreshToken);
    }
  }

  private setStoredImpersonationName(restaurantName: string): void {
    if (this.isNativeApp()) {
      this.impersonationNameCache = restaurantName;
      void Preferences.set({ key: this.IMPERSONATION_NAME_KEY, value: restaurantName });
      return;
    }

    if (this.isBrowser()) {
      localStorage.setItem(this.IMPERSONATION_NAME_KEY, restaurantName);
    }
  }

  private removeStoredAccessToken(): void {
    if (this.isNativeApp()) {
      this.accessTokenCache = null;
      void Preferences.remove({ key: this.ACCESS_KEY });
      return;
    }

    if (this.isBrowser()) {
      localStorage.removeItem(this.ACCESS_KEY);
    }
  }

  private removeStoredRefreshToken(): void {
    if (this.isNativeApp()) {
      this.refreshTokenCache = null;
      void Preferences.remove({ key: this.REFRESH_KEY });
      return;
    }

    if (this.isBrowser()) {
      localStorage.removeItem(this.REFRESH_KEY);
    }
  }

  private removeStoredImpersonationName(): void {
    if (this.isNativeApp()) {
      this.impersonationNameCache = null;
      void Preferences.remove({ key: this.IMPERSONATION_NAME_KEY });
      return;
    }

    if (this.isBrowser()) {
      localStorage.removeItem(this.IMPERSONATION_NAME_KEY);
    }
  }
}





