import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { forkJoin } from 'rxjs';
import { Piatto } from '../../models/piatto.model';
import { OrderSummaryComponent } from '../order-summary/order-summary.component';
import { Ristorante } from '../../models/ristorante.mode';
import { environment } from '../../../environments/environment';
import { AuthContextService } from '../../services/auth-context.service';
import { OrderService } from '../../services/order.service';
import { CustomerOrderService } from '../../services/customer-order.service';
import { splitStoredAllergens } from '../../shared/allergens';
import { byScoreDesc, rankDishes } from '../../shared/menu-ranking';
import { MenuCatalogService } from '../../services/menu-catalog.service';
import { TrackingService } from '../../services/tracking.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderSummaryComponent, NgFor, NgIf, BrandLoaderComponent],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit, OnDestroy {
  restaurantId: string = '';
  tableId: string = '';
  piatti: Piatto[] = [];
  piattiRaggruppati: [string, Piatto[]][] = [];
  ristoranteObj!: Ristorante;
  token!: string;
  searchTerm = '';
  selectedCategory = 'ALL';
  activeVisibleCategory = '';
  errorMessage = '';
  recommendedDishes: Piatto[] = [];
  recommendedExpanded = true;
  loading = true;
  private eventSource: EventSource | null = null;
  private enteredAt = Date.now();
  private lastScrollBucket = 0;

  readonly categoriaOrder: string[] = [
    'ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'BEVANDA'
  ];

  constructor(
    private orderService: OrderService,
    private customerOrderService: CustomerOrderService,
    private auth: AuthContextService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private menuCatalogService: MenuCatalogService,
    private trackingService: TrackingService
  ) {}

  ngOnInit(): void {
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
      tableState: this.customerOrderService.getCurrentState(this.token, this.restaurantId, this.tableId),
      menu: this.http.get<Piatto[]>(`${environment.apiUrl}/customer/menu/piatti/${this.restaurantId}`)
    }).subscribe({
      next: ({ restaurant, tableState, menu }) => {
        this.errorMessage = '';
        this.ristoranteObj = restaurant;
        this.orderService.setConfirmedOrder(tableState.currentOrder);
        this.orderService.setDraft(tableState.draft.items);
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
    this.trackingService.trackTimeSpent(this.enteredAt, {
      metadata: {
        page: 'menu',
        searchTerm: this.searchTerm || null,
        selectedCategory: this.selectedCategory
      }
    });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
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

  get ordine(): Piatto[] {
    return this.orderService.getOrdine();
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
    const categories = this.piatti
      .map(piatto => (piatto.categoria ?? 'SENZA CATEGORIA').toUpperCase());
    return this.categoriaOrder.filter(cat => categories.includes(cat));
  }

  loadPiatti(markLoading = false) {
    if (markLoading) {
      this.loading = true;
    }

    this.http.get<Piatto[]>(`${environment.apiUrl}/customer/menu/piatti/${this.restaurantId}`)
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
    this.customerOrderService.getCurrentState(this.token, this.restaurantId, this.tableId)
      .subscribe({
        next: state => {
          this.orderService.setConfirmedOrder(state.currentOrder);
          this.orderService.setDraft(state.draft.items);
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
      const category = (piatto.categoria ?? 'SENZA CATEGORIA').toUpperCase();
      const matchesCategory = this.selectedCategory === 'ALL' || category === this.selectedCategory;
      const haystack = [piatto.nome, piatto.descrizione, piatto.ingredienti, piatto.allergeni]
        .filter((value): value is string => !!value)
        .join(' ')
        .toLowerCase();
      const matchesSearch = normalizedSearch.length === 0 || haystack.includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });

    this.piattiRaggruppati = this.raggruppaPerCategoria(filtered);
    this.activeVisibleCategory = this.piattiRaggruppati[0]?.[0] ?? '';
    this.syncActiveVisibleCategory();
  }

  private raggruppaPerCategoria(piatti: Piatto[]): [string, Piatto[]][] {
    const map = new Map<string, Piatto[]>();
    for (const piatto of piatti) {
      const cat = (piatto.categoria ?? 'SENZA CATEGORIA').toUpperCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(piatto);
    }
    return this.categoriaOrder
      .filter(cat => map.has(cat))
      .map(cat => [cat, [...map.get(cat)!].sort(byScoreDesc)]);
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

    return Array.from(recommended.values()).sort(byScoreDesc);
  }

  private applyMenuData(data: Piatto[]): void {
    this.piatti = rankDishes(data);
    this.recommendedDishes = this.buildRecommendedDishes(this.piatti);
    this.orderService.setCatalog(this.piatti);
    this.menuCatalogService.setCatalog(this.restaurantId, this.piatti);
    this.applyFilters();
  }

  private syncActiveVisibleCategory(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => this.updateActiveVisibleCategory());
  }

  private updateActiveVisibleCategory(): void {
    if (typeof document === 'undefined' || this.piattiRaggruppati.length === 0) {
      return;
    }

    const stickyOffset = 112;
    let nextActive = this.piattiRaggruppati[0][0];

    for (const [category] of this.piattiRaggruppati) {
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

    this.activeVisibleCategory = nextActive;
  }

  categoriaLabel(cat: string): string {
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }

  addToOrder(piatto: Piatto) {
    this.customerOrderService.mutateDraft(this.token, this.restaurantId, this.tableId, piatto.id, 1)
      .subscribe({
        next: draft => {
          this.orderService.setDraft(draft.items);
          this.trackingService.trackEvent('add_to_cart', {
            dishId: piatto.id,
            metadata: {
              page: 'menu',
              quantity: this.quantita(piatto.id)
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  removeFromOrder(piatto: Piatto) {
    this.customerOrderService.mutateDraft(this.token, this.restaurantId, this.tableId, piatto.id, -1)
      .subscribe({
        next: draft => {
          this.orderService.setDraft(draft.items);
          this.trackingService.trackEvent('remove_from_cart', {
            dishId: piatto.id,
            metadata: {
              page: 'menu',
              quantity: this.quantita(piatto.id)
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  quantita(itemId: number): number {
    return this.orderService.quantita(itemId);
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
        category: piatto.categoria ?? null
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

