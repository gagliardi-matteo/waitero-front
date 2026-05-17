import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface GpsSnapshot {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  denied?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GpsService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  async getCurrentPositionSafe(): Promise<GpsSnapshot> {
    if (!isPlatformBrowser(this.platformId) || !('geolocation' in navigator)) {
      return { latitude: null, longitude: null, accuracy: null, denied: false };
    }

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          denied: false
        }),
        error => resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          denied: error?.code === 1
        }),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
      );
    });
  }
}
