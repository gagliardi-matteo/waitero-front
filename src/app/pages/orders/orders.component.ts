import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { CustomerOrder } from '../../models/customer-order.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { BackofficeEventService, BackofficeOrderEvent } from '../../services/backoffice-event.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf, NgFor, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  activeOrders: CustomerOrder[] = [];
  historyOrders: CustomerOrder[] = [];
  isLoading = true;
  searchTerm = '';
  selectedStatus = 'ALL';

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

  get filteredActiveOrders(): CustomerOrder[] {
    return this.activeOrders.filter(order => this.matchesFilters(order));
  }

  get filteredHistoryOrders(): CustomerOrder[] {
    return this.historyOrders.filter(order => this.matchesFilters(order));
  }

  get availableStatuses(): string[] {
    return Array.from(new Set([...this.activeOrders, ...this.historyOrders].map(order => order.status)))
      .sort((a, b) => a.localeCompare(b));
  }

  loadOrders(markLoading = true): void {
    if (markLoading) {
      this.isLoading = true;
    }

    forkJoin({
      activeOrders: this.ordersService.getActiveOrders(),
      historyOrders: this.ordersService.getHistoryOrders()
    }).subscribe({
      next: ({ activeOrders, historyOrders }) => {
        this.activeOrders = activeOrders;
        this.historyOrders = historyOrders;
        this.isLoading = false;
      },
      error: err => {
        console.error('Errore caricamento ordini', err);
        this.isLoading = false;
      }
    });
  }

  getItemCount(order: CustomerOrder): number {
    return order.items.reduce((acc, item) => acc + item.quantita, 0);
  }

  openOrder(order: CustomerOrder) {
    this.router.navigate(['/orders', order.id]);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'ALL';
  }

  trackOrder(index: number, order: CustomerOrder): number {
    return order.id;
  }

  private matchesFilters(order: CustomerOrder): boolean {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    const matchesSearch = normalizedSearch.length === 0
      || order.id.toString().includes(normalizedSearch)
      || order.tableId.toString().includes(normalizedSearch)
      || order.status.toLowerCase().includes(normalizedSearch);

    const matchesStatus = this.selectedStatus === 'ALL' || order.status === this.selectedStatus;
    return matchesSearch && matchesStatus;
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
      this.refreshOrder(payload.orderId);
      return;
    }

    this.loadOrders(false);
  }

  private refreshOrder(orderId: number): void {
    this.ordersService.getOrderById(orderId).subscribe({
      next: order => this.upsertOrder(order),
      error: err => {
        console.error('Errore aggiornamento ordine', err);
        this.loadOrders(false);
      }
    });
  }

  private upsertOrder(order: CustomerOrder): void {
    this.removeOrder(order.id);
    if (this.isActiveStatus(order.status)) {
      this.activeOrders = [order, ...this.activeOrders].sort(this.sortByUpdatedAtDesc);
      return;
    }

    this.historyOrders = [order, ...this.historyOrders].sort(this.sortByUpdatedAtDesc);
  }

  private removeOrder(orderId: number): void {
    this.activeOrders = this.activeOrders.filter(order => order.id !== orderId);
    this.historyOrders = this.historyOrders.filter(order => order.id !== orderId);
  }

  private isOrderMutation(type: string): boolean {
    return type === 'ORDER_UPDATED' || type === 'ORDER_CREATED' || type === 'ORDER_PAYMENT_UPDATED';
  }

  private isActiveStatus(status: string): boolean {
    return status === 'APERTO' || status === 'PARZIALMENTE_PAGATO';
  }

  private sortByUpdatedAtDesc(left: CustomerOrder, right: CustomerOrder): number {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  }
}
