import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class OrientationLockService {
  private readonly platformId = inject(PLATFORM_ID);
  private initialized = false;

  initialize(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initialized = true;
    const applyState = () => {
      const isCompactPortraitTarget = window.matchMedia('(max-width: 960px)').matches;
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;

      document.body.classList.toggle('compact-landscape-blocked', isCompactPortraitTarget && isLandscape);
    };

    applyState();
    window.addEventListener('resize', applyState, { passive: true });
    window.addEventListener('orientationchange', applyState, { passive: true });

    this.tryLockPortrait();
  }

  private async tryLockPortrait(): Promise<void> {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
    if (!orientation?.lock) {
      return;
    }

    if (!window.matchMedia('(max-width: 960px)').matches) {
      return;
    }

    try {
      await orientation.lock('portrait');
    } catch {
      // Browsers may reject locking outside fullscreen or without a user gesture.
    }
  }
}
