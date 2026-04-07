import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CustomerOrder, OrderSummary } from '../models/customer-order.model';
import { AuthService } from '../auth/AuthService';

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

  getActiveOrders(): Observable<CustomerOrder[]> {
    return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/orders/active`);
  }

  getHistoryOrders(): Observable<CustomerOrder[]> {
    return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/orders/history`);
  }

  getActiveOrderSummaries(): Observable<OrderSummary[]> {
    return this.http.get<OrderSummary[]>(`${environment.apiUrl}/orders/active-summary`);
  }

  getAllOrderSummaries(): Observable<OrderSummary[]> {
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
    return this.http.get<CustomerOrder>(`${environment.apiUrl}/orders/${orderId}`);
  }

  createManualOrder(payload: ManualOrderPayload): Observable<CustomerOrder> {
    return this.http.post<CustomerOrder>(`${environment.apiUrl}/orders/manual`, payload);
  }

  payOrder(orderId: number, paymentMode: string, payload?: { amount?: number; participantName?: string; allocations?: PaymentAllocationPayload[] }): Observable<CustomerOrder> {
    return this.http.post<CustomerOrder>(`${environment.apiUrl}/orders/${orderId}/pay`, {
      paymentMode,
      amount: payload?.amount,
      participantName: payload?.participantName,
      allocations: payload?.allocations
    });
  }

  connectToStream(): EventSource | null {
    const token = this.auth.getToken();
    if (!token || typeof window === 'undefined') {
      return null;
    }

    return new EventSource(`${environment.apiUrl}/orders/stream?token=${encodeURIComponent(token)}`);
  }
}
