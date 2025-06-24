import { Component, ElementRef, inject, AfterViewInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../auth/AuthService';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <h1>Accedi con Google</h1>
      <div id="g_id_signin"></div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 5rem;
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
          width: 250
        }
      );
    }
  }

  handleCredentialResponse(response: any) {
    const idToken = response.credential;
    this.auth.loginWithGoogleIdToken(idToken);
  }
}
