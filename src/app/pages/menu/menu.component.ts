import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
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

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderSummaryComponent, NgFor, NgIf],
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
  errorMessage = '';
  recommendedDishes: Piatto[] = [];
  private eventSource: EventSource | null = null;

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
    private menuCatalogService: MenuCatalogService
  ) {}

  ngOnInit(): void {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;

    if (!token || !restaurantId || !tableId) {
      this.router.navigate(['/login']);
      return;
    }

    this.token = token;
    this.restaurantId = restaurantId;
    this.tableId = tableId;
    this.orderService.syncContext(`${this.restaurantId}:${this.tableId}`);

    this.loadPiatti();
    this.loadCurrentOrder();
    this.loadCurrentDraft();
    this.connectTableStream();

    this.http.get<Ristorante>(`${environment.apiUrl}/customer/ristorante/${this.restaurantId}`)
      .subscribe(data => {
        this.ristoranteObj = data;
      });
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  get ordine(): Piatto[] {
    return this.orderService.getOrdine();
  }

  get hasVisibleDishes(): boolean {
    return this.piattiRaggruppati.length > 0;
  }

  get availableCategories(): string[] {
    const categories = this.piatti
      .map(piatto => (piatto.categoria ?? 'SENZA CATEGORIA').toUpperCase());
    return this.categoriaOrder.filter(cat => categories.includes(cat));
  }

  loadPiatti() {
    this.http.get<Piatto[]>(`${environment.apiUrl}/customer/menu/piatti/${this.restaurantId}`)
      .subscribe({
        next: data => {
          this.errorMessage = '';
          this.piatti = rankDishes(data);
          this.recommendedDishes = this.buildRecommendedDishes(this.piatti);
          this.orderService.setCatalog(this.piatti);
          this.menuCatalogService.setCatalog(this.restaurantId, this.piatti);
          this.applyFilters();
        },
        error: err => {
          console.error('Errore caricamento menu cliente', err);
          this.piatti = [];
          this.piattiRaggruppati = [];
          this.recommendedDishes = [];
          this.errorMessage = err.error?.message ?? 'Menu non disponibile.';
        }
      });
  }

  loadCurrentOrder() {
    this.customerOrderService.getCurrentOrder(this.token, this.restaurantId, this.tableId)
      .subscribe({
        next: order => this.orderService.setConfirmedOrder(order),
        error: err => {
          if (err.status === 404) {
            this.orderService.setConfirmedOrder(null);
            return;
          }
          console.error('Errore caricamento ordine attivo', err);
        }
      });
  }

  loadCurrentDraft() {
    this.customerOrderService.getCurrentDraft(this.token, this.restaurantId, this.tableId)
      .subscribe({
        next: draft => this.orderService.setDraft(draft.items),
        error: err => console.error('Errore caricamento bozza tavolo', err)
      });
  }

  connectTableStream() {
    this.eventSource = this.customerOrderService.connectToTableStream(this.token, this.restaurantId, this.tableId);
    this.eventSource?.addEventListener('customer-order-updated', () => {
      this.loadCurrentDraft();
      this.loadCurrentOrder();
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'ALL';
    this.applyFilters();
  }

  isCategoryActive(category: string): boolean {
    return this.selectedCategory === category;
  }

  getAllergenBadges(piatto: Piatto): string[] {
    const parsed = splitStoredAllergens(piatto.allergeni);
    return [...parsed.standard, ...parsed.custom];
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

  categoriaLabel(cat: string): string {
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }

  addToOrder(piatto: Piatto) {
    this.customerOrderService.mutateDraft(this.token, this.restaurantId, this.tableId, piatto.id, 1)
      .subscribe({
        next: draft => this.orderService.setDraft(draft.items),
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  removeFromOrder(piatto: Piatto) {
    this.customerOrderService.mutateDraft(this.token, this.restaurantId, this.tableId, piatto.id, -1)
      .subscribe({
        next: draft => this.orderService.setDraft(draft.items),
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  quantita(itemId: number): number {
    return this.orderService.quantita(itemId);
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    return (!imageUrl || imageUrl.trim() === '') ? '/placeholder.png' :
      `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  trackById(index: number, item: Piatto): number {
    return item.id;
  }

  trackBadge(index: number, allergen: string): string {
    return allergen;
  }

  openDettaglio(piatto: Piatto): void {
    this.router.navigate(['/menu/piatto', piatto.id]);
  }

  scrollToCategory(categoria: string) {
    const id = 'cat-' + categoria;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
