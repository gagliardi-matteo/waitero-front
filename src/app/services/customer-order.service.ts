import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of, ReplaySubject, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { CustomerDraft, CustomerOrder } from '../models/customer-order.model';
import { AuthContextService } from './auth-context.service';
import { Piatto } from '../models/piatto.model';
import { OrderService } from './order.service';
import { DemoContextService } from './demo-context.service';

interface SubmitOrderPayload {
  token: string;
  restaurantId: string;
  tableId: string;
  noteCucina?: string;
  sessionId?: string;
  locationUnverified?: boolean;
  items: Array<{
    dishId: number;
    quantity: number;
    portionKey?: string;
    source?: string;
    sourceDishId?: number;
  }>;
}

interface CallWaiterPayload {
  token: string;
  restaurantId: string;
  tableId: string;
}

export interface CustomerOrderState {
  currentOrder: CustomerOrder | null;
  draft: CustomerDraft;
}

@Injectable({ providedIn: 'root' })
export class CustomerOrderService {
  private static readonly STALE_DRAFT_SNAPSHOT_GUARD_MS = 8000;

  private http = inject(HttpClient);
  private auth = inject(AuthContextService);
  private router = inject(Router);
  private orderState = inject(OrderService);
  private demo = inject(DemoContextService);
  private draftMutationQueue: Promise<void> = Promise.resolve();
  private pendingOptimisticMutations: Array<{ id: number; dishId: number; delta: number; portionKey?: string | null }> = [];
  private optimisticMutationSequence = 0;
  private optimisticContextKey: string | null = null;
  private lastAcceptedMutationAt = 0;

