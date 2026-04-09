import { Component, DoCheck, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { Piatto } from '../../models/piatto.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { AuthContextService } from '../../services/auth-context.service';
import { CustomerOrderService } from '../../services/customer-order.service';
import { CustomerOrderItem } from '../../models/customer-order.model';
import { TrackingService } from '../../services/tracking.service';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss']
})
export class OrderSummaryComponent implements OnInit, DoCheck, OnDestroy {
  @Input() piatti: Piatto[] = [];

  isExpanded = false;
  isSubmitting = false;
  noteCucina = '';
  cartUpsellSuggestions: Piatto[] = [];

  private orderState = inject(OrderService);
  private auth = inject(AuthContextService);
  private customerOrderService = inject(CustomerOrderService);
  private trackingService = inject(TrackingService);
  private lastCartSignature = '';
  private lastUpsellRequestSignature = '';
  private upsellRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.refreshCartUpsellSuggestions();
  }

  ngDoCheck(): void {
    const signature = this.buildCartSignature();
    if (signature !== this.lastCartSignature) {
      this.lastCartSignature = signature;
      this.scheduleCartUpsellRefresh();
    }
  }

  ngOnDestroy(): void {
    if (this.upsellRefreshTimer) {
      clearTimeout(this.upsellRefreshTimer);
      this.upsellRefreshTimer = null;
    }
  }

  get confirmedItems(): CustomerOrderItem[] {
    return this.orderState.getConfirmedItems();
  }

  get hasConfirmedItems(): boolean {
    return this.confirmedItems.length > 0;
  }

  get confirmedTotal(): number {
    return this.orderState.getConfirmedTotal();
  }

  get draftItems(): Piatto[] {
    return this.piatti;
  }

  get totalDraft(): number {
    return this.draftItems.reduce((acc, piatto) => acc + piatto.prezzo, 0);
  }

  get totale(): number {
    return this.confirmedTotal + this.totalDraft;
  }

  get badgeCount(): number {
    const confirmedCount = this.confirmedItems.reduce((acc, item) => acc + item.quantita, 0);
    return confirmedCount + this.draftItems.length;
  }

  get cartUpsellMessage(): string {
    if (this.cartUpsellSuggestions.length === 0) {
      return '';
    }
    const firstCategory = (this.cartUpsellSuggestions[0].categoria ?? '').toUpperCase();
    if (firstCategory === 'BEVANDA') {
      return 'Ti manca solo una bevanda';
    }
    if (firstCategory === 'CONTORNO') {
      return 'Completa il tuo ordine con un contorno';
    }
    if (firstCategory === 'DOLCE') {
      return 'Chiudi il pasto con un dolce';
    }
    return 'Potrebbe piacerti anche';
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  confermaOrdine(event: Event) {
    event.stopPropagation();

    const draftPayload = this.orderState.getDraftPayload();
    if (this.isSubmitting || draftPayload.length === 0) {
      return;
    }

    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;

    if (!token || !restaurantId || !tableId) {
      return;
    }

    this.isSubmitting = true;
    this.customerOrderService.submitOrder({
      token,
      restaurantId,
      tableId,
      noteCucina: this.normalizedKitchenNote,
      sessionId: this.trackingService.sessionId,
      items: draftPayload
    }).subscribe({
      next: order => {
        this.orderState.setConfirmedOrder(order);
        this.orderState.clearDraft();
        this.noteCucina = '';
        this.isSubmitting = false;
      },
      error: err => {
        console.error('Errore conferma ordine', err);
        this.isSubmitting = false;
      }
    });
  }

  aggiungi(piatto: Piatto, attribution?: { source: string; sourceDishId?: number }) {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.customerOrderService.mutateDraft(token, restaurantId, tableId, piatto.id, 1)
      .subscribe({
        next: draft => {
          this.orderState.setDraft(draft.items);
          if (attribution) {
            this.orderState.markDraftAttribution(piatto.id, attribution.source, attribution.sourceDishId);
          }
          this.trackingService.trackEvent('add_to_cart', {
            dishId: piatto.id,
            metadata: {
              page: 'order-summary',
              quantity: this.quantita(piatto.id)
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  rimuovi(piatto: Piatto) {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.customerOrderService.mutateDraft(token, restaurantId, tableId, piatto.id, -1)
      .subscribe({
        next: draft => {
          this.orderState.setDraft(draft.items);
          this.trackingService.trackEvent('remove_from_cart', {
            dishId: piatto.id,
            metadata: {
              page: 'order-summary',
              quantity: this.quantita(piatto.id)
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  aggiungiUpsell(piatto: Piatto, event: Event): void {
    event.stopPropagation();
    this.aggiungi(piatto, { source: 'cart_upsell' });
  }

  quantita(id: number): number {
    return this.orderState.quantita(id);
  }

  trackConfirmedItem(index: number, item: CustomerOrderItem): number {
    return item.id;
  }

  trackDraftItem(index: number, item: Piatto): number {
    return item.id;
  }

  get draftGroupedItems(): Piatto[] {
    const mappa = new Map<number, Piatto>();
    this.draftItems.forEach(p => {
      if (!mappa.has(p.id)) {
        mappa.set(p.id, p);
      }
    });
    return Array.from(mappa.values());
  }

  private get normalizedKitchenNote(): string | undefined {
    const normalized = this.noteCucina.trim();
    if (!normalized) {
      return undefined;
    }
    return normalized.length > 1000 ? normalized.slice(0, 1000) : normalized;
  }

  private refreshCartUpsellSuggestions(): void {
    const restaurantId = this.auth.restaurantIdValue;
    const dishIds = this.getCartDishIds();
    if (!restaurantId || dishIds.length === 0) {
      this.cartUpsellSuggestions = [];
      this.lastUpsellRequestSignature = '';
      return;
    }

    const requestSignature = `${restaurantId}:${dishIds.sort((left, right) => left - right).join(',')}`;
    if (requestSignature === this.lastUpsellRequestSignature) {
      return;
    }
    this.lastUpsellRequestSignature = requestSignature;

    this.customerOrderService.getCartUpsellSuggestions(dishIds, restaurantId, this.trackingService.sessionId)
      .subscribe({
        next: suggestions => {
          const cartDishIdSet = new Set<number>(dishIds);
          this.cartUpsellSuggestions = suggestions
            .filter(suggestion => !cartDishIdSet.has(suggestion.id))
            .slice(0, 2);
        },
        error: err => {
          console.error('Errore caricamento upsell carrello', err);
          this.cartUpsellSuggestions = [];
        }
      });
  }

  private scheduleCartUpsellRefresh(): void {
    if (this.upsellRefreshTimer) {
      clearTimeout(this.upsellRefreshTimer);
    }

    this.upsellRefreshTimer = setTimeout(() => {
      this.upsellRefreshTimer = null;
      this.refreshCartUpsellSuggestions();
    }, 120);
  }

  private getCartDishIds(): number[] {
    return Array.from(new Set<number>([
      ...this.draftGroupedItems.map(item => item.id),
      ...this.confirmedItems.map(item => item.dishId)
    ]));
  }

  private buildCartSignature(): string {
    const confirmedSignature = this.confirmedItems
      .map(item => `${item.dishId}:${item.quantita}`)
      .sort()
      .join('|');
    const draftSignature = this.draftGroupedItems
      .map(item => `${item.id}:${this.quantita(item.id)}`)
      .sort()
      .join('|');
    return `${confirmedSignature}#${draftSignature}`;
  }
}
