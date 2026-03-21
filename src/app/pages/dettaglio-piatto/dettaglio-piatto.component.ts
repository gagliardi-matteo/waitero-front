import { Component, OnInit } from '@angular/core';
import { Piatto } from '../../models/piatto.model';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthContextService } from '../../services/auth-context.service';
import { OrderService } from '../../services/order.service';
import { CustomerOrderService } from '../../services/customer-order.service';
import { splitStoredAllergens } from '../../shared/allergens';
import { MenuCatalogService } from '../../services/menu-catalog.service';
import { rankDishes } from '../../shared/menu-ranking';

@Component({
  selector: 'app-dettaglio-piatto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dettaglio-piatto.component.html',
  styleUrl: './dettaglio-piatto.component.scss'
})
export class DettaglioPiattoComponent implements OnInit {

  piatto!: Piatto;
  piatti: Piatto[] = [];
  upsellSuggestions: Piatto[] = [];
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthContextService,
    private router: Router,
    private orderService: OrderService,
    private customerOrderService: CustomerOrderService,
    private menuCatalogService: MenuCatalogService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('dishId');
    if (!id) return;

    this.loadCatalogIfNeeded();

    this.http.get<Piatto>(`${environment.apiUrl}/customer/dettaglio-piatto/${id}`)
      .subscribe({
        next: p => {
          this.errorMessage = '';
          this.piatto = p;
          this.updateUpsellSuggestions();
        },
        error: err => {
          console.error('Errore caricamento dettaglio piatto', err);
          this.errorMessage = err.error?.message ?? 'Dettaglio piatto non disponibile.';
        }
      });
  }

  get allergenBadges(): string[] {
    if (!this.piatto?.allergeni) {
      return [];
    }
    const parsed = splitStoredAllergens(this.piatto.allergeni);
    return [...parsed.standard, ...parsed.custom];
  }

  get ingredientRows(): string[] {
    if (!this.piatto) {
      return [];
    }
    const structured = this.piatto.ingredientiStrutturati ?? [];
    if (structured.length > 0) {
      return structured
        .filter(item => !!item.nome?.trim())
        .map(item => item.grammi != null ? `${item.nome} (${item.grammi} g)` : item.nome);
    }
    return this.piatto.ingredienti
      ? this.piatto.ingredienti.split(',').map(item => item.trim()).filter(Boolean)
      : [];
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    return (!imageUrl || imageUrl.trim() === '') ? '/placeholder.png' :
      `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  add() {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId || !this.piatto) return;

    this.customerOrderService.mutateDraft(token, restaurantId, tableId, this.piatto.id, 1)
      .subscribe({
        next: draft => this.orderService.setDraft(draft.items),
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  remove() {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId || !this.piatto) return;

    this.customerOrderService.mutateDraft(token, restaurantId, tableId, this.piatto.id, -1)
      .subscribe({
        next: draft => this.orderService.setDraft(draft.items),
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  addSuggestion(suggestion: Piatto): void {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.customerOrderService.mutateDraft(token, restaurantId, tableId, suggestion.id, 1)
      .subscribe({
        next: draft => this.orderService.setDraft(draft.items),
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  quantita(): number {
    return this.piatto ? this.orderService.quantita(this.piatto.id) : 0;
  }

  addToCart() {
    this.router.navigate(['/menu']);
  }

  goBack() {
    this.router.navigate(['/menu']);
  }

  private loadCatalogIfNeeded(): void {
    const restaurantId = this.auth.restaurantIdValue;
    if (!restaurantId) {
      return;
    }

    const cached = this.menuCatalogService.getCatalog(restaurantId);
    if (cached.length > 0) {
      this.piatti = cached;
      this.updateUpsellSuggestions();
      return;
    }

    this.http.get<Piatto[]>(`${environment.apiUrl}/customer/menu/piatti/${restaurantId}`)
      .subscribe({
        next: piatti => {
          this.piatti = rankDishes(piatti);
          this.menuCatalogService.setCatalog(restaurantId, this.piatti);
          this.updateUpsellSuggestions();
        },
        error: err => console.error('Errore caricamento catalogo upsell', err)
      });
  }

  private updateUpsellSuggestions(): void {
    if (!this.piatto || this.piatti.length === 0) {
      this.upsellSuggestions = [];
      return;
    }
    this.upsellSuggestions = this.getUpsellSuggestions(this.piatto);
  }

  private getUpsellSuggestions(piatto: Piatto): Piatto[] {
    const currentCategory = (piatto.categoria ?? '').toUpperCase();
    const candidates = this.piatti.filter(candidate => candidate.id !== piatto.id);

    let suggestions: Piatto[] = [];
    if (currentCategory === 'PRIMO' || currentCategory === 'PIZZA') {
      suggestions = candidates.filter(candidate => (candidate.categoria ?? '').toUpperCase() === 'BEVANDA');
    } else if (currentCategory === 'SECONDO') {
      suggestions = candidates.filter(candidate => (candidate.categoria ?? '').toUpperCase() === 'CONTORNO');
    } else if (currentCategory === 'DOLCE') {
      suggestions = candidates.filter(candidate => {
        const category = (candidate.categoria ?? '').toUpperCase();
        const name = candidate.nome.toLowerCase();
        return category === 'BEVANDA' && (name.includes('caffe') || name.includes('caff'));
      });
    }

    return suggestions.slice(0, 2);
  }
}
