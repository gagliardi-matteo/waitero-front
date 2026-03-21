import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SecureTableAccessPayload {
  tablePublicId?: string | null;
  qrToken: string;
  restaurantId?: string | null;
  tableId?: number | null;
  deviceId: string;
  fingerprint?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
}

export interface SecureTableAccessResponse {
  allowed: boolean;
  status: string;
  message: string;
  restaurantId: number;
  tableId: number;
  tablePublicId: string;
  tableName: string;
  qrToken: string;
  riskScore: number;
}

@Injectable({ providedIn: 'root' })
export class TableAccessService {
  private http = inject(HttpClient);

  validateAccess(payload: SecureTableAccessPayload): Observable<SecureTableAccessResponse> {
    return this.http.post<SecureTableAccessResponse>(`${environment.apiUrl}/table/access`, payload);
  }
}
