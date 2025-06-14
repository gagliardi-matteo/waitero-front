import { inject, Injectable } from '@angular/core';
import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authService = inject(SocialAuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  accessToken: string | null = null;
  refreshToken: string | null = null;
  private readonly TOKEN_KEY = 'accessToken';

  loginWithGoogle() {
    this.authService.signIn(GoogleLoginProvider.PROVIDER_ID).then(user => {
      const idToken = user.idToken;
      this.http.post<{ accessToken: string; refreshToken: string }>(
        'http://localhost:8080/api/auth/login',
        { idToken }
      ).subscribe(res => {
        this.accessToken = res.accessToken;
        this.refreshToken = res.refreshToken;
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);
        this.router.navigate(['/menu']);
      });
    });
  }

  getToken() {
    return this.accessToken || localStorage.getItem('accessToken');
  }

  logout() {
    this.authService.signOut();
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;

    return this.http.post<{ accessToken: string; refreshToken: string }>(
      'http://localhost:8080/api/auth/refresh-token',
      { refreshToken }
    ).subscribe(res => {
      this.accessToken = res.accessToken;
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
    });
  }

  loginWithGoogleIdToken(idToken: string) {
    this.http.post<{ accessToken: string; refreshToken: string }>(
        'http://localhost:8080/api/auth/login',
        { idToken }
    ).subscribe(res => {
        this.accessToken = res.accessToken;
        this.refreshToken = res.refreshToken;
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);
        this.router.navigate(['/menu']);
    });
    }

    isAuthenticated(): boolean {
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (!token) return false;

      // Decodifica del payload per verificarne la scadenza (se usi JWT standard)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        return payload.exp && payload.exp > now;
      } catch (e) {
        return false;
      }
    }

}
