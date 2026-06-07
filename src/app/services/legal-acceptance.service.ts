import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LegalConfig {
  contractVersion: string;
  privacyVersion: string;
  termsVersion: string;
  allergenDisclaimerVersion: string;
  contractUrl: string;
  privacyUrl: string;
  termsUrl: string;
  allergenDisclaimerUrl: string;
}

export interface LegalStatus {
  accepted: boolean;
  config: LegalConfig;
}

export interface CustomerLegalAcceptancePayload {
  sessionId: string;
  tablePublicId: string | null;
  restaurantId: string | null;
  tableId: number | null;
  qrToken: string;
}

@Injectable({ providedIn: 'root' })
export class LegalAcceptanceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/legal`;
  private customerLegalUrl = `${environment.apiUrl}/customer/legal`;

  getConfig(): Observable<LegalConfig> {
    return this.http.get<LegalConfig>(`${this.baseUrl}/config`);
  }

  getBackofficeStatus(): Observable<LegalStatus> {
    return this.http.get<LegalStatus>(`${this.baseUrl}/backoffice/status`);
  }

  acceptBackoffice(): Observable<LegalStatus> {
    return this.http.post<LegalStatus>(`${this.baseUrl}/backoffice/accept`, {});
  }

  getCustomerStatus(sessionId: string): Observable<LegalStatus> {
    return this.http.get<LegalStatus>(`${this.customerLegalUrl}/status`, {
      params: new HttpParams().set('sessionId', sessionId)
    });
  }

  acceptCustomer(payload: CustomerLegalAcceptancePayload): Observable<LegalStatus> {
    return this.http.post<LegalStatus>(`${this.customerLegalUrl}/accept`, payload);
  }

  documentUrl(url: string | null | undefined): string {
    if (!url) {
      return '#';
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    const apiOrigin = this.apiOrigin();
    return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`;
  }

  termsClientUrl(): string {
    return this.documentUrl('/legal/terms-client-v1.0.html');
  }

  privacyClientUrl(): string {
    return this.documentUrl('/legal/privacy-client-v1.0.html');
  }

  contractUrl(url: string | null | undefined): string {
    return this.documentUrl(url || '/legal/terms-client-v1.0.html');
  }

  private apiOrigin(): string {
    const anchor = document.createElement('a');
    anchor.href = environment.apiUrl;
    if (anchor.protocol && anchor.host) {
      return `${anchor.protocol}//${anchor.host}`;
    }
    return window.location.origin;
  }
}
