import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

@Injectable({ providedIn: 'root' })
export class FingerprintService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  async getVisitorId(): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  }
}
