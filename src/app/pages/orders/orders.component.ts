import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CustomerOrder } from '../../models/customer-order.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';

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

    this.ordersService.getActiveOrders().subscribe({
      next: orders => {
        this.activeOrders = orders;
        this.ordersService.getHistoryOrders().subscribe({
          next: history => {
            this.historyOrders = history;
            this.isLoading = false;
          },
          error: err => {
            console.error('Errore caricamento storico ordini', err);
            this.isLoading = false;
          }
        });
      },
      error: err => {
        console.error('Errore caricamento ordini attivi', err);
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
}
