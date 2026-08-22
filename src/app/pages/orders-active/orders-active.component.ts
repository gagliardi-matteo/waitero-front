import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderSummary } from '../../models/customer-order.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { BackofficeEventService, BackofficeOrderEvent } from '../../services/backoffice-event.service';

@Component({
  selector: 'app-orders-active',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf, NgFor, DatePipe, DecimalPipe, FormsModule, BrandLoaderComponent],
  templateUrl: './orders-active.component.html',
  styleUrl: '../orders/orders.component.scss'
})
export class OrdersActiveComponent implements OnInit, OnDestroy {
  orders: OrderSummary[] = [];
  isLoading = true;
  searchTerm = '';
  selectedStatus = 'ALL';
  selectedTable = 'ALL';

  private ordersService = inject(RestaurantOrderService);
  private backofficeEventService = inject(BackofficeEventService);
  private router = inject(Router);
  private ordersUpdatedSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.loadOrders();
    this.ordersUpdatedSubscription = this.backofficeEventService.ordersUpdated$
      .subscribe(event => this.handleBackofficeEvent(event));
  }

  ngOnDestroy(): void {
    this.ordersUpdatedSubscription?.unsubscribe();
  }

  get filteredOrders(): OrderSummary[] {
    return this.orders.filter(order => this.matchesFilters(order));
  }

  get availableStatuses(): string[] {
    return Array.from(new Set(this.orders.map(order => order.status))).sort((a, b) => a.localeCompare(b));
  }

  get availableTables(): number[] {
    return Array.from(new Set(this.orders.map(order => order.tableId))).sort((a, b) => a - b);
  }

  loadOrders(markLoading = true): void {
    if (markLoading) {
      this.isLoading = true;
    }

    this.ordersService.getActiveOrderSummaries().subscribe({
      next: orders => {
        this.orders = orders;
        this.isLoading = false;
      },
      error: err => {
        console.error('Errore caricamento ordini attivi', err);
        this.isLoading = false;
      }
    });
  }

  openOrder(order: OrderSummary): void {
    this.router.navigate(['/orders', order.id], { queryParams: { from: 'active' } });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'ALL';
    this.selectedTable = 'ALL';
  }

  trackOrder(index: number, order: OrderSummary): number {
    return order.id;
  }

  private matchesFilters(order: OrderSummary): boolean {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    const matchesSearch = normalizedSearch.length === 0
      || order.id.toString().includes(normalizedSearch)
      || order.tableId.toString().includes(normalizedSearch)
      || order.status.toLowerCase().includes(normalizedSearch);

    const matchesStatus = this.selectedStatus === 'ALL' || order.status === this.selectedStatus;
    const matchesTable = this.selectedTable === 'ALL' || order.tableId === Number(this.selectedTable);
    return matchesSearch && matchesStatus && matchesTable;
  }

  private handleBackofficeEvent(event: BackofficeOrderEvent): void {
    const payload = event.payload;
    if (!payload?.type) {
      this.loadOrders(false);
      return;
    }

    if (payload.type === 'WAITER_CALLED' || payload.type === 'SUSPICIOUS_TABLE_ACCESS' || payload.type === 'ORDER_REPRINT_REQUESTED') {
      return;
    }

    if (payload.type === 'ORDER_DELETED' && payload.orderId) {
      this.removeOrder(payload.orderId);
      return;
    }

    if (this.isOrderMutation(payload.type) && payload.orderId) {
      if (payload.status && !this.isActiveStatus(payload.status)) {
        this.removeOrder(payload.orderId);
        return;
      }

      this.refreshOrder(payload.orderId);
      return;
    }

    this.loadOrders(false);
  }

  private refreshOrder(orderId: number): void {
    this.ordersService.getOrderById(orderId).subscribe({
      next: order => {
        if (this.isActiveStatus(order.status)) {
          this.upsertOrder({
            id: order.id,
            tableId: order.tableId,
            status: order.status,
            paidAt: order.paidAt,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            totale: order.totale,
            itemCount: order.items.reduce((sum, item) => sum + item.quantita, 0),
            locationUnverified: order.locationUnverified
          });
          return;
        }

        this.removeOrder(order.id);
      },
      error: err => {
        console.error('Errore aggiornamento ordine attivo', err);
        this.loadOrders(false);
      }
    });
  }

  private upsertOrder(order: OrderSummary): void {
    const existingIndex = this.orders.findIndex(existing => existing.id === order.id);
    if (existingIndex === -1) {
      this.orders = [order, ...this.orders].sort((left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
      return;
    }

    this.orders = this.orders.map(existing => existing.id === order.id ? order : existing);
  }

  private removeOrder(orderId: number): void {
    this.orders = this.orders.filter(order => order.id !== orderId);
  }

  private isOrderMutation(type: string): boolean {
    return type === 'ORDER_UPDATED' || type === 'ORDER_CREATED' || type === 'ORDER_PAYMENT_UPDATED';
  }

  private isActiveStatus(status: string): boolean {
    return status === 'APERTO' || status === 'PARZIALMENTE_PAGATO';
  }
}


