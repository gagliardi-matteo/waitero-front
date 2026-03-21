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
      place-items: center;
      padding: 1.25rem;
      background:
        radial-gradient(circle at top, rgba(15, 157, 88, 0.16), transparent 34%),
        linear-gradient(180deg, #fbfbfb 0%, #f3f4f6 100%);
    }

    .login-card {
      width: min(430px, 100%);
      padding: 2.2rem 2rem;
      border: 1px solid rgba(17, 24, 39, 0.1);
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      text-align: center;
    }

    .eyebrow {
      display: inline-flex;
      margin-bottom: 0.8rem;
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      background: rgba(15, 157, 88, 0.12);
      color: #0b7a44;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 0.55rem;
      font-size: 2.2rem;
      letter-spacing: -0.05em;
      color: #111111;
    }

    p {
      margin: 0 0 1.4rem;
      color: #6b7280;
    }

    #g_id_signin {
      display: flex;
      justify-content: center;
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
