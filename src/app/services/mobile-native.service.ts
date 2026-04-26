import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

@Injectable({ providedIn: 'root' })
export class MobileNativeService {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) {
      return;
    }

    this.initialized = true;
    document.body.classList.add('capacitor-native', `platform-${Capacitor.getPlatform()}`);

    await this.configureStatusBar();
    await SplashScreen.hide();
    this.configureAndroidBackButton();
    this.configureTouchHaptics();
  }

  private async configureStatusBar(): Promise<void> {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#fbf8f3' });
    } catch {
      // Status bar APIs are only available on native platforms.
    }
  }

  private configureAndroidBackButton(): void {
    void App.addListener('backButton', ({ canGoBack }) => {
      this.zone.run(() => {
        if (canGoBack && this.router.url !== '/') {
          window.history.back();
          return;
        }

        void App.exitApp();
      });
    });
  }

  private configureTouchHaptics(): void {
    document.addEventListener(
      'click',
      event => {
        const target = event.target as HTMLElement | null;
        const interactive = target?.closest('button, a, [role="button"], input[type="submit"]');

        if (!interactive || interactive.hasAttribute('disabled')) {
          return;
        }

        void Haptics.impact({ style: ImpactStyle.Light });
      },
      { passive: true }
    );
  }
}
