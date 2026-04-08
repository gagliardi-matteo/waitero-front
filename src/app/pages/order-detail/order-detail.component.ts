import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CustomerOrder, CustomerOrderItem } from '../../models/customer-order.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';

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
  partialAmount: number | null = null;
  participantName = '';
  selectedQuantities: Record<number, number> = {};

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ordersService = inject(RestaurantOrderService);
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
}


