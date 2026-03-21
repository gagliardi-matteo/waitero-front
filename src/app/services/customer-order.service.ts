import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CustomerDraft, CustomerOrder } from '../models/customer-order.model';
import { AuthContextService } from './auth-context.service';

interface SubmitOrderPayload {
  token: string;
  restaurantId: string;
  tableId: string;
  items: Array<{
    dishId: number;
    quantity: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class CustomerOrderService {
  private http = inject(HttpClient);
  private auth = inject(AuthContextService);

  getCurrentOrder(token: string, restaurantId: string, tableId: string): Observable<CustomerOrder> {
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerOrder>(`${environment.apiUrl}/customer/orders/current`, { params });
  }

  getCurrentDraft(token: string, restaurantId: string, tableId: string): Observable<CustomerDraft> {
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerDraft>(`${environment.apiUrl}/customer/orders/draft`, { params });
  }

  mutateDraft(token: string, restaurantId: string, tableId: string, dishId: number, delta: number): Observable<CustomerDraft> {
    return this.http.post<CustomerDraft>(`${environment.apiUrl}/customer/orders/draft/items`, {
      token,
      restaurantId,
      tableId,
      dishId,
      delta,
      deviceId: this.auth.deviceIdValue,
      fingerprint: this.auth.fingerprintValue
    });
  }

  connectToTableStream(token: string, restaurantId: string, tableId: string): EventSource | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const params = new URLSearchParams({
      token,
      restaurantId,
      tableId,
      deviceId: this.auth.deviceIdValue ?? ''
    });

    const fingerprint = this.auth.fingerprintValue;
    if (fingerprint) {
      params.set('fingerprint', fingerprint);
    }

    return new EventSource(`${environment.apiUrl}/customer/orders/stream?${params.toString()}`);
  }

  submitOrder(payload: SubmitOrderPayload): Observable<CustomerOrder> {
    return this.http.post<CustomerOrder>(`${environment.apiUrl}/customer/orders`, {
      ...payload,
      deviceId: this.auth.deviceIdValue,
      fingerprint: this.auth.fingerprintValue
    });
  }

  private withAccessMetadata(params: HttpParams): HttpParams {
    const deviceId = this.auth.deviceIdValue;
    if (deviceId) {
      params = params.set('deviceId', deviceId);
    }

    const fingerprint = this.auth.fingerprintValue;
    if (fingerprint) {
      params = params.set('fingerprint', fingerprint);
    }

    return params;
  }
}
