import { Component, OnDestroy, effect, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from './auth/AuthService';
import { RestaurantOrderService } from './services/restaurant-order.service';
import { MobileNativeService } from './services/mobile-native.service';
import { OrientationLockService } from './services/orientation-lock.service';
import { WaiterAlertAudioService } from './services/waiter-alert-audio.service';
import { WaiterCallNotificationService } from './services/waiter-call-notification.service';
import { LegalAcceptanceService, LegalConfig } from './services/legal-acceptance.service';
import { SidebarComponent } from './util/sidebar/sidebar.component';
import { CustomerOrder, CustomerOrderItem } from './models/customer-order.model';
import { PrinterService } from './core/printer/printer.service';
import { PrintOrderItem } from './core/printer/printer.models';

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
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private mobileNativeService = inject(MobileNativeService);
  private orientationLockService = inject(OrientationLockService);
  private restaurantOrderService = inject(RestaurantOrderService);
  private waiterAlertAudioService = inject(WaiterAlertAudioService);
  private waiterCallNotificationService = inject(WaiterCallNotificationService);
  private legalAcceptanceService = inject(LegalAcceptanceService);
  private printerService = inject(PrinterService);
  private eventSource: EventSource | null = null;
  private routeEventsSubscription: Subscription | null = null;
  private printedOrderSnapshots = new Map<number, PrintedOrderSnapshot>();
  legalModalVisible = false;
  legalConfig: LegalConfig | null = null;
  legalCheckedRestaurantId: number | null = null;
  legalAccepting = false;
  legalAccepted = false;
  legalChecking = false;
  legalErrorMessage = '';

  private readonly backofficeRoutes = [
    '/admin',
    '/orders',
    '/orders-history',
    '/tables-dashboard',
    '/analytics',
    '/waiter-order',
    '/menu-management',
    '/tables',
    '/printer-settings',
    '/restaurant-settings',
    '/add-dish',
    '/ristoratore/'
  ];

  constructor() {
    void this.mobileNativeService.initialize();
    this.orientationLockService.initialize();

    effect(() => {
      if (this.authService.authenticated()) {
        if (this.canSubscribeToBackofficeStream()) {
          this.connectBackofficeStream();
        } else {
          this.disconnectBackofficeStream();
        }
        this.checkBackofficeLegalAcceptance();
      } else {
        this.disconnectBackofficeStream();
        this.resetLegalState();
      }
    });

    this.routeEventsSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.authService.authenticated()) {
          this.checkBackofficeLegalAcceptance();
        }
      });
  }

  ngOnDestroy(): void {
    this.routeEventsSubscription?.unsubscribe();
    this.disconnectBackofficeStream();
  }

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  showSidebar(): boolean {
    return this.isLoggedIn() && this.isBackofficeRoute();
  }

  isCustomerMenuRoute(): boolean {
    const url = this.router.url.toLowerCase();
    return url === '/menu' || url.startsWith('/menu/');
  }

  showImpersonationBanner(): boolean {
    return this.showSidebar() && this.authService.isImpersonating();
  }

  getImpersonationRestaurantName(): string {
    return this.authService.getImpersonatedRestaurantName() ?? 'locale selezionato';
  }

  showWaiterCallBanner(): boolean {
    return this.showSidebar()
      && !this.router.url.toLowerCase().startsWith('/tables-dashboard')
      && this.waiterCallNotificationService.pendingWaiterCalls().length > 0;
  }

  waiterCallBannerText(): string {
    const calls = this.waiterCallNotificationService.pendingWaiterCalls();
    if (calls.length === 0) {
      return '';
    }

    const labels = calls.slice(0, 3).map(call => `Tavolo ${call.tableId}`);
    const remaining = calls.length - labels.length;
    return remaining > 0 ? `${labels.join(', ')} +${remaining}` : labels.join(', ');
  }

  openWaiterCallsDashboard(): void {
    void this.router.navigate(['/tables-dashboard']);
  }

  legalDocumentUrl(url: string | null | undefined): string {
    return this.legalAcceptanceService.documentUrl(url);
  }

  async exitImpersonation(): Promise<void> {
    await this.authService.stopImpersonation();
    if (this.authService.isMaster()) {
      await this.router.navigate(['/admin/restaurants']);
    }
  }

  acceptBackofficeLegalDocuments(): void {
    if (!this.legalAccepted) {
      return;
    }

    this.legalAccepting = true;
    this.legalErrorMessage = '';
    this.legalAcceptanceService.acceptBackoffice().subscribe({
      next: status => {
        this.legalAccepting = false;
        this.legalConfig = status.config;
        this.legalModalVisible = !status.accepted;
      },
      error: err => {
        console.error('Errore accettazione documenti backoffice', err);
        this.legalAccepting = false;
        this.legalErrorMessage = err.error?.message ?? `Impossibile salvare l'accettazione (HTTP ${err.status ?? 'errore'}).`;
      }
    });
  }

  isBackofficeRoute(): boolean {
    const url = this.router.url.toLowerCase();
    return this.backofficeRoutes.some(route => url === route || url.startsWith(route));
  }

  private canSubscribeToBackofficeStream(): boolean {
    return !!this.authService.getToken()
      && (this.authService.getActingRestaurantId() !== null || this.authService.getOwnedRestaurantId() !== null);
  }

  private checkBackofficeLegalAcceptance(): void {
    if (!this.isBackofficeRoute() || (this.authService.isMaster() && !this.authService.isImpersonating())) {
      this.legalModalVisible = false;
      return;
    }

    const restaurantId = this.authService.getActingRestaurantId() ?? this.authService.getOwnedRestaurantId();
    if (!restaurantId || this.legalChecking || (restaurantId === this.legalCheckedRestaurantId && this.legalConfig !== null)) {
      return;
    }

    this.legalChecking = true;
    this.legalAcceptanceService.getBackofficeStatus().subscribe({
      next: status => {
        this.legalChecking = false;
        this.legalCheckedRestaurantId = restaurantId;
        this.legalConfig = status.config;
        this.legalModalVisible = !status.accepted;
        this.legalAccepted = false;
        this.legalErrorMessage = '';
      },
      error: err => {
        console.error('Errore verifica documenti legali backoffice', err);
        this.legalChecking = false;
        this.legalCheckedRestaurantId = restaurantId;
        this.legalConfig = this.fallbackLegalConfig();
        this.legalAccepted = false;
        this.legalModalVisible = true;
        this.legalErrorMessage = `Impossibile verificare lo stato legale (HTTP ${err.status ?? 'errore'}). Accetta per riprovare il salvataggio.`;
      }
    });
  }

  private resetLegalState(): void {
    this.legalModalVisible = false;
    this.legalConfig = null;
    this.legalCheckedRestaurantId = null;
    this.legalAccepting = false;
    this.legalAccepted = false;
    this.legalChecking = false;
    this.legalErrorMessage = '';
  }

  private fallbackLegalConfig(): LegalConfig {
    return {
      contractVersion: '1.0',
      privacyVersion: '1.0',
      termsVersion: '1.0',
      allergenDisclaimerVersion: '1.0',
      contractUrl: '/legal/terms-client-v1.0.html',
      privacyUrl: '/legal/privacy-client-v1.0.html',
      termsUrl: '/legal/terms-client-v1.0.html',
      allergenDisclaimerUrl: '/legal/disclaimer-allergeni-v1.0.html'
    };
  }

  private connectBackofficeStream(): void {
    if (this.eventSource) {
      return;
    }

    const eventSource = this.restaurantOrderService.connectToStream();
    if (!eventSource) {
      return;
    }

    eventSource.addEventListener('orders-updated', event => {
      const payload = this.parseOrderEvent(event);
      if (payload?.type === 'WAITER_CALLED' && payload.restaurantId && payload.tableId) {
        this.waiterCallNotificationService.markWaiterCall(payload.restaurantId, payload.tableId);
        void this.waiterAlertAudioService.playWaiterCallAlert();
        return;
      }

      if (payload?.type === 'ORDER_UPDATED') {
        void this.waiterAlertAudioService.playNewOrderAlert();
        if (payload.orderId) {
          void this.printOrderOnLocalPos(payload.orderId);
        }
      }
    });

    eventSource.addEventListener('error', () => {
      this.disconnectBackofficeStream();
    });

    this.eventSource = eventSource;
  }

  private disconnectBackofficeStream(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.waiterCallNotificationService.clearAll();
  }

  private parseOrderEvent(event: Event): { type?: string; orderId?: number; restaurantId?: number; tableId?: number } | null {
    const data = (event as MessageEvent<string>).data;
    if (!data || typeof data !== 'string') {
      return null;
    }

    try {
      return JSON.parse(data) as { type?: string };
    } catch {
      return null;
    }
  }

  private async printOrderOnLocalPos(orderId: number): Promise<void> {
    if (!this.printerService.canPrintLocally()) {
      console.warn('Stampa POS locale non disponibile', this.printerService.getLocalPrinterStatus());
      return;
    }

    this.restaurantOrderService.getOrderById(orderId).subscribe({
      next: async order => {
        const printSnapshot = this.buildPrintedOrderSnapshot(order);
        const lastSnapshot = this.getPrintedOrderSnapshot(order.id);
        if (lastSnapshot?.fingerprint === printSnapshot.fingerprint) {
          console.info('Snapshot ordine gia stampato su POS locale', orderId);
          return;
        }

        console.info('Invio ordine a stampante POS locale', orderId);
        const result = await this.printerService.printKitchenOrder(this.toPrintOrder(order, lastSnapshot));
        if (!result.success) {
          console.error('Errore stampa ordine su POS locale', result.error);
          return;
        }

        this.storePrintedOrderSnapshot(printSnapshot);
      },
      error: err => {
        console.error('Errore caricamento ordine per stampa POS', err);
      }
    });
  }

  private toPrintOrder(order: CustomerOrder, lastSnapshot?: PrintedOrderSnapshot) {
    const note = order.noteCucina?.trim();
    return {
      orderId: order.id,
      tableName: `Tavolo ${order.tableId}`,
      createdAt: order.createdAt,
      items: this.buildPrintItems(order, lastSnapshot, note)
    };
  }

  private formatPrintItemName(name: string, portionLabel?: string | null): string {
    if (!portionLabel || portionLabel === 'Standard') {
      return name;
    }
    return `${name} - ${portionLabel}`;
  }

  private buildPrintItems(order: CustomerOrder, lastSnapshot: PrintedOrderSnapshot | undefined, note?: string): PrintOrderItem[] {
    const previousQuantityByKey = new Map<string, number>(
      lastSnapshot?.items.map(item => [item.key, item.quantity]) ?? []
    );
    const printedItems: PrintOrderItem[] = [];
    const newItems: PrintOrderItem[] = [];

    for (const item of order.items) {
      const key = this.orderItemPrintKey(item);
      const previousQuantity = previousQuantityByKey.get(key) ?? 0;
      const printedQuantity = Math.min(previousQuantity, item.quantita);
      const newQuantity = Math.max(item.quantita - previousQuantity, 0);
      const name = this.formatPrintItemName(item.nome, item.portionLabel);

      if (newQuantity > 0) {
        newItems.push({
          quantity: newQuantity,
          name,
          status: 'NEW'
        });
      }

      if (printedQuantity > 0) {
        printedItems.push({
          quantity: printedQuantity,
          name,
          status: 'PRINTED'
        });
      }
    }

    const items = [...newItems, ...printedItems];
    if (note && items.length > 0) {
      items[0] = { ...items[0], notes: note };
    }
    return items;
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

  private getPrintedOrderSnapshot(orderId: number): PrintedOrderSnapshot | undefined {
    if (this.printedOrderSnapshots.size === 0) {
      this.loadPrintedOrderSnapshots();
    }
    return this.printedOrderSnapshots.get(orderId);
  }

  private storePrintedOrderSnapshot(snapshot: PrintedOrderSnapshot): void {
    this.printedOrderSnapshots.set(snapshot.orderId, snapshot);
    this.storePrintedOrderSnapshots();
  }

  private loadPrintedOrderSnapshots(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const raw = localStorage.getItem('waiteroPrintedOrderSnapshots');
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PrintedOrderSnapshot[];
      this.printedOrderSnapshots = new Map(
        parsed
          .filter(snapshot => Number.isFinite(snapshot.orderId) && typeof snapshot.fingerprint === 'string' && Array.isArray(snapshot.items))
          .map(snapshot => [snapshot.orderId, snapshot])
      );
    } catch {
      this.printedOrderSnapshots.clear();
    }
  }

  private storePrintedOrderSnapshots(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const values = Array.from(this.printedOrderSnapshots.values()).slice(-200);
    localStorage.setItem('waiteroPrintedOrderSnapshots', JSON.stringify(values));
  }
}
