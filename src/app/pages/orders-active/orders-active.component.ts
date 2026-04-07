import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { OrderSummary } from '../../models/customer-order.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';

@Component({
  selector: 'app-orders-active',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf, NgFor, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './orders-active.component.html',
  styleUrl: '../orders/orders.component.scss'
})
export class OrdersActiveComponent implements OnInit, OnDestroy {
  orders: OrderSummary[] = [];
  isLoading = true;
  searchTerm = '';
  selectedStatus = 'ALL';

  private ordersService = inject(RestaurantOrderService);
  private router = inject(Router);
  private eventSource: EventSource | null = null;

  ngOnInit(): void {
    this.loadOrders();
    this.eventSource = this.ordersService.connectToStream();
    this.eventSource?.addEventListener('orders-updated', () => this.loadOrders(false));
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  get filteredOrders(): OrderSummary[] {
    return this.orders.filter(order => this.matchesFilters(order));
  }

  get availableStatuses(): string[] {
    return Array.from(new Set(this.orders.map(order => order.status))).sort((a, b) => a.localeCompare(b));
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
    return matchesSearch && matchesStatus;
  }
}
