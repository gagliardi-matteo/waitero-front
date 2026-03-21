import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class DeviceIdService {
  private readonly storageKey = 'waitero_device';

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  getOrCreate(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return 'server-device';
    }

    const existing = window.localStorage.getItem(this.storageKey);
    if (existing) {
      return existing;
    }

    const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `waitero-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(this.storageKey, generated);
    return generated;
  }
}
