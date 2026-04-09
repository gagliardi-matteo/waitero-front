import { Injectable } from '@angular/core';
import { Piatto } from '../models/piatto.model';
import { CustomerDraftItem, CustomerOrder, CustomerOrderItem } from '../models/customer-order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private draftCounts = new Map<number, number>();
  private catalog = new Map<number, Piatto>();
  private confirmedOrder: CustomerOrder | null = null;
  private draftAttribution = new Map<number, { source: string; sourceDishId?: number }>();
  private contextKey: string | null = null;

  syncContext(contextKey: string) {
    if (this.contextKey === contextKey) {
      return;
    }

    this.contextKey = contextKey;
    this.resetState();
  }

  setCatalog(piatti: Piatto[]) {
    this.catalog = new Map(piatti.map(piatto => [piatto.id, piatto]));
  }

  setDraft(items: CustomerDraftItem[]) {
    this.draftCounts.clear();
    for (const item of items) {
      if (item.quantity > 0) {
        this.draftCounts.set(item.dishId, item.quantity);
      }
    }
    for (const dishId of Array.from(this.draftAttribution.keys())) {
      if (!this.draftCounts.has(dishId)) {
        this.draftAttribution.delete(dishId);
      }
    }
  }

  getDraftPayload(): Array<{ dishId: number; quantity: number; source?: string; sourceDishId?: number }> {
    return Array.from(this.draftCounts.entries())
      .filter(([, quantity]) => quantity > 0)
      .map(([dishId, quantity]) => ({ dishId, quantity, ...this.draftAttribution.get(dishId) }));
  }

  getOrdine(): Piatto[] {
    const result: Piatto[] = [];
    for (const [dishId, quantity] of this.draftCounts.entries()) {
      const piatto = this.catalog.get(dishId);
      if (!piatto) continue;
      for (let i = 0; i < quantity; i++) {
        result.push(piatto);
      }
    }
    return result;
  }


  markDraftAttribution(dishId: number, source: string, sourceDishId?: number) {
    if (!source.trim()) {
      return;
    }
    this.draftAttribution.set(dishId, { source: source.trim(), sourceDishId });
  }

  quantita(id: number): number {
    return this.draftCounts.get(id) ?? 0;
  }

  clearDraft() {
    this.draftCounts.clear();
    this.draftAttribution.clear();
  }

  setConfirmedOrder(order: CustomerOrder | null) {
    this.confirmedOrder = order;
  }

  getConfirmedOrder(): CustomerOrder | null {
    return this.confirmedOrder;
  }

  getConfirmedItems(): CustomerOrderItem[] {
    return this.confirmedOrder?.items ?? [];
  }

  getConfirmedTotal(): number {
    return this.confirmedOrder?.totale ?? 0;
  }

  resetState() {
    this.draftCounts.clear();
    this.draftAttribution.clear();
    this.catalog.clear();
    this.confirmedOrder = null;
  }
}
