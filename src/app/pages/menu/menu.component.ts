import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { catchError, forkJoin, throwError } from 'rxjs';
import { Piatto } from '../../models/piatto.model';
import { OrderSummaryComponent } from '../order-summary/order-summary.component';
import { Ristorante } from '../../models/ristorante.mode';
import { environment } from '../../../environments/environment';
import { AuthContextService } from '../../services/auth-context.service';
import { OrderService } from '../../services/order.service';
import { CustomerOrderService } from '../../services/customer-order.service';
import { splitStoredAllergens } from '../../shared/allergens';
import { MenuCatalogService } from '../../services/menu-catalog.service';
import { TrackingService } from '../../services/tracking.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { categoryOptionsFromDishes, dishCategoryCode, groupDishesByCategory, DishCategoryGroup } from '../../shared/dish-category';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderSummaryComponent, NgFor, NgIf, BrandLoaderComponent],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit, OnDestroy {
  readonly dishImagesEnabled = (environment as any).features?.dishImagesEnabled ?? false;
  restaurantId: string = '';
  tableId: string = '';
  piatti: Piatto[] = [];
  piattiRaggruppati: DishCategoryGroup[] = [];
  ristoranteObj!: Ristorante;
  token!: string;
  searchTerm = '';
  selectedCategory = 'ALL';
  activeVisibleCategory = '';
  errorMessage = '';
  recommendedDishes: Piatto[] = [];
  recommendedExpanded = true;
  loading = true;
  portionSelectorDish: Piatto | null = null;
  private eventSource: EventSource | null = null;
  private enteredAt = Date.now();
  private lastScrollBucket = 0;
  private impressionObserver: IntersectionObserver | null = null;
  private impressionDishIds = new Set<number>();
  private scrollListener: (() => void) | null = null;
  private scrollAnimationFrameId: number | null = null;

  constructor(
    private orderService: OrderService,
    private customerOrderService: CustomerOrderService,
    private auth: AuthContextService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private menuCatalogService: MenuCatalogService,
    private trackingService: TrackingService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.registerScrollListener();

    const token = this.route.snapshot.queryParamMap.get('token') ?? this.auth.tokenValue;
    const restaurantId = this.route.snapshot.queryParamMap.get('restaurantId') ?? this.auth.restaurantIdValue;
    const tableId = this.route.snapshot.queryParamMap.get('tableId') ?? this.auth.tableIdValue;
    const tablePublicId = this.route.snapshot.queryParamMap.get('tablePublicId') ?? this.auth.tablePublicIdValue;

    if (token && restaurantId && tableId) {
      this.auth.setContext(
        token,
        restaurantId,
        tableId,
        this.auth.deviceIdValue ?? 'browser-device',
        this.auth.fingerprintValue,
        tablePublicId
      );
    }

    if (!token || !restaurantId || !tableId) {
      const qrToken = this.route.snapshot.queryParamMap.get('token') ?? this.auth.qrTokenValue;
      const qrTablePublicId = this.route.snapshot.queryParamMap.get('tablePublicId') ?? this.auth.tablePublicIdValue;

      if (qrToken && qrTablePublicId) {
        this.router.navigate(['/menu', qrTablePublicId, qrToken], { replaceUrl: true });
        return;
      }

      if (qrToken && restaurantId && tableId) {
        this.router.navigate(['/menu', restaurantId, tableId, qrToken], { replaceUrl: true });
        return;
      }

      this.loading = false;
      this.errorMessage = 'Accesso tavolo non disponibile. Scansiona di nuovo il QR del tavolo.';
      return;
    }

    this.enteredAt = Date.now();
    this.token = token;
    this.restaurantId = restaurantId;
    this.tableId = tableId;
    this.orderService.syncContext(`${this.restaurantId}:${this.tableId}`);

    forkJoin({
      restaurant: this.http.get<Ristorante>(`${environment.apiUrl}/customer/ristorante/${this.restaurantId}`),
      tableState: this.customerOrderService.getCurrentState(this.token, this.restaurantId, this.tableId, false)
        .pipe(catchError(err => {
          console.error('Errore caricamento stato tavolo iniziale', err);
          this.redirectToBlocked(err);
          return throwError(() => err);
        })),
      menu: this.http.get<Piatto[]>(`${environment.apiUrl}/customer/menu/piatti/${this.restaurantId}?sessionId=${encodeURIComponent(this.trackingService.sessionId)}`)
    }).subscribe({
        next: ({ restaurant, tableState, menu }) => {
          if (this.isClosedOrderStatus(tableState.currentOrder?.status)) {
            this.redirectToBlocked(null, 'Questo ordine e stato chiuso. Per effettuare un nuovo ordine rivolgiti al personale del locale.');
            return;
          }

          this.errorMessage = '';
          this.ristoranteObj = restaurant;
          this.orderService.setConfirmedOrder(tableState.currentOrder);
          this.customerOrderService.applyExternalDraftSnapshot(tableState.draft);
          this.applyMenuData(menu);
          this.loading = false;
          this.syncActiveVisibleCategory();
          this.connectTableStream();
      },
      error: err => {
        console.error('Errore caricamento stato menu', err);
        this.piatti = [];
        this.piattiRaggruppati = [];
        this.recommendedDishes = [];
        this.loading = false;
        this.errorMessage = err.error?.message ?? 'Menu non disponibile.';
      }
    });
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
    this.unregisterScrollListener();
    this.impressionObserver?.disconnect();
    this.impressionObserver = null;
    this.trackingService.trackTimeSpent(this.enteredAt, {
      metadata: {
        page: 'menu',
        searchTerm: this.searchTerm || null,
        selectedCategory: this.selectedCategory
      }
    });
  }

  private onWindowScroll(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.scrollAnimationFrameId !== null) {
      return;
    }

    this.scrollAnimationFrameId = window.requestAnimationFrame(() => {
      this.scrollAnimationFrameId = null;
      this.handleScrollFrame();
    });
  }

  private handleScrollFrame(): void {
    this.updateActiveVisibleCategory();

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const doc = document.documentElement;
    const scrollableHeight = doc.scrollHeight - window.innerHeight;
    if (scrollableHeight <= 0) {
      return;
    }

    const progress = Math.round((window.scrollY / scrollableHeight) * 100);
    const bucket = Math.min(100, Math.floor(progress / 25) * 25);
    if (bucket < 25 || bucket <= this.lastScrollBucket) {
      return;
    }

    this.lastScrollBucket = bucket;
    this.trackingService.trackEvent('scroll', {
      metadata: {
        page: 'menu',
        progress: bucket
      }
    });
  }

  get hasVisibleDishes(): boolean {
    return this.piattiRaggruppati.length > 0;
  }

  get showRecommendedSection(): boolean {
    return !this.loading
      && !this.errorMessage
      && this.selectedCategory === 'ALL'
      && this.searchTerm.trim().length === 0
      && this.recommendedDishes.length > 0;
  }

  get availableCategories(): string[] {
    return categoryOptionsFromDishes(this.piatti).map(category => category.code);
  }

  loadPiatti(markLoading = false) {
    if (markLoading) {
      this.loading = true;
    }

    this.http.get<Piatto[]>(`${environment.apiUrl}/customer/menu/piatti/${this.restaurantId}?sessionId=${encodeURIComponent(this.trackingService.sessionId)}`)
      .subscribe({
        next: data => {
          this.errorMessage = '';
          this.applyMenuData(data);
          this.loading = false;
          this.syncActiveVisibleCategory();
        },
        error: err => {
          console.error('Errore caricamento menu cliente', err);
          this.piatti = [];
          this.piattiRaggruppati = [];
          this.recommendedDishes = [];
          this.loading = false;
          this.errorMessage = err.error?.message ?? 'Menu non disponibile.';
        }
      });
  }

  loadCurrentState() {
      this.customerOrderService.getCurrentState(this.token, this.restaurantId, this.tableId, false)
        .subscribe({
          next: state => {
            if (this.isClosedOrderStatus(state.currentOrder?.status)) {
              this.redirectToBlocked(null, 'Questo ordine e stato chiuso. Per effettuare un nuovo ordine rivolgiti al personale del locale.');
              return;
            }

            this.orderService.setConfirmedOrder(state.currentOrder);
            this.customerOrderService.applyExternalDraftSnapshot(state.draft);
          },
          error: err => console.error('Errore caricamento stato tavolo', err)
        });
    }

  connectTableStream() {
    this.eventSource = this.customerOrderService.connectToTableStream(this.token, this.restaurantId, this.tableId);
    this.eventSource?.addEventListener('customer-order-updated', () => this.loadCurrentState());
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  selectCategory(category: string): void {
    this.activeVisibleCategory = category;
    this.scrollToCategory(category);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'ALL';
    this.applyFilters();
  }

  toggleRecommendedSection(): void {
    this.recommendedExpanded = !this.recommendedExpanded;
  }

  isCategoryActive(category: string): boolean {
    return this.activeVisibleCategory === category;
  }

  getAllergenBadges(piatto: Piatto): string[] {
    const parsed = splitStoredAllergens(piatto.allergeni);
    return [...parsed.standard, ...parsed.custom];
  }

  hasSelectablePortions(piatto: Piatto): boolean {
    return (piatto.porzioni?.length ?? 0) > 0;
  }

  displayPriceLabel(piatto: Piatto): string {
    const portions = piatto.porzioni ?? [];
    if (portions.length === 0) {
      return `${piatto.prezzo.toFixed(2)} €`;
    }

    const minPrice = Math.min(...portions.map(item => item.price));
    return `Da ${minPrice.toFixed(2)} €`;
  }

  quantitaTotale(piatto: Piatto): number {
    return this.orderService.totalQuantitaPerDish(piatto.id);
  }

  quantitaPorzione(piatto: Piatto, portionKey?: string | null): number {
    return this.orderService.quantita(piatto.id, portionKey);
  }

  openPortionSelector(piatto: Piatto, event?: Event): void {
    event?.stopPropagation();
    this.portionSelectorDish = piatto;
  }

  closePortionSelector(): void {
    this.portionSelectorDish = null;
  }

  onHorizontalWheel(event: WheelEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) {
      return;
    }

    target.scrollLeft += delta;
    event.preventDefault();
  }

  private applyFilters(): void {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    const filtered = this.piatti.filter(piatto => {
      const category = dishCategoryCode(piatto);
      const matchesCategory = this.selectedCategory === 'ALL' || category === this.selectedCategory;
      const haystack = [piatto.nome, piatto.descrizione, piatto.ingredienti, piatto.allergeni]
        .filter((value): value is string => !!value)
        .join(' ')
        .toLowerCase();
      const matchesSearch = normalizedSearch.length === 0 || haystack.includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });

    this.piattiRaggruppati = this.raggruppaPerCategoria(filtered);
    this.activeVisibleCategory = this.piattiRaggruppati[0]?.code ?? '';
    this.syncActiveVisibleCategory();
  }

  private raggruppaPerCategoria(piatti: Piatto[]): DishCategoryGroup[] {
    return groupDishesByCategory(piatti, (left, right) => left.nome.localeCompare(right.nome));
  }

  private buildRecommendedDishes(piatti: Piatto[]): Piatto[] {
    const recommended = new Map<number, Piatto>();

    piatti.filter(piatto => piatto.consigliato).forEach(piatto => {
      recommended.set(piatto.id, piatto);
    });

    piatti.slice(0, 3).forEach(piatto => {
      if (!recommended.has(piatto.id)) {
        recommended.set(piatto.id, piatto);
      }
    });

    return Array.from(recommended.values());
  }

  private applyMenuData(data: Piatto[]): void {
    this.piatti = data;
    this.recommendedDishes = this.buildRecommendedDishes(this.piatti);
    this.orderService.setCatalog(this.piatti);
    this.menuCatalogService.setCatalog(this.restaurantId, this.piatti);
    this.applyFilters();
  }

  private isClosedOrderStatus(status: string | null | undefined): boolean {
    const normalized = status?.trim().toUpperCase();
    return normalized === 'PAGATO' || normalized === 'ANNULLATO';
  }

  private redirectToBlocked(err?: any, fallbackMessage?: string): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.auth.clear();
    void this.router.navigate(['/menu/bloccato'], {
      replaceUrl: true,
      queryParams: {
        message: err?.error?.message || fallbackMessage || 'In questo momento non e possibile ordinare da questo tavolo. Rivolgiti al personale del locale.'
      }
    });
  }

  private syncActiveVisibleCategory(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => this.updateActiveVisibleCategory());
  }

  private registerScrollListener(): void {
    if (typeof window === 'undefined' || this.scrollListener) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.scrollListener = () => this.onWindowScroll();
      window.addEventListener('scroll', this.scrollListener, { passive: true });
    });
  }

  private unregisterScrollListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }

    if (this.scrollAnimationFrameId !== null) {
      window.cancelAnimationFrame(this.scrollAnimationFrameId);
      this.scrollAnimationFrameId = null;
    }
  }

  private updateActiveVisibleCategory(): void {
    if (typeof document === 'undefined' || this.piattiRaggruppati.length === 0) {
      return;
    }

    const stickyOffset = 112;
    let nextActive = this.piattiRaggruppati[0].code;

    for (const group of this.piattiRaggruppati) {
      const category = group.code;
      const section = document.getElementById(`cat-${category}`);
      if (!section) {
        continue;
      }

      const top = section.getBoundingClientRect().top;
      if (top <= stickyOffset) {
        nextActive = category;
      } else {
        break;
      }
    }

    if (nextActive !== this.activeVisibleCategory) {
      this.zone.run(() => {
        this.activeVisibleCategory = nextActive;
      });
    }
  }

  private scheduleMenuItemImpressionObserver(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => this.observeMenuItemImpressions());
  }

  private observeMenuItemImpressions(): void {
    if (typeof document === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    if (!this.impressionObserver) {
      this.impressionObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
            continue;
          }

          const element = entry.target as HTMLElement;
          const dishId = Number(element.dataset['dishId']);
          if (!dishId || this.impressionDishIds.has(dishId)) {
            this.impressionObserver?.unobserve(element);
            continue;
          }

          this.impressionDishIds.add(dishId);
          this.trackingService.trackEvent('view_menu_item', {
            dishId,
            metadata: {
              page: 'menu',
              category: element.dataset['category'] ?? null
            }
          });
          this.impressionObserver?.unobserve(element);
        }
      }, { threshold: 0.5 });
    }

    document.querySelectorAll<HTMLElement>('[data-track-menu-item="true"]').forEach(element => {
      const dishId = Number(element.dataset['dishId']);
      if (!dishId || this.impressionDishIds.has(dishId)) {
        return;
      }
      this.impressionObserver?.observe(element);
    });
  }

  addToOrder(piatto: Piatto, portionKey?: string) {
    this.customerOrderService.mutateDraftOptimistically(this.token, this.restaurantId, this.tableId, piatto.id, 1, portionKey)
      .subscribe({
        next: () => {
          this.trackingService.trackEvent('add_to_cart', {
            dishId: piatto.id,
            metadata: {
              page: 'menu',
              quantity: portionKey ? this.quantitaPorzione(piatto, portionKey) : this.quantitaTotale(piatto),
              portionKey: portionKey ?? null
            }
          });
        },
        error: err => {
          console.error('Errore aggiornamento bozza', err);
          this.redirectToBlocked(err);
        }
      });
  }

  removeFromOrder(piatto: Piatto, portionKey?: string) {
    this.customerOrderService.mutateDraftOptimistically(this.token, this.restaurantId, this.tableId, piatto.id, -1, portionKey)
      .subscribe({
        next: () => {
          this.trackingService.trackEvent('remove_from_cart', {
            dishId: piatto.id,
            metadata: {
              page: 'menu',
              quantity: portionKey ? this.quantitaPorzione(piatto, portionKey) : this.quantitaTotale(piatto),
              portionKey: portionKey ?? null
            }
          });
        },
        error: err => {
          console.error('Errore aggiornamento bozza', err);
          this.redirectToBlocked(err);
        }
      });
  }

  quantita(itemId: number): number {
    return this.orderService.totalQuantitaPerDish(itemId);
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl || imageUrl.trim() === '') {
      return '/placeholder.png';
    }
    if (/^(https?:)?\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    return `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  trackById(index: number, item: Piatto): number {
    return item.id;
  }

  trackBadge(index: number, allergen: string): string {
    return allergen;
  }

  openDettaglio(piatto: Piatto): void {
    this.trackingService.trackEvent('click_dish', {
      dishId: piatto.id,
      metadata: {
        page: 'menu',
        category: piatto.categoriaCode ?? piatto.categoria ?? null
      }
    });
    this.router.navigate(['/menu/piatto', piatto.id]);
  }

  scrollToCategory(categoria: string) {
    if (typeof document === 'undefined') {
      return;
    }

    const id = 'cat-' + categoria;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

