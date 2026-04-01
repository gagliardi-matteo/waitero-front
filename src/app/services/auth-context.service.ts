import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthContextService {
  private token: string | null = null;
  private restaurantId: string | null = null;
  private tableId: string | null = null;
  private tablePublicId: string | null = null;
  private qrToken: string | null = null;
  private deviceId: string | null = null;
  private fingerprint: string | null = null;

  setPendingAccess(qrToken: string, tablePublicId: string | null, restaurantId: string | null, tableId: string | null) {
    this.qrToken = qrToken;
    this.tablePublicId = tablePublicId;

    if (restaurantId) {
      this.restaurantId = restaurantId;
      sessionStorage.setItem('restaurantId', restaurantId);
    }

    if (tableId) {
      this.tableId = tableId;
      sessionStorage.setItem('tableId', tableId);
    }

    if (tablePublicId) {
      sessionStorage.setItem('tablePublicId', tablePublicId);
    } else {
      sessionStorage.removeItem('tablePublicId');
    }

    sessionStorage.setItem('qrToken', qrToken);
  }

  setContext(
    token: string,
    restaurantId: string,
    tableId: string,
    deviceId: string,
    fingerprint: string | null,
    tablePublicId: string | null = null
  ) {
    this.token = token;
    this.restaurantId = restaurantId;
    this.tableId = tableId;
    this.qrToken = token;
    this.tablePublicId = tablePublicId;
    this.deviceId = deviceId;
    this.fingerprint = fingerprint;

    sessionStorage.setItem('authToken', token);
    sessionStorage.setItem('qrToken', token);
    sessionStorage.setItem('restaurantId', restaurantId);
    sessionStorage.setItem('tableId', tableId);
    if (tablePublicId) {
      sessionStorage.setItem('tablePublicId', tablePublicId);
    } else {
      sessionStorage.removeItem('tablePublicId');
    }
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

  get tablePublicIdValue(): string | null {
    return this.tablePublicId ?? sessionStorage.getItem('tablePublicId');
  }

  get qrTokenValue(): string | null {
    return this.qrToken ?? sessionStorage.getItem('qrToken');
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
    this.tablePublicId = null;
    this.qrToken = null;
    this.deviceId = null;
    this.fingerprint = null;
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('qrToken');
    sessionStorage.removeItem('restaurantId');
    sessionStorage.removeItem('tableId');
    sessionStorage.removeItem('tablePublicId');
    sessionStorage.removeItem('waiteroDeviceId');
    sessionStorage.removeItem('waiteroFingerprint');
  }
}
