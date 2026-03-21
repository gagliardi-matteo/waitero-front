import { Component, Input, inject } from '@angular/core';
import { Piatto } from '../../models/piatto.model';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../services/order.service';
import { AuthContextService } from '../../services/auth-context.service';
import { CustomerOrderService } from '../../services/customer-order.service';
import { CustomerOrderItem } from '../../models/customer-order.model';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss']
})
export class OrderSummaryComponent {
  @Input() piatti: Piatto[] = [];

  isExpanded = false;
  isSubmitting = false;

  private orderState = inject(OrderService);
  private auth = inject(AuthContextService);
  private customerOrderService = inject(CustomerOrderService);

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
      items: draftPayload
    }).subscribe({
      next: order => {
        this.orderState.setConfirmedOrder(order);
        this.orderState.clearDraft();
        this.isSubmitting = false;
      },
      error: err => {
        console.error('Errore conferma ordine', err);
        this.isSubmitting = false;
      }
    });
  }

  aggiungi(piatto: Piatto) {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.customerOrderService.mutateDraft(token, restaurantId, tableId, piatto.id, 1)
      .subscribe({
        next: draft => this.orderState.setDraft(draft.items),
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
        next: draft => this.orderState.setDraft(draft.items),
        error: err => console.error('Errore aggiornamento bozza', err)
      });
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
}
