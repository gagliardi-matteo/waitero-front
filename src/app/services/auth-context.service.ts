import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthContextService {
  private token: string | null = null;
  private restaurantId: string | null = null;
  private tableId: string | null = null;
  private deviceId: string | null = null;
  private fingerprint: string | null = null;

  setContext(token: string, restaurantId: string, tableId: string, deviceId: string, fingerprint: string | null) {
    this.token = token;
    this.restaurantId = restaurantId;
    this.tableId = tableId;
    this.deviceId = deviceId;
    this.fingerprint = fingerprint;

    sessionStorage.setItem('authToken', token);
    sessionStorage.setItem('restaurantId', restaurantId);
    sessionStorage.setItem('tableId', tableId);
    sessionStorage.setItem('waiteroDeviceId', deviceId);
    if (fingerprint) {
      sessionStorage.setItem('waiteroFingerprint', fingerprint);
    } else {
      sessionStorage.removeItem('waiteroFingerprint');
    }
  }

  get tokenValue(): string | null {
    return this.token ?? sessionStorage.getItem('authToken');
  }

  get restaurantIdValue(): string | null {
    return this.restaurantId ?? sessionStorage.getItem('restaurantId');
  }

  get tableIdValue(): string | null {
    return this.tableId ?? sessionStorage.getItem('tableId');
  }

  get deviceIdValue(): string | null {
    return this.deviceId ?? sessionStorage.getItem('waiteroDeviceId');
  }

  get fingerprintValue(): string | null {
    return this.fingerprint ?? sessionStorage.getItem('waiteroFingerprint');
  }

  clear() {
    this.token = null;
    this.restaurantId = null;
    this.tableId = null;
    this.deviceId = null;
    this.fingerprint = null;
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('restaurantId');
    sessionStorage.removeItem('tableId');
    sessionStorage.removeItem('waiteroDeviceId');
    sessionStorage.removeItem('waiteroFingerprint');
  }
}
