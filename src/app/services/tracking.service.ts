import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthContextService } from './auth-context.service';

export type TrackingEventType =
  | 'view_dish'
  | 'click_dish'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'order_submitted'
  | 'scroll'
  | 'time_spent';

interface TrackEventOptions {
  userId?: string;
  dishId?: number;
  metadata?: Record<string, unknown>;
  useBeacon?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private http = inject(HttpClient);
  private auth = inject(AuthContextService);

  trackEvent(eventType: TrackingEventType, options: TrackEventOptions = {}): void {
    if (typeof window === 'undefined') {
      return;
    }

    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!restaurantId || !tableId) {
      return;
    }

    const payload = {
      eventType,
      userId: options.userId,
      sessionId: this.getOrCreateSessionId(),
      restaurantId: Number(restaurantId),
      tableId: Number(tableId),
      dishId: options.dishId,
      metadata: options.metadata ?? {}
    };

    if (options.useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(`${environment.apiUrl}/events`, blob);
      return;
    }

    this.http.post(`${environment.apiUrl}/events`, payload).subscribe({
      error: err => console.error('Errore tracking evento', eventType, err)
    });
  }

  trackTimeSpent(startedAt: number, options: Omit<TrackEventOptions, 'useBeacon'> = {}): void {
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    this.trackEvent('time_spent', {
      ...options,
      metadata: {
        ...(options.metadata ?? {}),
        seconds
      },
      useBeacon: true
    });
  }

  private getOrCreateSessionId(): string {
    const existing = sessionStorage.getItem('waiteroTrackingSessionId');
    if (existing) {
      return existing;
    }

    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('waiteroTrackingSessionId', generated);
    return generated;
  }
}
