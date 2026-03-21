import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CustomerOrder } from '../models/customer-order.model';
import { AuthService } from '../auth/AuthService';

interface PaymentAllocationPayload {
  orderItemId: number;
  quantity: number;
}

interface ManualOrderPayload {
  tableId: number;
  items: Array<{ dishId: number; quantity: number }>;
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
