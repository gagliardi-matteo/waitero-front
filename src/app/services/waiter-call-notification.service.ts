import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WaiterCallNotificationService {
  private readonly pendingCalls = signal<Record<string, number>>({});

  markWaiterCall(restaurantId: number, tableId: number): void {
    const key = this.buildKey(restaurantId, tableId);
    this.pendingCalls.update(current => ({
      ...current,
      [key]: Date.now()
    }));
  }

  clearWaiterCall(restaurantId: number, tableId: number): void {
    const key = this.buildKey(restaurantId, tableId);
    this.pendingCalls.update(current => {
      if (!(key in current)) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  clearAll(): void {
    this.pendingCalls.set({});
  }

  hasWaiterCall(restaurantId: number, tableId: number): boolean {
    const key = this.buildKey(restaurantId, tableId);
    return key in this.pendingCalls();
  }

  private buildKey(restaurantId: number, tableId: number): string {
    return `${restaurantId}:${tableId}`;
  }
}
