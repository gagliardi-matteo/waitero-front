import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CustomerOrder, CustomerOrderItem } from '../../models/customer-order.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { PrinterService } from '../../core/printer/printer.service';
import { PrintOrderItem } from '../../core/printer/printer.models';

const LOCATION_UNVERIFIED_WARNING = 'Posizione non verificata. Controllare la presenza al tavolo';

interface PrintedOrderSnapshot {
  orderId: number;
  fingerprint: string;
  items: PrintedOrderSnapshotItem[];
}

interface PrintedOrderSnapshotItem {
  key: string;
  quantity: number;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf, NgFor, DatePipe, DecimalPipe, FormsModule, BrandLoaderComponent],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  order: CustomerOrder | null = null;
  isLoading = true;
  isPaying = false;
  isReprinting = false;
  reprintMessage = '';
  reprintError = '';
  partialAmount: number | null = null;
  splitPeopleCount: number | null = null;
  participantName = '';
  selectedQuantities: Record<number, number> = {};

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ordersService = inject(RestaurantOrderService);
  private printerService = inject(PrinterService);
  private eventSource: EventSource | null = null;
  private orderId = 0;
  private returnTo: 'active' | 'history' = 'active';

  ngOnInit(): void {
    this.orderId = Number(this.route.snapshot.paramMap.get('id'));
    this.returnTo = this.route.snapshot.queryParamMap.get('from') === 'history' ? 'history' : 'active';
    if (!this.orderId) {
      this.navigateBack();
      return;
    }

    this.loadOrder();
    this.eventSource = this.ordersService.connectToStream();
    this.eventSource?.addEventListener('orders-updated', () => this.loadOrder(false));
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  loadOrder(markLoading = true): void {
    if (markLoading) {
      this.isLoading = true;
    }

    this.ordersService.getOrderById(this.orderId).subscribe({
      next: order => {
        this.order = order;
        this.isLoading = false;
        if (this.partialAmount === null && order.remainingAmount > 0) {
          this.partialAmount = Number(order.remainingAmount.toFixed(2));
        }
        this.syncSelectionWithOrder(order);
      },
      error: err => {
        console.error('Errore caricamento dettaglio ordine', err);
        this.isLoading = false;
        this.navigateBack();
      }
    });
  }

  get itemCount(): number {
    return this.order?.items.reduce((acc, item) => acc + item.quantita, 0) ?? 0;
  }

  get isPaid(): boolean {
    return this.order?.status === 'PAGATO';
  }

  get selectedSplitTotal(): number {
    if (!this.order) return 0;
    return this.order.items.reduce((acc, item) => acc + (this.getSelectedQuantity(item) * item.prezzoUnitario), 0);
  }

  get hasSplitSelection(): boolean {
    if (!this.order) return false;
    return this.order.items.some(item => this.getSelectedQuantity(item) > 0);
  }

  get splitByPeopleAmount(): number {
    if (!this.order || !this.splitPeopleCount || this.splitPeopleCount <= 0) {
      return 0;
    }

    const totalCents = Math.round(this.order.remainingAmount * 100);
    const people = Math.max(1, Math.floor(this.splitPeopleCount));
    const shareCents = Math.ceil(totalCents / people);
    return shareCents / 100;
  }

  get splitByPeopleRemainderAmount(): number {
    if (!this.order || !this.splitPeopleCount || this.splitPeopleCount <= 0) {
      return 0;
    }

    const totalCents = Math.round(this.order.remainingAmount * 100);
    const people = Math.max(1, Math.floor(this.splitPeopleCount));
    const baseCents = Math.floor(totalCents / people);
    return baseCents / 100;
  }

  payFull(): void {
    if (!this.order) return;
    this.pay('FULL', { amount: Number(this.order.remainingAmount), participantName: this.normalizedParticipantName });
  }

  payPartial(mode: string): void {
    if (this.partialAmount == null) {
      return;
    }
    this.pay(mode, { amount: this.partialAmount, participantName: this.normalizedParticipantName });
  }

  applySplitByPeopleAmount(): void {
    const amount = this.splitByPeopleAmount;
    this.partialAmount = amount > 0 ? amount : null;
  }

  paySplitByItems(): void {
    if (!this.order || !this.hasSplitSelection) {
      return;
    }

    const allocations = this.order.items
      .map(item => ({ orderItemId: item.id, quantity: this.getSelectedQuantity(item) }))
      .filter(item => item.quantity > 0);

    this.pay('SPLIT_ITEMS', {
      participantName: this.normalizedParticipantName,
      allocations
    });
  }

  pay(mode: string, payload?: { amount?: number; participantName?: string; allocations?: Array<{ orderItemId: number; quantity: number }> }): void {
    if (!this.order || this.isPaid || this.isPaying) {
      return;
    }

    this.isPaying = true;
    this.ordersService.payOrder(this.order.id, mode, payload).subscribe({
      next: order => {
        this.order = order;
        this.partialAmount = order.remainingAmount > 0 ? Number(order.remainingAmount.toFixed(2)) : null;
        this.participantName = '';
        this.syncSelectionWithOrder(order);
        this.isPaying = false;
      },
      error: err => {
        console.error('Errore pagamento ordine', err);
        this.isPaying = false;
      }
    });
  }

  reprintOrder(): void {
    if (!this.order || this.isReprinting) {
      return;
    }

    this.isReprinting = true;
    this.reprintMessage = '';
    this.reprintError = '';
    const shouldPrintLocally = this.printerService.canPrintLocally();
    if (shouldPrintLocally) {
      this.markLocalReprintRequested(this.order.id);
    }

    this.ordersService.reprintOrder(this.order.id).subscribe({
      next: async () => {
        if (this.order && shouldPrintLocally) {
          const result = await this.printerService.printKitchenOrder(this.toPrintOrder(this.order));
          if (!result.success) {
            this.isReprinting = false;
            this.clearLocalReprintRequested(this.order.id);
            this.reprintError = result.error ?? 'Errore durante la stampa locale sul POS.';
            return;
          }
          this.storePrintedOrderSnapshot(this.buildPrintedOrderSnapshot(this.order));
        }

        this.isReprinting = false;
        this.reprintMessage = 'Ristampa ordine inviata.';
      },
      error: err => {
        console.error('Errore ristampa ordine', err);
        this.isReprinting = false;
        this.clearLocalReprintRequested(this.order?.id ?? 0);
        this.reprintError = err.error?.message ?? "Impossibile ristampare l'ordine.";
      }
    });
  }

  getSelectedQuantity(item: CustomerOrderItem): number {
    return this.selectedQuantities[item.id] ?? 0;
  }

  setSelectedQuantity(item: CustomerOrderItem, rawValue: string | number): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.selectedQuantities[item.id] = 0;
      return;
    }

    const normalized = Math.min(Math.floor(parsed), item.remainingQuantity);
    this.selectedQuantities[item.id] = normalized;
  }

  incrementSelectedQuantity(item: CustomerOrderItem): void {
    const current = this.getSelectedQuantity(item);
    if (current >= item.remainingQuantity) {
      return;
    }
    this.selectedQuantities[item.id] = current + 1;
  }

  decrementSelectedQuantity(item: CustomerOrderItem): void {
    const current = this.getSelectedQuantity(item);
    if (current <= 0) {
      return;
    }
    this.selectedQuantities[item.id] = current - 1;
  }

  goBack() {
    this.navigateBack();
  }

  private navigateBack(): void {
    this.router.navigate([this.returnTo === 'history' ? '/orders-history' : '/orders']);
  }

  private syncSelectionWithOrder(order: CustomerOrder): void {
    const next: Record<number, number> = {};
    for (const item of order.items) {
      next[item.id] = 0;
    }
    this.selectedQuantities = next;
  }

  private get normalizedParticipantName(): string | undefined {
    const value = this.participantName.trim();
    return value.length > 0 ? value : undefined;
  }

  private toPrintOrder(order: CustomerOrder) {
    const note = order.noteCucina?.trim();
    const items = order.items.map((item, index): PrintOrderItem => ({
      quantity: item.quantita,
      name: this.formatPrintItemName(item.nome, item.portionLabel),
      notes: index === 0 ? note : undefined
    }));

    return {
      orderId: order.id,
      tableName: `Tavolo ${order.tableId}`,
      createdAt: order.createdAt,
      warningMessage: order.locationUnverified ? LOCATION_UNVERIFIED_WARNING : undefined,
      locationUnverified: Boolean(order.locationUnverified),
      items
    };
  }

  private formatPrintItemName(name: string, portionLabel?: string | null): string {
    if (!portionLabel || portionLabel === 'Standard') {
      return name;
    }
    return `${name} - ${portionLabel}`;
  }

  private buildPrintedOrderSnapshot(order: CustomerOrder): PrintedOrderSnapshot {
    const items = order.items
      .map(item => ({
        key: this.orderItemPrintKey(item),
        quantity: item.quantita
      }))
      .sort((left, right) => left.key.localeCompare(right.key));

    return {
      orderId: order.id,
      fingerprint: [
        order.id,
        order.locationUnverified ? 'location_unverified' : 'location_verified',
        order.noteCucina?.trim() ?? '',
        items.map(item => `${item.key}:${item.quantity}`).join('|')
      ].join('::'),
      items
    };
  }

  private orderItemPrintKey(item: CustomerOrderItem): string {
    return [
      item.dishId,
      item.portionKey ?? '',
      item.portionLabel ?? '',
      item.nome
    ].join('::');
  }

  private storePrintedOrderSnapshot(snapshot: PrintedOrderSnapshot): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const snapshots = this.loadPrintedOrderSnapshots()
      .filter(existing => existing.orderId !== snapshot.orderId);
    snapshots.push(snapshot);
    localStorage.setItem('waiteroPrintedOrderSnapshots', JSON.stringify(snapshots.slice(-200)));
  }

  private loadPrintedOrderSnapshots(): PrintedOrderSnapshot[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem('waiteroPrintedOrderSnapshots');
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as PrintedOrderSnapshot[];
      return parsed.filter(snapshot =>
        Number.isFinite(snapshot.orderId)
        && typeof snapshot.fingerprint === 'string'
        && Array.isArray(snapshot.items)
      );
    } catch {
      return [];
    }
  }

  private markLocalReprintRequested(orderId: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.localReprintRequestKey(orderId), String(Date.now()));
  }

  private clearLocalReprintRequested(orderId: number): void {
    if (typeof localStorage === 'undefined' || !orderId) {
      return;
    }
    localStorage.removeItem(this.localReprintRequestKey(orderId));
  }

  private localReprintRequestKey(orderId: number): string {
    return `waiteroLocalReprint:${orderId}`;
  }
}


