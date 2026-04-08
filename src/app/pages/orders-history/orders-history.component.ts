import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { OrderSummary } from '../../models/customer-order.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';

@Component({
  selector: 'app-orders-history',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf, NgFor, DatePipe, DecimalPipe, FormsModule, BrandLoaderComponent],
  templateUrl: './orders-history.component.html',
  styleUrl: '../orders/orders.component.scss'
})
export class OrdersHistoryComponent implements OnInit, OnDestroy {
  orders: OrderSummary[] = [];
  isLoading = true;
  searchTerm = '';
  selectedStatus = 'ALL';
  page = 0;
  readonly pageSize = 25;
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  hasPrevious = false;
  readonly statusOptions = ['ALL', 'APERTO', 'PARZIALMENTE_PAGATO', 'PAGATO', 'ANNULLATO'];

  private ordersService = inject(RestaurantOrderService);
  private router = inject(Router);
  private eventSource: EventSource | null = null;
  private searchChanges = new Subject<string>();

  ngOnInit(): void {
    this.loadOrders();
    this.eventSource = this.ordersService.connectToStream();
    this.eventSource?.addEventListener('orders-updated', () => this.loadOrders(false));
    this.searchChanges.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(() => {
      this.page = 0;
      this.loadOrders();
    });
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
    this.searchChanges.complete();
  }

  get pageLabel(): string {
    if (this.totalItems === 0) {
      return '0 risultati';
    }
    const start = (this.page * this.pageSize) + 1;
    const end = Math.min((this.page + 1) * this.pageSize, this.totalItems);
    return `${start}-${end} di ${this.totalItems}`;
  }

  loadOrders(markLoading = true): void {
    if (markLoading) {
      this.isLoading = true;
    }

    this.ordersService.getPagedOrderSummaries(this.page, this.pageSize, {
      q: this.searchTerm,
      status: this.selectedStatus
    }).subscribe({
      next: result => {
        this.orders = result.items;
        this.page = result.page;
        this.totalItems = result.totalItems;
        this.totalPages = result.totalPages;
        this.hasNext = result.hasNext;
        this.hasPrevious = result.hasPrevious;
        this.isLoading = false;
      },
      error: err => {
        console.error('Errore caricamento storico ordini', err);
        this.isLoading = false;
      }
    });
  }

  openOrder(order: OrderSummary): void {
    this.router.navigate(['/orders', order.id], { queryParams: { from: 'history' } });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchChanges.next(value);
  }

  onStatusChange(status: string): void {
    this.selectedStatus = status;
    this.page = 0;
    this.loadOrders();
  }

  previousPage(): void {
    if (!this.hasPrevious) {
      return;
    }
    this.page -= 1;
    this.loadOrders();
  }

  nextPage(): void {
    if (!this.hasNext) {
      return;
    }
    this.page += 1;
    this.loadOrders();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'ALL';
    this.page = 0;
    this.loadOrders();
  }

  trackOrder(index: number, order: OrderSummary): number {
    return order.id;
  }
}


