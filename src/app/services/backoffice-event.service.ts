import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { RestaurantOrderService } from './restaurant-order.service';

export interface BackofficeOrderEventPayload {
  type?: string;
  orderId?: number;
  restaurantId?: number;
  tableId?: number;
  status?: string;
  message?: string;
}

export interface BackofficeOrderEvent {
  rawEvent: Event;
  payload: BackofficeOrderEventPayload | null;
}

export type BackofficeEventConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

@Injectable({ providedIn: 'root' })
export class BackofficeEventService {
  private readonly restaurantOrderService = inject(RestaurantOrderService);
  private readonly ordersUpdatedSubject = new Subject<BackofficeOrderEvent>();
  private readonly connectionLostSubject = new Subject<void>();
  private readonly connectionRestoredSubject = new Subject<void>();
  private readonly connectionStateSubject = new BehaviorSubject<BackofficeEventConnectionState>('idle');
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectEnabled = false;

  readonly ordersUpdated$: Observable<BackofficeOrderEvent> = this.ordersUpdatedSubject.asObservable();
  readonly connectionLost$: Observable<void> = this.connectionLostSubject.asObservable();
  readonly connectionRestored$: Observable<void> = this.connectionRestoredSubject.asObservable();
  readonly connectionState$: Observable<BackofficeEventConnectionState> = this.connectionStateSubject.asObservable();

  start(): void {
    this.reconnectEnabled = true;
    if (this.eventSource || this.reconnectTimer) {
      return;
    }

    this.openStream();
  }

  stop(): void {
    this.reconnectEnabled = false;
    this.closeStream();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connectionStateSubject.next('idle');
  }

  currentState(): BackofficeEventConnectionState {
    return this.connectionStateSubject.value;
  }

  private openStream(): void {
    if (this.eventSource || !this.reconnectEnabled) {
      return;
    }

    this.connectionStateSubject.next('connecting');
    const eventSource = this.restaurantOrderService.connectToStream();
    if (!eventSource) {
      this.connectionStateSubject.next('closed');
      this.scheduleReconnect();
      return;
    }

    eventSource.addEventListener('open', () => {
      this.connectionStateSubject.next('open');
      this.connectionRestoredSubject.next();
    });

    eventSource.addEventListener('orders-updated', event => {
      this.ordersUpdatedSubject.next({
        rawEvent: event,
        payload: this.parseOrderEvent(event)
      });
    });

    eventSource.addEventListener('error', () => {
      this.closeStream();
      this.connectionStateSubject.next('closed');
      this.connectionLostSubject.next();
      this.scheduleReconnect();
    });

    this.eventSource = eventSource;
  }

  private closeStream(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private scheduleReconnect(): void {
    if (!this.reconnectEnabled || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openStream();
    }, 3000);
  }

  private parseOrderEvent(event: Event): BackofficeOrderEventPayload | null {
    const data = (event as MessageEvent<string>).data;
    if (!data || typeof data !== 'string') {
      return null;
    }

    try {
      return JSON.parse(data) as BackofficeOrderEventPayload;
    } catch {
      return null;
    }
  }
}
