import { Injectable } from '@angular/core';
import { Piatto } from '../models/piatto.model';
import { CustomerDraftItem, CustomerOrder, CustomerOrderItem } from '../models/customer-order.model';

export interface DraftLineItem {
  lineKey: string;
  dishId: number;
  nome: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  portionKey?: string | null;
  portionLabel?: string | null;
}

interface DraftLineState {
  lineKey: string;
  dishId: number;
  quantity: number;
  portionKey?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private draftLines = new Map<string, DraftLineState>();
  private catalog = new Map<number, Piatto>();
  private confirmedOrder: CustomerOrder | null = null;
  private draftAttribution = new Map<string, { source: string; sourceDishId?: number }>();
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
    this.draftLines.clear();
    for (const item of items) {
      if (item.quantity > 0) {
        const lineKey = item.lineKey || this.buildLineKey(item.dishId, item.portionKey);
        this.draftLines.set(lineKey, {
          lineKey,
          dishId: item.dishId,
          quantity: item.quantity,
          portionKey: item.portionKey ?? null
        });
      }
    }
    for (const lineKey of Array.from(this.draftAttribution.keys())) {
      if (!this.draftLines.has(lineKey)) {
        this.draftAttribution.delete(lineKey);
      }
    }
  }

  getDraftPayload(): Array<{ dishId: number; quantity: number; portionKey?: string; source?: string; sourceDishId?: number }> {
    return Array.from(this.draftLines.values())
      .filter(item => item.quantity > 0)
      .map(item => ({
        dishId: item.dishId,
        quantity: item.quantity,
        portionKey: item.portionKey ?? undefined,
        ...this.draftAttribution.get(item.lineKey)
      }));
  }

  getDraftSnapshot(): CustomerDraftItem[] {
    return Array.from(this.draftLines.values())
      .filter(item => item.quantity > 0)
      .map(item => ({
        lineKey: item.lineKey,
        dishId: item.dishId,
        portionKey: item.portionKey ?? null,
        quantity: item.quantity
      }));
  }

  getDraftLineItems(): DraftLineItem[] {
    const result: DraftLineItem[] = [];
    for (const line of this.draftLines.values()) {
      const piatto = this.catalog.get(line.dishId);
      if (!piatto) {
        continue;
      }

      const portion = this.resolvePortion(piatto, line.portionKey);
      result.push({
        lineKey: line.lineKey,
        dishId: line.dishId,
        nome: piatto.nome,
        imageUrl: piatto.imageUrl,
        quantity: line.quantity,
        unitPrice: portion.price,
        portionKey: portion.key,
        portionLabel: portion.label
      });
    }
    return result.sort((left, right) => left.nome.localeCompare(right.nome) || left.lineKey.localeCompare(right.lineKey));
  }

  markDraftAttribution(dishId: number, portionKey: string | null | undefined, source: string, sourceDishId?: number) {
    const trimmedSource = source.trim();
    if (!trimmedSource) {
      return;
    }
    this.draftAttribution.set(this.buildLineKey(dishId, portionKey), { source: trimmedSource, sourceDishId });
  }

  quantita(dishId: number, portionKey?: string | null): number {
    return this.draftLines.get(this.buildLineKey(dishId, portionKey))?.quantity ?? 0;
  }

  applyDraftDelta(dishId: number, delta: number, portionKey?: string | null): boolean {
    if (!Number.isFinite(delta) || delta === 0) {
      return false;
    }

    const lineKey = this.buildLineKey(dishId, portionKey);
    const existing = this.draftLines.get(lineKey);
    const currentQuantity = existing?.quantity ?? 0;
    const nextQuantity = Math.max(0, currentQuantity + delta);

    if (nextQuantity === currentQuantity) {
      return false;
    }

    if (nextQuantity <= 0) {
      this.draftLines.delete(lineKey);
      this.draftAttribution.delete(lineKey);
      return true;
    }

    this.draftLines.set(lineKey, {
      lineKey,
      dishId,
      quantity: nextQuantity,
      portionKey: portionKey ?? null
    });
    return true;
  }

  totalQuantitaPerDish(dishId: number): number {
    let total = 0;
    for (const line of this.draftLines.values()) {
      if (line.dishId === dishId) {
        total += line.quantity;
      }
    }
    return total;
  }

  totalDraftQuantity(): number {
    let total = 0;
    for (const line of this.draftLines.values()) {
      total += line.quantity;
    }
    return total;
  }

  clearDraft() {
    this.draftLines.clear();
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
    this.draftLines.clear();
    this.draftAttribution.clear();
    this.catalog.clear();
    this.confirmedOrder = null;
  }

  private buildLineKey(dishId: number, portionKey?: string | null): string {
    const normalizedPortionKey = portionKey && portionKey.trim().length > 0 ? portionKey.trim() : 'default';
    return `${dishId}::${normalizedPortionKey}`;
  }

  private resolvePortion(piatto: Piatto, portionKey?: string | null): { key: string; label: string; price: number } {
    const configured = piatto.porzioni ?? [];
    if (configured.length === 0) {
      return {
        key: 'default',
        label: 'Standard',
        price: piatto.prezzo
      };
    }

    if (portionKey) {
      const matched = configured.find(item => item.key === portionKey);
      if (matched) {
        return matched;
      }
    }

    return configured[0];
  }
}
