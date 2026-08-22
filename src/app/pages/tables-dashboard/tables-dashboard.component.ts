import { CommonModule, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { CustomerOrder } from '../../models/customer-order.model';
import { RestaurantTable } from '../../models/table.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { TableService } from '../../services/table.service';
import { WaiterCallNotificationService } from '../../services/waiter-call-notification.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { BackofficeEventService, BackofficeOrderEvent } from '../../services/backoffice-event.service';

interface TableDashboardCard {
  table: RestaurantTable;
  activeOrder: CustomerOrder | null;
  state: 'FREE' | 'OPEN' | 'PARTIAL' | 'INACTIVE';
  total: number;
  itemCount: number;
  updatedAt: string;
  hasWaiterCall: boolean;
}

type TableDashboardFilter = 'ALL' | 'OPEN' | 'PARTIAL' | 'FREE' | 'INACTIVE';

@Component({
  selector: 'app-tables-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIf, NgFor, DecimalPipe, DatePipe, FormsModule, BrandLoaderComponent],
  templateUrl: './tables-dashboard.component.html',
  styleUrl: './tables-dashboard.component.scss'
})
export class TablesDashboardComponent implements OnInit, OnDestroy {
  cards: TableDashboardCard[] = [];
  loading = true;
  errorMessage = '';
  selectedFilter: TableDashboardFilter = 'ALL';
  selectedTable = 'ALL';
  waiterCallsExpanded = false;

  readonly filters: { value: TableDashboardFilter; label: string }[] = [
    { value: 'ALL', label: 'Tutti' },
    { value: 'OPEN', label: 'Aperti' },
    { value: 'PARTIAL', label: 'Parziali' },
    { value: 'FREE', label: 'Liberi' },
    { value: 'INACTIVE', label: 'Disattivi' }
  ];

  private ordersService = inject(RestaurantOrderService);
  private tableService = inject(TableService);
  private backofficeEventService = inject(BackofficeEventService);
  private waiterCallNotificationService = inject(WaiterCallNotificationService);
  private router = inject(Router);
  private ordersUpdatedSubscription: Subscription | null = null;
  private connectionStateSubscription: Subscription | null = null;
  private fallbackRefreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadDashboard();
    this.ordersUpdatedSubscription = this.backofficeEventService.ordersUpdated$
      .subscribe(event => this.handleBackofficeEvent(event));
    this.connectionStateSubscription = this.backofficeEventService.connectionState$
      .subscribe(state => {
        if (state === 'closed') {
          this.startFallbackRefresh();
          return;
        }

        if (state === 'open') {
          this.stopFallbackRefresh();
        }
      });
  }

  ngOnDestroy(): void {
    this.ordersUpdatedSubscription?.unsubscribe();
    this.connectionStateSubscription?.unsubscribe();
    this.stopFallbackRefresh();
  }

  get filteredCards(): TableDashboardCard[] {
    return this.cards.filter(card => this.matchesStatusFilter(card) && this.matchesTableFilter(card));
  }

  get availableTables(): number[] {
    return [...this.cards]
      .map(card => card.table.numero)
      .sort((left, right) => left - right);
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

  get waiterCallCards(): TableDashboardCard[] {
    const callKeys = new Set(
      this.waiterCallNotificationService.pendingWaiterCalls()
        .map(call => this.buildWaiterCallKey(call.restaurantId, call.tableId))
    );

    return this.cards.filter(card =>
      callKeys.has(this.buildWaiterCallKey(card.table.restaurantId, card.table.numero))
      || callKeys.has(this.buildWaiterCallKey(card.table.restaurantId, card.table.id))
    );
  }

  get waiterCallsCount(): number {
    return this.waiterCallCards.length;
  }

  get waiterCallsSummary(): string {
    const tableLabels = this.waiterCallCards
      .map(card => this.tableLabel(card))
      .slice(0, 3);

    if (tableLabels.length === 0) {
      return '';
    }

    const remainingCount = this.waiterCallsCount - tableLabels.length;
    return remainingCount > 0
      ? `${tableLabels.join(', ')} +${remainingCount}`
      : tableLabels.join(', ');
  }

  countBy(filter: TableDashboardFilter): number {
    if (filter === 'ALL') {
      return this.cards.filter(card => this.matchesTableFilter(card)).length;
    }
    return this.cards.filter(card => card.state === filter && this.matchesTableFilter(card)).length;
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
        this.syncWaiterCalls(tables);
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

  openCard(card: TableDashboardCard): void {
    if (card.state === 'INACTIVE') {
      return;
    }

    this.waiterCallNotificationService.clearWaiterCallCandidates(card.table.restaurantId, [card.table.numero, card.table.id]);
    if (card.table.waiterCallPending) {
      this.tableService.clearWaiterCall(card.table.id).subscribe({
        error: err => console.error('Errore pulizia chiamata cameriere', err)
      });
    }

    if (card.activeOrder) {
      void this.router.navigate(['/orders', card.activeOrder.id]);
      return;
    }

    void this.router.navigate(['/waiter-order'], { queryParams: { tableId: card.table.id } });
  }

  openOrderFromKeyboard(event: Event, card: TableDashboardCard): void {
    event.preventDefault();
    this.openCard(card);
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

  isCardInteractive(card: TableDashboardCard): boolean {
    return card.state !== 'INACTIVE';
  }

  hasWaiterCall(card: TableDashboardCard): boolean {
    return card.table.waiterCallPending
      || this.waiterCallNotificationService.hasWaiterCall(card.table.restaurantId, card.table.numero)
      || this.waiterCallNotificationService.hasWaiterCall(card.table.restaurantId, card.table.id);
  }

  toggleWaiterCalls(): void {
    this.waiterCallsExpanded = !this.waiterCallsExpanded;
  }

  resetTableFilter(): void {
    this.selectedTable = 'ALL';
  }

  tableLabel(card: TableDashboardCard): string {
    return card.table.nome?.trim() || `Tavolo ${card.table.numero}`;
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
        const activeOrder = activeOrderByTableId.get(table.numero)
          ?? activeOrderByTableId.get(table.id)
          ?? null;
        return {
          table,
          activeOrder,
          state: this.resolveState(table, activeOrder),
          total: activeOrder?.totale ?? 0,
          itemCount: activeOrder?.items.reduce((sum, item) => sum + item.quantita, 0) ?? 0,
          updatedAt: activeOrder?.updatedAt ?? table.updatedAt,
          hasWaiterCall: table.waiterCallPending
            || this.waiterCallNotificationService.hasWaiterCall(table.restaurantId, table.numero)
            || this.waiterCallNotificationService.hasWaiterCall(table.restaurantId, table.id)
        } satisfies TableDashboardCard;
      });
  }

  private syncWaiterCalls(tables: RestaurantTable[]): void {
    for (const table of tables) {
      if (table.waiterCallPending) {
        this.waiterCallNotificationService.markWaiterCall(table.restaurantId, table.numero);
      } else {
        this.waiterCallNotificationService.clearWaiterCallCandidates(table.restaurantId, [table.numero, table.id]);
      }
    }
  }

  private matchesStatusFilter(card: TableDashboardCard): boolean {
    return this.selectedFilter === 'ALL' || card.state === this.selectedFilter;
  }

  private matchesTableFilter(card: TableDashboardCard): boolean {
    return this.selectedTable === 'ALL' || card.table.numero === Number(this.selectedTable);
  }

  private buildWaiterCallKey(restaurantId: number, tableId: number): string {
    return `${restaurantId}:${tableId}`;
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

  private handleBackofficeEvent(event: BackofficeOrderEvent): void {
    const payload = event.payload;
    if (!payload?.type) {
      this.loadDashboard(false);
      return;
    }

    if (payload.type === 'WAITER_CALLED' && payload.restaurantId && payload.tableId) {
      this.applyWaiterCall(payload.restaurantId, payload.tableId);
      return;
    }

    if (payload.type === 'ORDER_REPRINT_REQUESTED' || payload.type === 'SUSPICIOUS_TABLE_ACCESS') {
      return;
    }

    if (payload.type === 'TABLE_UPDATED') {
      this.loadDashboard(false);
      return;
    }

    if (payload.type === 'ORDER_DELETED' && payload.orderId) {
      this.removeOrderFromCards(payload.orderId);
      return;
    }

    if (this.isOrderMutation(payload.type) && payload.orderId) {
      if (payload.status && !this.isActiveStatus(payload.status)) {
        this.removeOrderFromCards(payload.orderId);
        return;
      }

      this.refreshOrderCard(payload.orderId);
      return;
    }

    this.loadDashboard(false);
  }

  private refreshOrderCard(orderId: number): void {
    this.ordersService.getOrderById(orderId).subscribe({
      next: order => {
        if (this.isActiveStatus(order.status)) {
          this.upsertOrderCard(order);
          return;
        }

        this.removeOrderFromCards(order.id);
      },
      error: err => {
        console.error('Errore aggiornamento card tavolo', err);
        this.loadDashboard(false);
      }
    });
  }

  private upsertOrderCard(order: CustomerOrder): void {
    const cardIndex = this.cards.findIndex(card => this.orderBelongsToCard(order, card));
    if (cardIndex === -1) {
      this.loadDashboard(false);
      return;
    }

    const card = this.cards[cardIndex];
    this.cards = this.cards.map((existing, index) =>
      index === cardIndex ? this.buildCard(card.table, order) : existing
    );
  }

  private removeOrderFromCards(orderId: number): void {
    this.cards = this.cards.map(card => {
      if (card.activeOrder?.id !== orderId) {
        return card;
      }

      return this.buildCard(card.table, null);
    });
  }

  private applyWaiterCall(restaurantId: number, tableId: number): void {
    this.waiterCallNotificationService.markWaiterCall(restaurantId, tableId);
    this.cards = this.cards.map(card => {
      if (card.table.restaurantId !== restaurantId || (card.table.numero !== tableId && card.table.id !== tableId)) {
        return card;
      }

      const table = {
        ...card.table,
        waiterCallPending: true,
        waiterCalledAt: card.table.waiterCalledAt ?? new Date().toISOString()
      };
      return this.buildCard(table, card.activeOrder);
    });
  }

  private buildCard(table: RestaurantTable, activeOrder: CustomerOrder | null): TableDashboardCard {
    return {
      table,
      activeOrder,
      state: this.resolveState(table, activeOrder),
      total: activeOrder?.totale ?? 0,
      itemCount: activeOrder?.items.reduce((sum, item) => sum + item.quantita, 0) ?? 0,
      updatedAt: activeOrder?.updatedAt ?? table.updatedAt,
      hasWaiterCall: table.waiterCallPending
        || this.waiterCallNotificationService.hasWaiterCall(table.restaurantId, table.numero)
        || this.waiterCallNotificationService.hasWaiterCall(table.restaurantId, table.id)
    };
  }

  private orderBelongsToCard(order: CustomerOrder, card: TableDashboardCard): boolean {
    return order.tableId === card.table.numero || order.tableId === card.table.id;
  }

  private isOrderMutation(type: string): boolean {
    return type === 'ORDER_UPDATED' || type === 'ORDER_CREATED' || type === 'ORDER_PAYMENT_UPDATED';
  }

  private isActiveStatus(status: string): boolean {
    return status === 'APERTO' || status === 'PARZIALMENTE_PAGATO';
  }

  private startFallbackRefresh(): void {
    if (this.fallbackRefreshTimer) {
      return;
    }

    this.loadDashboard(false);
    this.fallbackRefreshTimer = setInterval(() => this.loadDashboard(false), 10000);
  }

  private stopFallbackRefresh(): void {
    if (!this.fallbackRefreshTimer) {
      return;
    }

    clearInterval(this.fallbackRefreshTimer);
    this.fallbackRefreshTimer = null;
  }
}


