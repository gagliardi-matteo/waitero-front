import { Injectable, computed, signal } from '@angular/core';

export interface PendingWaiterCall {
  restaurantId: number;
  tableId: number;
  calledAt: number;
}

@Injectable({ providedIn: 'root' })
export class WaiterCallNotificationService {
  private readonly pendingCalls = signal<Record<string, number>>({});
  readonly pendingWaiterCalls = computed<PendingWaiterCall[]>(() =>
    Object.entries(this.pendingCalls())
      .map(([key, calledAt]) => {
        const [restaurantId, tableId] = key.split(':').map(Number);
        return { restaurantId, tableId, calledAt };
      })
      .filter(call => Number.isFinite(call.restaurantId) && Number.isFinite(call.tableId))
      .sort((left, right) => right.calledAt - left.calledAt)
  );

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

  clearWaiterCallCandidates(restaurantId: number, tableIds: number[]): void {
    const keys = new Set(tableIds.map(tableId => this.buildKey(restaurantId, tableId)));
    this.pendingCalls.update(current => {
      const next = { ...current };
      let changed = false;

      for (const key of keys) {
        if (key in next) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : current;
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
