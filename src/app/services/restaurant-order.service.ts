import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CustomerOrder, OrderSummary } from '../models/customer-order.model';
import { AuthService } from '../auth/AuthService';
import { DemoContextService } from './demo-context.service';

interface PaymentAllocationPayload {
  orderItemId: number;
  quantity: number;
}

interface ManualOrderPayload {
  tableId: number;
  items: Array<{ dishId: number; quantity: number }>;
}

export interface OrderSummaryPage {
  items: OrderSummary[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

@Injectable({ providedIn: 'root' })
export class RestaurantOrderService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private demo = inject(DemoContextService);

  private demoParams(): HttpParams {
    return new HttpParams().set('token', this.demo.token ?? '');
  }

  getActiveOrders(): Observable<CustomerOrder[]> {
    if (this.demo.enabled) return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/customer/demo/orders/active`, { params: this.demoParams() });
    return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/orders/active`);
  }

  getHistoryOrders(): Observable<CustomerOrder[]> {
    if (this.demo.enabled) return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/customer/demo/orders/history`, { params: this.demoParams() });
    return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/orders/history`);
  }

  getActiveOrderSummaries(): Observable<OrderSummary[]> {
    if (this.demo.enabled) return this.http.get<OrderSummary[]>(`${environment.apiUrl}/customer/demo/orders/active-summary`, { params: this.demoParams() });
    return this.http.get<OrderSummary[]>(`${environment.apiUrl}/orders/active-summary`);
  }

  getAllOrderSummaries(): Observable<OrderSummary[]> {
    if (this.demo.enabled) return this.getActiveOrderSummaries();
    return this.http.get<OrderSummary[]>(`${environment.apiUrl}/orders/all-summary`);
  }

  getPagedOrderSummaries(page: number, size: number, options?: { q?: string; status?: string }): Observable<OrderSummaryPage> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));

    const search = options?.q?.trim();
    if (search) {
      params = params.set('q', search);
    }

    const status = options?.status?.trim();
    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }

    return this.http.get<OrderSummaryPage>(`${environment.apiUrl}/orders/summary/page`, { params });
  }

  getOrderById(orderId: number): Observable<CustomerOrder> {
    if (this.demo.enabled) return this.http.get<CustomerOrder>(`${environment.apiUrl}/customer/demo/orders/${orderId}`, { params: this.demoParams() });
    return this.http.get<CustomerOrder>(`${environment.apiUrl}/orders/${orderId}`);
  }

  createManualOrder(payload: ManualOrderPayload): Observable<CustomerOrder> {
    return this.http.post<CustomerOrder>(`${environment.apiUrl}/orders/manual`, payload);
  }

  payOrder(orderId: number, paymentMode: string, payload?: { amount?: number; participantName?: string; allocations?: PaymentAllocationPayload[] }): Observable<CustomerOrder> {
    if (this.demo.enabled) return this.http.post<CustomerOrder>(`${environment.apiUrl}/customer/demo/orders/${orderId}/complete`, {}, { params: this.demoParams() });
    return this.http.post<CustomerOrder>(`${environment.apiUrl}/orders/${orderId}/pay`, {
      paymentMode,
      amount: payload?.amount,
      participantName: payload?.participantName,
      allocations: payload?.allocations
    });
  }

  reprintOrder(orderId: number): Observable<void> {
    if (this.demo.enabled) return throwError(() => new Error('Funzione disabilitata nella demo'));
    return this.http.post<void>(`${environment.apiUrl}/orders/${orderId}/reprint`, {});
  }

  connectToStream(): EventSource | null {
    if (this.demo.enabled && typeof window !== 'undefined') {
      return new EventSource(`${environment.apiUrl}/customer/demo/stream?token=${encodeURIComponent(this.demo.token ?? '')}`);
    }
    const token = this.auth.getToken();
    if (!token || typeof window === 'undefined') {
      return null;
    }

    return new EventSource(`${environment.apiUrl}/orders/stream?token=${encodeURIComponent(token)}`);
  }
}
