import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class DemoContextService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly key = 'waitero_demo_token';
  private active = false;

  activate(token: string): void { this.active = true; if (isPlatformBrowser(this.platformId)) localStorage.setItem(this.key, token); }
  deactivate(): void { this.active = false; if (isPlatformBrowser(this.platformId)) localStorage.removeItem(this.key); }
  get token(): string | null { return isPlatformBrowser(this.platformId) ? localStorage.getItem(this.key) : null; }
  get enabled(): boolean {
    if (this.active) return true;
    return isPlatformBrowser(this.platformId) && window.location.pathname.startsWith('/demo/') && !!this.token;
  }
}
