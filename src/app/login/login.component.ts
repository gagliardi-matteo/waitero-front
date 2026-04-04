import { Component, ElementRef, inject, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../auth/AuthService';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
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
        <span class="eyebrow">Backoffice ristorante</span>
        <h1>Accedi a WaiterO</h1>
        <p>Gestisci menu, tavoli, ordini e pagamenti da un pannello unico.</p>
        <div id="g_id_signin"></div>
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

    .brand-copy {
      max-width: 34rem;
    }

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

    #g_id_signin {
      display: flex;
      justify-content: flex-start;
    }

    @media (max-width: 980px) {
      .login-shell {
        grid-template-columns: 1fr;
      }

      .login-brand-panel {
        display: none;
      }

      .login-card {
        text-align: center;
      }

      #g_id_signin {
        justify-content: center;
      }
    }
  `]
})
export class LoginComponent implements AfterViewInit {
  private auth = inject(AuthService);
  private elementRef = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      google.accounts.id.initialize({
        client_id: '910347869788-astuldpi4hi3hb0osucuoclhfjdh5dtj.apps.googleusercontent.com',
        callback: (response: any) => this.handleCredentialResponse(response)
      });

      google.accounts.id.renderButton(
        this.elementRef.nativeElement.querySelector('#g_id_signin'),
        {
          theme: 'outline',
          size: 'large',
          width: 280
        }
      );
    }
  }

  handleCredentialResponse(response: any) {
    const idToken = response.credential;
    this.auth.loginWithGoogleIdToken(idToken);
  }
}
