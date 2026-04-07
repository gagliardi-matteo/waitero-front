import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, Observable, of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { CustomerDraft, CustomerOrder } from '../models/customer-order.model';
import { AuthContextService } from './auth-context.service';
import { Piatto } from '../models/piatto.model';

interface SubmitOrderPayload {
  token: string;
  restaurantId: string;
  tableId: string;
  noteCucina?: string;
  items: Array<{
    dishId: number;
    quantity: number;
  }>;
}

export interface CustomerOrderState {
  currentOrder: CustomerOrder | null;
  draft: CustomerDraft;
}

@Injectable({ providedIn: 'root' })
export class CustomerOrderService {
  private http = inject(HttpClient);
  private auth = inject(AuthContextService);
  private router = inject(Router);

  getCurrentOrder(token: string, restaurantId: string, tableId: string): Observable<CustomerOrder> {
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerOrder>(`${environment.apiUrl}/customer/orders/current`, { params })
      .pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId)));
  }

  getCurrentDraft(token: string, restaurantId: string, tableId: string): Observable<CustomerDraft> {
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerDraft>(`${environment.apiUrl}/customer/orders/draft`, { params })
      .pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId)));
  }

  getCurrentState(token: string, restaurantId: string, tableId: string): Observable<CustomerOrderState> {
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerOrderState>(`${environment.apiUrl}/customer/orders/state`, { params })
      .pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId)));
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
    }).pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId)));
  }

  getUpsellSuggestions(dishId: number, restaurantId: string): Observable<Piatto[]> {
    const params = new HttpParams().set('restaurantId', restaurantId);
    return this.http.get<Piatto[]>(`${environment.apiUrl}/customer/upsell/${dishId}`, { params });
  }

  getCartUpsellSuggestions(dishIds: number[], restaurantId: string): Observable<Piatto[]> {
    if (dishIds.length === 0) {
      return of([]);
    }

    let params = new HttpParams().set('restaurantId', restaurantId);
    dishIds.forEach(dishId => {
      params = params.append('dishIds', String(dishId));
    });

    return this.http.get<Piatto[]>(`${environment.apiUrl}/customer/upsell/cart-suggestions`, { params });
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
    }).pipe(catchError(err => this.handleTableAccessError(err, payload.token, payload.restaurantId, payload.tableId)));
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

  private handleTableAccessError(err: any, token: string, restaurantId: string, tableId: string) {
    const message = err?.error?.message ?? '';
    if (typeof message === 'string' && message.includes('Accesso tavolo non autorizzato')) {
      this.auth.clear();
      void this.router.navigate(['/menu', restaurantId, tableId, token], { replaceUrl: true });
    }

    return throwError(() => err);
  }
}