  getCurrentOrder(token: string, restaurantId: string, tableId: string): Observable<CustomerOrder> {
    if (this.demo.enabled) {
      return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/customer/demo/orders/active`, {
        params: new HttpParams().set('token', this.demo.token ?? token)
      }).pipe(map(orders => orders[0]));
    }
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerOrder>(`${environment.apiUrl}/customer/orders/current`, { params })
      .pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId)));
  }

  getCurrentDraft(token: string, restaurantId: string, tableId: string): Observable<CustomerDraft> {
    if (this.demo.enabled) return of(this.buildLocalDraftSnapshot(restaurantId, tableId));
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerDraft>(`${environment.apiUrl}/customer/orders/draft`, { params })
      .pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId)));
  }

  getCurrentState(token: string, restaurantId: string, tableId: string, redirectOnUnauthorized = true): Observable<CustomerOrderState> {
    if (this.demo.enabled) {
      return this.http.get<CustomerOrderState>(`${environment.apiUrl}/customer/demo/orders/state`, {
        params: new HttpParams().set('token', this.demo.token ?? token)
      });
    }
    const params = this.withAccessMetadata(new HttpParams()
      .set('token', token)
      .set('restaurantId', restaurantId)
      .set('tableId', tableId));

    return this.http.get<CustomerOrderState>(`${environment.apiUrl}/customer/orders/state`, { params })
      .pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId, redirectOnUnauthorized)));
  }

  mutateDraft(token: string, restaurantId: string, tableId: string, dishId: number, delta: number, portionKey?: string): Observable<CustomerDraft> {
    if (this.demo.enabled) return of(this.buildLocalDraftSnapshot(restaurantId, tableId));
    return this.http.post<CustomerDraft>(`${environment.apiUrl}/customer/orders/draft/items`, {
      token,
      restaurantId,
      tableId,
      dishId,
      delta,
      portionKey,
      deviceId: this.auth.deviceIdValue,
      fingerprint: this.auth.fingerprintValue
    }).pipe(catchError(err => this.handleTableAccessError(err, token, restaurantId, tableId)));
  }

  mutateDraftOptimistically(token: string, restaurantId: string, tableId: string, dishId: number, delta: number, portionKey?: string): Observable<CustomerDraft> {
    const contextKey = `${restaurantId}:${tableId}`;
    if (this.optimisticContextKey !== contextKey) {
      this.optimisticContextKey = contextKey;
      this.pendingOptimisticMutations = [];
    }

    const applied = this.orderState.applyDraftDelta(dishId, delta, portionKey ?? null);
    if (!applied) {
      return of({
        restaurantId: Number(restaurantId),
        tableId: Number(tableId),
        items: []
      });
    }

    const mutation = {
      id: ++this.optimisticMutationSequence,
      dishId,
      delta,
      portionKey: portionKey ?? null
    };
    this.pendingOptimisticMutations.push(mutation);

    const result$ = new ReplaySubject<CustomerDraft>(1);
    result$.next(this.buildLocalDraftSnapshot(restaurantId, tableId));

    const runMutation = async () => {
      try {
        await this.performDraftMutationRequest(token, restaurantId, tableId, dishId, delta, portionKey);
        this.pendingOptimisticMutations = this.pendingOptimisticMutations.filter(item => item.id !== mutation.id);
        this.lastAcceptedMutationAt = Date.now();
        result$.complete();
      } catch (err) {
        this.pendingOptimisticMutations = this.pendingOptimisticMutations.filter(item => item.id !== mutation.id);
        this.orderState.applyDraftDelta(dishId, -delta, portionKey ?? null);
        result$.error(err);
      }
    };

    this.draftMutationQueue = this.draftMutationQueue.then(runMutation, runMutation);
    return result$.asObservable();
  }

  private buildLocalDraftSnapshot(restaurantId: string, tableId: string): CustomerDraft {
    return {
      restaurantId: Number(restaurantId),
      tableId: Number(tableId),
      items: this.orderState.getDraftSnapshot()
    };
  }

  applyExternalDraftSnapshot(serverDraft: CustomerDraft): void {
    if (this.pendingOptimisticMutations.length > 0) {
      return;
    }

    if (this.isLikelyStaleDraftSnapshot(serverDraft)) {
      return;
    }

    this.orderState.setDraft(serverDraft.items);
  }

  getUpsellSuggestions(dishId: number, restaurantId: string, sessionId?: string): Observable<Piatto[]> {
    if (this.demo.enabled) return of([]);
    let params = new HttpParams().set('restaurantId', restaurantId);
    if (sessionId) {
      params = params.set('sessionId', sessionId);
    }
    return this.http.get<Piatto[]>(`${environment.apiUrl}/customer/upsell/${dishId}`, { params });
  }
  getCartUpsellSuggestions(dishIds: number[], restaurantId: string, sessionId?: string): Observable<Piatto[]> {
    if (this.demo.enabled) return of([]);
    if (dishIds.length === 0) {
      return of([]);
    }

    let params = new HttpParams().set('restaurantId', restaurantId);
    if (sessionId) {
      params = params.set('sessionId', sessionId);
    }
    dishIds.forEach(dishId => {
      params = params.append('dishIds', String(dishId));
    });

    return this.http.get<Piatto[]>(`${environment.apiUrl}/customer/upsell/cart-suggestions`, { params });
  }

  connectToTableStream(token: string, restaurantId: string, tableId: string): EventSource | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.demo.enabled) {
      return new EventSource(`${environment.apiUrl}/customer/demo/stream?token=${encodeURIComponent(this.demo.token ?? token)}`);
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
    if (this.demo.enabled) {
      return this.http.post<CustomerOrder>(`${environment.apiUrl}/customer/demo/orders`, {
        noteCucina: payload.noteCucina,
        items: payload.items
      }, { params: new HttpParams().set('token', this.demo.token ?? payload.token) });
    }
    return this.http.post<CustomerOrder>(`${environment.apiUrl}/customer/orders`, {
      ...payload,
      deviceId: this.auth.deviceIdValue,
      fingerprint: this.auth.fingerprintValue,
      locationUnverified: this.auth.locationUnverifiedValue
    }).pipe(catchError(err => this.handleTableAccessError(err, payload.token, payload.restaurantId, payload.tableId)));
  }

  private async performDraftMutationRequest(
    token: string,
    restaurantId: string,
    tableId: string,
    dishId: number,
    delta: number,
    portionKey?: string
  ): Promise<CustomerDraft> {
    return new Promise<CustomerDraft>((resolve, reject) => {
      this.mutateDraft(token, restaurantId, tableId, dishId, delta, portionKey).subscribe({
        next: draft => resolve(draft),
        error: err => reject(err)
      });
    });
  }

  private isLikelyStaleDraftSnapshot(serverDraft: CustomerDraft): boolean {
    if (this.lastAcceptedMutationAt <= 0) {
      return false;
    }

    const age = Date.now() - this.lastAcceptedMutationAt;
    if (age > CustomerOrderService.STALE_DRAFT_SNAPSHOT_GUARD_MS) {
      return false;
    }

    const localQuantity = this.orderState.totalDraftQuantity();
    if (localQuantity <= 0) {
      return false;
    }

    const serverQuantity = (serverDraft.items ?? [])
      .reduce((total, item) => total + Math.max(0, item.quantity ?? 0), 0);

    return serverQuantity !== localQuantity;
  }

  callWaiter(payload: CallWaiterPayload): Observable<{ message: string }> {
    if (this.demo.enabled) return of({ message: 'Nella demo il personale verrebbe avvisato in tempo reale.' });
    return this.http.post<{ message: string }>(`${environment.apiUrl}/customer/orders/call-waiter`, {
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

  private handleTableAccessError(err: any, token: string, restaurantId: string, tableId: string, redirectOnUnauthorized = true) {
    const message = err?.error?.message ?? '';
    if (redirectOnUnauthorized && typeof message === 'string' && message.includes('Accesso tavolo non autorizzato')) {
      this.auth.clear();
      void this.router.navigate(['/menu/bloccato'], {
        replaceUrl: true,
        queryParams: {
          message: 'In questo momento non e possibile ordinare da questo tavolo. Rivolgiti al personale del locale.'
        }
      });
    }

    return throwError(() => err);
  }
}
