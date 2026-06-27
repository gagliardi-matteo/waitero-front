import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface GpsSnapshot {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  denied?: boolean;
  permissionState?: 'granted' | 'prompt' | 'denied' | 'unsupported';
}

@Injectable({ providedIn: 'root' })
export class GpsService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  async getCurrentPositionSafe(): Promise<GpsSnapshot> {
    if (!isPlatformBrowser(this.platformId) || !('geolocation' in navigator)) {
      return { latitude: null, longitude: null, accuracy: null, denied: false, permissionState: 'unsupported' };
    }

    const permissionState = await this.getPermissionState();
    if (permissionState === 'denied') {
      return {
        latitude: null,
        longitude: null,
        accuracy: null,
        denied: true,
        permissionState
      };
    }

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          denied: false,
          permissionState: 'granted'
        }),
        error => resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          denied: error?.code === 1,
          permissionState: error?.code === 1 ? 'denied' : permissionState
        }),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
      );
    });
  }

  async getPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
    if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') {
      return 'unsupported';
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted' || status.state === 'prompt' || status.state === 'denied') {
        return status.state;
      }
    } catch {
      return 'unsupported';
    }

    return 'unsupported';
  }
}
