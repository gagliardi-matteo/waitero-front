import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerOrder } from '../../models/customer-order.model';
import { RestaurantTable } from '../../models/table.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { TableService } from '../../services/table.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';

interface TableDashboardCard {
  table: RestaurantTable;
  activeOrder: CustomerOrder | null;
  state: 'FREE' | 'OPEN' | 'PARTIAL' | 'INACTIVE';
  total: number;
  itemCount: number;
  updatedAt: string;
}

type TableDashboardFilter = 'ALL' | 'OPEN' | 'PARTIAL' | 'FREE' | 'INACTIVE';

@Component({
  selector: 'app-tables-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf, NgFor, DecimalPipe, DatePipe, BrandLoaderComponent],
  templateUrl: './tables-dashboard.component.html',
  styleUrl: './tables-dashboard.component.scss'
})
export class TablesDashboardComponent implements OnInit, OnDestroy {
  cards: TableDashboardCard[] = [];
  loading = true;
  errorMessage = '';
  selectedFilter: TableDashboardFilter = 'ALL';

  readonly filters: { value: TableDashboardFilter; label: string }[] = [
    { value: 'ALL', label: 'Tutti' },
    { value: 'OPEN', label: 'Aperti' },
    { value: 'PARTIAL', label: 'Parziali' },
    { value: 'FREE', label: 'Liberi' },
    { value: 'INACTIVE', label: 'Disattivi' }
  ];

  private ordersService = inject(RestaurantOrderService);
  private tableService = inject(TableService);
  private router = inject(Router);
  private eventSource: EventSource | null = null;

  ngOnInit(): void {
    this.loadDashboard();
    this.eventSource = this.ordersService.connectToStream();
    this.eventSource?.addEventListener('orders-updated', () => this.loadDashboard(false));
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  get filteredCards(): TableDashboardCard[] {
    if (this.selectedFilter === 'ALL') {
      return this.cards;
    }
    return this.cards.filter(card => card.state === this.selectedFilter);
  }

  get occupiedCount(): number {
    return this.countBy('OPEN') + this.countBy('PARTIAL');
  }

  get activeOrdersCount(): number {
    return this.cards.filter(card => !!card.activeOrder).length;
  }

  get totalRevenue(): number {
    return this.cards.reduce((sum, card) => sum + card.total, 0);
  }

  get averageTicket(): number {
    return this.activeOrdersCount === 0 ? 0 : this.totalRevenue / this.activeOrdersCount;
  }

  countBy(filter: TableDashboardFilter): number {
    if (filter === 'ALL') {
      return this.cards.length;
    }
    return this.cards.filter(card => card.state === filter).length;
  }

  loadDashboard(markLoading = true): void {
    if (markLoading) {
      this.loading = true;
    }
    this.errorMessage = '';

    forkJoin({
      tables: this.tableService.getTables(),
      activeOrders: this.ordersService.getActiveOrders()
    }).subscribe({
      next: ({ tables, activeOrders }) => {
        this.cards = this.buildCards(tables, activeOrders);
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento dashboard tavoli', err);
        this.errorMessage = 'Impossibile caricare la dashboard tavoli.';
        this.loading = false;
      }
    });
  }

  openOrder(card: TableDashboardCard): void {
    if (!card.activeOrder) {
      return;
    }
    this.router.navigate(['/orders', card.activeOrder.id]);
  }

  statusLabel(card: TableDashboardCard): string {
    switch (card.state) {
      case 'OPEN':
        return 'Ordine aperto';
      case 'PARTIAL':
        return 'Parzialmente pagato';
      case 'INACTIVE':
        return 'Disattivo';
      default:
        return 'Libero';
    }
  }

  statusClass(card: TableDashboardCard): string {
    switch (card.state) {
      case 'OPEN':
        return 'open';
      case 'PARTIAL':
        return 'partial';
      case 'INACTIVE':
        return 'inactive';
      default:
        return 'free';
    }
  }

  trackByTable(index: number, card: TableDashboardCard): number {
    return card.table.id;
  }

  private buildCards(tables: RestaurantTable[], activeOrders: CustomerOrder[]): TableDashboardCard[] {
    const activeOrderByTableId = new Map<number, CustomerOrder>();
    for (const order of activeOrders) {
      const existing = activeOrderByTableId.get(order.tableId);
      if (!existing || new Date(order.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        activeOrderByTableId.set(order.tableId, order);
      }
    }

    return [...tables]
      .sort((a, b) => a.numero - b.numero)
      .map(table => {
        const activeOrder = activeOrderByTableId.get(table.numero) ?? null;
        return {
          table,
          activeOrder,
          state: this.resolveState(table, activeOrder),
          total: activeOrder?.totale ?? 0,
          itemCount: activeOrder?.items.reduce((sum, item) => sum + item.quantita, 0) ?? 0,
          updatedAt: activeOrder?.updatedAt ?? table.updatedAt
        } satisfies TableDashboardCard;
      });
  }

  private resolveState(table: RestaurantTable, activeOrder: CustomerOrder | null): TableDashboardCard['state'] {
    if (!table.attivo) {
      return 'INACTIVE';
    }
    if (!activeOrder) {
      return 'FREE';
    }
    return activeOrder.status === 'PARZIALMENTE_PAGATO' ? 'PARTIAL' : 'OPEN';
  }
}


