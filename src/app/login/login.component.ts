import { AfterViewInit, Component, ElementRef, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/AuthService';

declare global {
  interface Window {
    google?: any;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-shell">
      <section class="login-brand-panel">
        <div class="brand-top">
          <div class="brand-mark">W</div>
          <span>WaiterO</span>
        </div>

        <div class="brand-copy">
          <span class="eyebrow inverse">Hospitality Tech</span>
          <h1>Gestisci il ristorante in un unico pannello.</h1>
          <p>Menu, tavoli, ordini, pagamenti e analytics in una UI ordinata, operativa e pensata per chi lavora davvero in sala.</p>
        </div>

        <p class="brand-foot">Frontend operativo per ristorazione moderna</p>
      </section>

      <section class="login-card">
        <span class="eyebrow">Backoffice</span>
        <h1>Accedi a WaiterO</h1>
        <p>Accedi con email e password oppure continua con Google se il tuo account e gia stato abilitato.</p>

        <form class="local-login" (ngSubmit)="submitLocalLogin()">
          <label>
            Email ristoratore
            <input type="email" name="email" [(ngModel)]="email" autocomplete="email" required />
          </label>

          <label>
            Password
            <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required />
          </label>

          <button type="submit" class="primary-login" [disabled]="localLoading">
            {{ localLoading ? 'Accesso in corso...' : 'Accedi' }}
          </button>
        </form>

        <div class="divider"><span>Oppure con Google</span></div>

        <div class="login-actions">
          <div #googleButtonHost class="google-host" [class.is-hidden]="buttonReady"></div>
          <button type="button" class="google-fallback" *ngIf="loadingButton" disabled>Caricamento accesso Google...</button>
          <button type="button" class="google-fallback" *ngIf="loadError" (click)="retryRender()">Riprova Google</button>
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
      width: min(430px, 100%);
      justify-self: center;
      align-self: center;
      padding: 2.4rem 2.2rem;
      border: 1px solid rgba(37, 42, 51, 0.1);
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 20px 44px rgba(20, 25, 34, 0.08);
      text-align: left;
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

  private auth = inject(AuthService);
  private platformId = inject(PLATFORM_ID);
  email = '';
  password = '';
  localLoading = false;
  loadingButton = true;
  buttonReady = false;
  loadError = false;
  errorMessage = '';

  ngAfterViewInit(): void {
    void this.renderGoogleButton();
  }

  submitLocalLogin(): void {
    if (this.localLoading) {
      return;
    }

    this.errorMessage = '';
    this.localLoading = true;
    void this.auth.loginWithLocalCredentials(this.email, this.password)
      .catch(err => {
        console.error('Errore login proprietario', err);
        this.errorMessage = err?.error?.message ?? 'Credenziali non valide.';
      })
      .finally(() => {
        this.localLoading = false;
      });
  }

  retryRender(): void {
    this.loadingButton = true;
    this.buttonReady = false;
    this.loadError = false;
    this.errorMessage = '';
    void this.renderGoogleButton(true);
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
        client_id: '910347869788-astuldpi4hi3hb0osucuoclhfjdh5dtj.apps.googleusercontent.com',
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
    const idToken = response.credential;
    if (!idToken) {
      this.errorMessage = 'Token Google non valido.';
      return;
    }

    this.errorMessage = '';
    void this.auth.loginWithGoogleIdToken(idToken).catch(err => {
      console.error('Errore login Google', err);
      this.errorMessage = err?.error?.message ?? 'Account Google non autorizzato.';
    });
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

