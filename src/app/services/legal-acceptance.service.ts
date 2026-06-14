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

    const publicPath = this.publicLegalPath(url);
    const publicOrigin = this.publicFrontendOrigin();
    return `${publicOrigin}${publicPath}`;
  }

  termsClientUrl(): string {
    return this.documentUrl('/legal/termini-uso');
  }

  privacyClientUrl(): string {
    return this.documentUrl('/legal/privacy-policy');
  }

  contractUrl(url: string | null | undefined): string {
    return this.documentUrl(url || '/legal/contratto-saas');
  }

  private publicLegalPath(url: string): string {
    const normalized = url.startsWith('/') ? url : `/${url}`;
    const lastSegment = normalized.split('/').pop()?.toLowerCase() ?? '';

    if (lastSegment === 'terms-client-v1.0.html' || normalized === '/legal/termini-uso') {
      return '/legal/termini-uso';
    }
    if (lastSegment === 'privacy-client-v1.0.html' || normalized === '/legal/privacy-policy') {
      return '/legal/privacy-policy';
    }
    if (lastSegment === 'disclaimer-allergeni-v1.0.html') {
      return '/legal/termini-uso';
    }
    if (normalized === '/legal/contratto-saas') {
      return normalized;
    }

    return normalized;
  }

  private publicFrontendOrigin(): string {
    if (environment.publicFrontendUrl) {
      const origin = this.absoluteOrigin(environment.publicFrontendUrl);
      if (origin) {
        return origin;
      }
    }
    return window.location.origin;
  }

  private absoluteOrigin(value: string): string | null {
    const anchor = document.createElement('a');
    anchor.href = value;
    if (anchor.protocol && anchor.host) {
      return `${anchor.protocol}//${anchor.host}`;
    }
    return null;
  }
}
