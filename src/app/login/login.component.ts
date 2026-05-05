import { AfterViewInit, Component, ElementRef, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { SocialLogin, type GoogleLoginResponseOnline } from '@capgo/capacitor-social-login';
import { AuthService } from '../auth/AuthService';
import { BrandLoaderComponent } from '../shared/brand-loader/brand-loader.component';

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_WEB_CLIENT_ID = '910347869788-astuldpi4hi3hb0osucuoclhfjdh5dtj.apps.googleusercontent.com';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, BrandLoaderComponent],
  template: `
    <div class="login-shell">
      <section class="login-brand-panel">
        <div class="brand-top">
          <div class="brand-mark">W</div>
          <span>WaiterO</span>
        </div>

        <div class="brand-copy">
          <span class="eyebrow inverse">Hospitality Tech</span>
          <h1>Gestisci il locale in un unico pannello.</h1>
          <p>Menu, tavoli, ordini, pagamenti e analytics in una UI ordinata, operativa e pensata per chi lavora davvero in sala.</p>
        </div>

        <p class="brand-foot">Frontend operativo per hospitality moderna</p>
      </section>

      <section class="login-card" [class.login-card--loading]="authLoading" [attr.aria-busy]="authLoading">
        <div class="auth-overlay" *ngIf="authLoading">
          <app-brand-loader
            label="Accesso in corso"
            hint="Verifica credenziali e apertura della Sala"
          />
        </div>

        <span class="eyebrow">Backoffice</span>
        <h1>Accedi a WaiterO</h1>
        <p>Accedi con email e password oppure continua con Google se il tuo account e gia stato abilitato.</p>

        <form class="local-login" (ngSubmit)="submitLocalLogin()">
          <label>
            Email account locale
            <input
              #emailInput
              type="email"
              name="email"
              [(ngModel)]="email"
              [attr.autocomplete]="isNativeMobile ? 'off' : 'email'"
              [attr.autocapitalize]="isNativeMobile ? 'none' : null"
              [attr.autocorrect]="isNativeMobile ? 'off' : null"
              [attr.spellcheck]="isNativeMobile ? 'false' : null"
              [attr.data-lpignore]="isNativeMobile ? 'true' : null"
              [attr.data-1p-ignore]="isNativeMobile ? 'true' : null"
              inputmode="email"
              [disabled]="authLoading"
              required
            />
          </label>

          <label>
            Password
            <input
              #passwordInput
              type="password"
              name="password"
              [(ngModel)]="password"
              [attr.autocomplete]="isNativeMobile ? 'off' : 'current-password'"
              [attr.autocapitalize]="isNativeMobile ? 'none' : null"
              [attr.autocorrect]="isNativeMobile ? 'off' : null"
              [attr.spellcheck]="isNativeMobile ? 'false' : null"
              [attr.data-lpignore]="isNativeMobile ? 'true' : null"
              [attr.data-1p-ignore]="isNativeMobile ? 'true' : null"
              [disabled]="authLoading"
              required
            />
          </label>

          <button type="submit" class="primary-login" [disabled]="authLoading">
            {{ authLoading ? 'Accesso in corso...' : 'Accedi' }}
          </button>
        </form>

        <div class="divider"><span>Oppure con Google</span></div>

        <div class="login-actions">
          <ng-container *ngIf="isNativeMobile; else webGoogleLogin">
            <button type="button" class="google-fallback" *ngIf="loadingButton && !authLoading" disabled>Preparazione accesso Google...</button>
            <button type="button" class="google-fallback" *ngIf="!loadingButton && !authLoading" (click)="signInWithGoogleNative()">
              Continua con Google
            </button>
          </ng-container>
          <ng-template #webGoogleLogin>
            <div #googleButtonHost class="google-host" [class.is-hidden]="buttonReady || authLoading"></div>
            <button type="button" class="google-fallback" *ngIf="loadingButton && !authLoading" disabled>Caricamento accesso Google...</button>
            <button type="button" class="google-fallback" *ngIf="loadError && !authLoading" (click)="retryRender()">Riprova Google</button>
          </ng-template>
        </div>

        <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
      </section>
    </div>
  `,
  styles: [`
    .login-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 460px);
      align-items: stretch;
      padding: 1.25rem;
      gap: 1.25rem;
      background:
        radial-gradient(circle at top left, rgba(216, 122, 44, 0.16), transparent 28%),
        linear-gradient(180deg, #fbf8f3 0%, #f5f1ea 100%);
    }

    .login-brand-panel {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2.25rem;
      border-radius: 32px;
      background: linear-gradient(180deg, #232833 0%, #1a1e25 100%);
      color: rgba(255, 253, 248, 0.88);
      box-shadow: 0 24px 60px rgba(20, 25, 34, 0.16);
    }

    .brand-top {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: linear-gradient(135deg, #d87a2c, #e7a162);
      color: white;
    }

    .brand-copy { max-width: 34rem; }

    .brand-copy h1 {
      margin: 0.9rem 0 1rem;
      font-family: var(--font-display);
      font-size: clamp(2.4rem, 5vw, 4rem);
      line-height: 0.98;
      letter-spacing: -0.04em;
      color: #fffdf8;
    }

    .brand-copy p,
    .brand-foot {
      color: rgba(255, 253, 248, 0.66);
      font-size: 1rem;
      line-height: 1.7;
    }

    .login-card {
      position: relative;
      width: min(430px, 100%);
      justify-self: center;
      align-self: center;
      padding: 2.4rem 2.2rem;
      border: 1px solid rgba(37, 42, 51, 0.1);
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 20px 44px rgba(20, 25, 34, 0.08);
      text-align: left;
      overflow: hidden;
    }

    .login-card--loading > *:not(.auth-overlay) {
      opacity: 0.28;
      pointer-events: none;
      user-select: none;
    }

    .auth-overlay {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(2px);
    }

    .eyebrow {
      display: inline-flex;
      margin-bottom: 0.8rem;
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      background: rgba(216, 122, 44, 0.12);
      color: #b86522;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .eyebrow.inverse {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 253, 248, 0.8);
    }

    h1 {
      margin: 0 0 0.55rem;
      font-size: 2.2rem;
      letter-spacing: -0.05em;
      color: var(--text);
    }

    p {
      margin: 0 0 1.4rem;
      color: var(--text-muted);
    }

    .local-login,
    .login-actions {
      display: grid;
      gap: 0.75rem;
    }

    .local-login label {
      display: grid;
      gap: 0.4rem;
      color: #252a33;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .local-login input {
      width: 100%;
      min-height: 46px;
      box-sizing: border-box;
      padding: 0 0.95rem;
      border: 1px solid rgba(37, 42, 51, 0.14);
      border-radius: 14px;
      background: white;
      font: inherit;
      color: #252a33;
    }

    .primary-login {
      min-height: 48px;
      border: 0;
      border-radius: 15px;
      background: #1f232c;
      color: white;
      font: inherit;
      font-weight: 800;
    }

    .primary-login:disabled { opacity: 0.72; }

    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.2rem 0;
      color: rgba(37, 42, 51, 0.48);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .divider::before,
    .divider::after {
      content: '';
      height: 1px;
      flex: 1;
      background: rgba(37, 42, 51, 0.1);
    }

    .google-host {
      display: flex;
      justify-content: flex-start;
      min-height: 44px;
    }

    .google-host.is-hidden { min-height: 0; }

    .google-fallback {
      min-height: 44px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: white;
      font: inherit;
      font-weight: 600;
      color: var(--text);
    }

    .error {
      margin-top: 1rem;
      color: #b42318;
    }

    @media (max-width: 980px) {
      .login-shell { grid-template-columns: 1fr; }
      .login-brand-panel { display: none; }
      .login-card { text-align: left; }
      .google-host { justify-content: center; }
    }
  `]
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleButtonHost', { static: true }) private googleButtonHost?: ElementRef<HTMLDivElement>;
  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') private passwordInput?: ElementRef<HTMLInputElement>;

  private auth = inject(AuthService);
  private platformId = inject(PLATFORM_ID);
  readonly isNativeMobile = Capacitor.isNativePlatform();
  email = '';
  password = '';
  authLoading = false;
  loadingButton = true;
  buttonReady = false;
  loadError = false;
  errorMessage = '';
  private nativeGoogleReady = false;

  ngAfterViewInit(): void {
    if (this.isNativeMobile) {
      void this.initializeNativeGoogleLogin();
      return;
    }

    void this.renderGoogleButton();
  }

  submitLocalLogin(): void {
    if (this.authLoading) {
      return;
    }

    const resolvedEmail = this.resolveEmailValue();
    const resolvedPassword = this.resolvePasswordValue();
    this.email = resolvedEmail;
    this.password = resolvedPassword;

    this.runAuth(
      () => this.auth.loginWithLocalCredentials(resolvedEmail, resolvedPassword),
      'Credenziali non valide.',
      'Errore login proprietario'
    );
  }

  retryRender(): void {
    this.loadingButton = true;
    this.buttonReady = false;
    this.loadError = false;
    this.errorMessage = '';
    if (this.isNativeMobile) {
      void this.initializeNativeGoogleLogin(true);
      return;
    }
    void this.renderGoogleButton(true);
  }

  signInWithGoogleNative(): void {
    if (this.authLoading || !this.nativeGoogleReady) {
      return;
    }

    this.runAuth(
      async () => {
        const response = await SocialLogin.login({
          provider: 'google',
          options: {
            scopes: ['email', 'profile'],
            style: 'bottom',
            filterByAuthorizedAccounts: false
          }
        });

        const result = response.result as GoogleLoginResponseOnline;
        const idToken = result.idToken;
        if (!idToken) {
          throw new Error('Google native login did not return an idToken.');
        }

        await this.auth.loginWithGoogleIdToken(idToken);
      },
      'Account Google non autorizzato.',
      'Errore login Google nativo'
    );
  }

  private async initializeNativeGoogleLogin(forceReload = false): Promise<void> {
    if (this.nativeGoogleReady && !forceReload) {
      this.loadingButton = false;
      this.loadError = false;
      return;
    }

    try {
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_WEB_CLIENT_ID,
          mode: 'online'
        }
      });
      this.nativeGoogleReady = true;
      this.loadingButton = false;
      this.buttonReady = true;
      this.loadError = false;
    } catch (err) {
      console.error('Errore inizializzazione Google Sign-In nativo', err);
      this.nativeGoogleReady = false;
      this.loadingButton = false;
      this.buttonReady = false;
      this.loadError = true;
      this.errorMessage = 'Impossibile inizializzare Google sull\'app. Verifica la configurazione Android.';
    }
  }

  private async renderGoogleButton(forceReload = false): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const host = this.googleButtonHost?.nativeElement;
    if (!host) {
      this.loadingButton = false;
      this.loadError = true;
      return;
    }

    try {
      const google = await this.loadGoogleIdentityScript(forceReload);
      host.innerHTML = '';
      google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        callback: (response: { credential?: string }) => this.handleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });
      google.accounts.id.disableAutoSelect();
      google.accounts.id.renderButton(host, {
        theme: 'outline',
        size: 'large',
        width: 280,
        text: 'continue_with',
        shape: 'pill'
      });
      this.loadingButton = false;
      this.buttonReady = true;
      this.loadError = false;
    } catch (err) {
      console.error('Errore caricamento Google Identity', err);
      this.loadingButton = false;
      this.buttonReady = false;
      this.loadError = true;
      this.errorMessage = 'Impossibile caricare il pulsante Google. Riprova.';
    }
  }

  private handleCredentialResponse(response: { credential?: string }): void {
    if (this.authLoading) {
      return;
    }

    const idToken = response.credential;
    if (!idToken) {
      this.errorMessage = 'Token Google non valido.';
      return;
    }

    this.runAuth(
      () => this.auth.loginWithGoogleIdToken(idToken),
      'Account Google non autorizzato.',
      'Errore login Google'
    );
  }

  private runAuth(action: () => Promise<void>, fallbackError: string, logLabel: string): void {
    if (this.authLoading) {
      return;
    }

    this.errorMessage = '';
    this.authLoading = true;

    void action().catch(err => {
      console.error(logLabel, {
        status: err?.status,
        statusText: err?.statusText,
        message: err?.message,
        error: err?.error,
        url: err?.url
      });
      this.errorMessage = this.resolveAuthErrorMessage(err, fallbackError);
      this.authLoading = false;
    });
  }

  private resolveAuthErrorMessage(err: any, fallbackError: string): string {
    if (err?.status === 0) {
      return 'Connessione al server bloccata. Verifica configurazione rete/CORS del backend mobile.';
    }

    return err?.error?.message ?? fallbackError;
  }

  private resolveEmailValue(): string {
    const liveValue = this.emailInput?.nativeElement?.value ?? this.email;
    return liveValue.trim().toLowerCase();
  }

  private resolvePasswordValue(): string {
    return this.passwordInput?.nativeElement?.value ?? this.password;
  }

  private loadGoogleIdentityScript(forceReload: boolean): Promise<any> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(new Error('Google Identity non disponibile lato server'));
    }

    if (!forceReload && window.google?.accounts?.id) {
      return Promise.resolve(window.google);
    }

    return new Promise((resolve, reject) => {
      if (forceReload) {
        const existing = document.querySelector('script[data-google-identity="true"]');
        existing?.remove();
      }

      const existingScript = document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Google Identity script load failed')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset['googleIdentity'] = 'true';
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Google Identity script load failed'));
      document.head.appendChild(script);
    });
  }
}

