import { Component, DoCheck, OnDestroy, OnInit, inject } from '@angular/core';
import { Piatto } from '../../models/piatto.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService, DraftLineItem } from '../../services/order.service';
import { AuthContextService } from '../../services/auth-context.service';
import { CustomerOrderService } from '../../services/customer-order.service';
import { CustomerOrderItem } from '../../models/customer-order.model';
import { TrackingService } from '../../services/tracking.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss']
})
export class OrderSummaryComponent implements OnInit, DoCheck, OnDestroy {
  isExpanded = false;
  isSubmitting = false;
  isCallingWaiter = false;
  noteCucina = '';
  cartUpsellSuggestions: Piatto[] = [];
  submitConfirmationMessage = '';
  submitErrorMessage = '';
  waiterCallConfirmationMessage = '';

  private orderState = inject(OrderService);
  private auth = inject(AuthContextService);
  private customerOrderService = inject(CustomerOrderService);
  private trackingService = inject(TrackingService);
  private router = inject(Router);
  private lastCartSignature = '';
  private lastUpsellRequestSignature = '';
  private upsellRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private submitConfirmationTimer: ReturnType<typeof setTimeout> | null = null;
  private waiterCallConfirmationTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (this.submitConfirmationTimer) {
      clearTimeout(this.submitConfirmationTimer);
      this.submitConfirmationTimer = null;
    }
    if (this.waiterCallConfirmationTimer) {
      clearTimeout(this.waiterCallConfirmationTimer);
      this.waiterCallConfirmationTimer = null;
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

  get draftItems(): DraftLineItem[] {
    return this.orderState.getDraftLineItems();
  }

  get totalDraft(): number {
    return this.draftItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  }

  get totale(): number {
    return this.confirmedTotal + this.totalDraft;
  }

  get badgeCount(): number {
    const confirmedCount = this.confirmedItems.reduce((acc, item) => acc + item.quantita, 0);
    return confirmedCount + this.draftItems.reduce((acc, item) => acc + item.quantity, 0);
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

  get waiterButtonLabel(): string {
    if (this.isCallingWaiter) {
      return 'Avviso...';
    }
    if (this.waiterCallConfirmationMessage) {
      return 'Avvisato';
    }
    return 'Chiama cameriere';
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  callWaiter(event: Event): void {
    event.stopPropagation();

    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId || this.isCallingWaiter) {
      return;
    }

    this.isCallingWaiter = true;
    this.waiterCallConfirmationMessage = '';
    this.customerOrderService.callWaiter({ token, restaurantId, tableId }).subscribe({
      next: () => {
        this.isCallingWaiter = false;
        this.showWaiterCallConfirmation();
      },
      error: err => {
        console.error('Errore chiamata cameriere', err);
        this.isCallingWaiter = false;
      }
    });
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
    this.submitConfirmationMessage = '';
    this.submitErrorMessage = '';
    this.customerOrderService.submitOrder({
      token,
      restaurantId,
      tableId,
      noteCucina: this.normalizedKitchenNote,
      sessionId: this.trackingService.sessionId,
      items: draftPayload
    }).subscribe({
      next: order => {
        this.customerOrderService.getCurrentState(token, restaurantId, tableId, false).subscribe({
          next: state => {
            const confirmedOrder = state.currentOrder;
            if (confirmedOrder && confirmedOrder.id === order.id && confirmedOrder.items.length > 0) {
              this.orderState.setConfirmedOrder(confirmedOrder);
              this.orderState.clearDraft();
              this.noteCucina = '';
              this.isSubmitting = false;
              this.showSubmitConfirmation();
              return;
            }

            console.error('Ordine non verificato dopo la conferma', { submittedOrder: order, state });
            this.isSubmitting = false;
            this.submitErrorMessage = 'Ordine non confermato. Riprova tra pochi secondi.';
          },
          error: err => {
            console.error('Errore verifica ordine dopo conferma', err);
            this.isSubmitting = false;
            this.submitErrorMessage = 'Ordine non verificato. Riprova tra pochi secondi.';
          }
        });
      },
      error: err => {
        console.error('Errore conferma ordine', err);
        this.isSubmitting = false;
        this.submitErrorMessage = err.error?.message ?? "Impossibile confermare l'ordine.";
      }
    });
  }

  aggiungi(item: DraftLineItem) {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.customerOrderService.mutateDraftOptimistically(token, restaurantId, tableId, item.dishId, 1, item.portionKey ?? undefined)
      .subscribe({
        next: () => {
          this.trackingService.trackEvent('add_to_cart', {
            dishId: item.dishId,
            metadata: {
              page: 'order-summary',
              quantity: this.quantita(item),
              portionKey: item.portionKey ?? null
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  rimuovi(item: DraftLineItem) {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.customerOrderService.mutateDraftOptimistically(token, restaurantId, tableId, item.dishId, -1, item.portionKey ?? undefined)
      .subscribe({
        next: () => {
          this.trackingService.trackEvent('remove_from_cart', {
            dishId: item.dishId,
            metadata: {
              page: 'order-summary',
              quantity: this.quantita(item),
              portionKey: item.portionKey ?? null
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  aggiungiUpsell(piatto: Piatto, event: Event): void {
    event.stopPropagation();
    if ((piatto.porzioni?.length ?? 0) > 0) {
      void this.router.navigate(['/menu/piatto', piatto.id]);
      return;
    }

    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.orderState.markDraftAttribution(piatto.id, null, 'cart_upsell');
    this.customerOrderService.mutateDraftOptimistically(token, restaurantId, tableId, piatto.id, 1)
      .subscribe({
        next: () => {},
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  quantita(item: DraftLineItem): number {
    return this.orderState.quantita(item.dishId, item.portionKey);
  }

  trackConfirmedItem(index: number, item: CustomerOrderItem): number {
    return item.id;
  }

  trackDraftItem(index: number, item: DraftLineItem): string {
    return item.lineKey;
  }

  formatItemLabel(nome: string, portionLabel?: string | null): string {
    if (!portionLabel || portionLabel === 'Standard') {
      return nome;
    }
    return `${nome} · ${portionLabel}`;
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
      ...this.draftItems.map(item => item.dishId),
      ...this.confirmedItems.map(item => item.dishId)
    ]));
  }

  private buildCartSignature(): string {
    const confirmedSignature = this.confirmedItems
      .map(item => `${item.dishId}:${item.portionKey ?? 'default'}:${item.quantita}`)
      .sort()
      .join('|');
    const draftSignature = this.draftItems
      .map(item => `${item.lineKey}:${item.quantity}`)
      .sort()
      .join('|');
    return `${confirmedSignature}#${draftSignature}`;
  }

  private showSubmitConfirmation(): void {
    this.submitConfirmationMessage = 'Ordine inviato con successo alla cucina.';
    if (this.submitConfirmationTimer) {
      clearTimeout(this.submitConfirmationTimer);
    }
    this.submitConfirmationTimer = setTimeout(() => {
      this.submitConfirmationMessage = '';
      this.submitConfirmationTimer = null;
    }, 5000);
  }

  private showWaiterCallConfirmation(): void {
    this.waiterCallConfirmationMessage = 'Cameriere avvisato.';
    if (this.waiterCallConfirmationTimer) {
      clearTimeout(this.waiterCallConfirmationTimer);
    }
    this.waiterCallConfirmationTimer = setTimeout(() => {
      this.waiterCallConfirmationMessage = '';
      this.waiterCallConfirmationTimer = null;
    }, 5000);
  }
}
