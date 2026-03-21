import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface GpsSnapshot {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

@Injectable({ providedIn: 'root' })
export class GpsService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  async getCurrentPositionSafe(): Promise<GpsSnapshot> {
    if (!isPlatformBrowser(this.platformId) || !('geolocation' in navigator)) {
      return { latitude: null, longitude: null, accuracy: null };
    }

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
        () => resolve({ latitude: null, longitude: null, accuracy: null }),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
      );
    });
  }
}
