import { Component, OnDestroy, OnInit } from '@angular/core';
import { Piatto } from '../../models/piatto.model';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthContextService } from '../../services/auth-context.service';
import { OrderService } from '../../services/order.service';
import { CustomerOrderService } from '../../services/customer-order.service';
import { splitStoredAllergens } from '../../shared/allergens';
import { TrackingService } from '../../services/tracking.service';
import { DemoContextService } from '../../services/demo-context.service';

@Component({
  selector: 'app-dettaglio-piatto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dettaglio-piatto.component.html',
  styleUrl: './dettaglio-piatto.component.scss'
})
export class DettaglioPiattoComponent implements OnInit, OnDestroy {
  readonly dishImagesEnabled = (environment as any).features?.dishImagesEnabled ?? false;

  piatto!: Piatto;
  upsellSuggestions: Piatto[] = [];
  errorMessage = '';
  selectedPortionKey: string | null = null;
  private enteredAt = Date.now();

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthContextService,
    private router: Router,
    private orderService: OrderService,
    private customerOrderService: CustomerOrderService,
    private trackingService: TrackingService,
    private demoContext: DemoContextService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('dishId');
    if (!id) return;

    this.enteredAt = Date.now();
    this.http.get<Piatto>(`${environment.apiUrl}/customer/dettaglio-piatto/${id}`)
      .subscribe({
        next: p => {
          this.errorMessage = '';
          this.piatto = p;
          this.selectedPortionKey = p.porzioni?.[0]?.key ?? null;
          this.trackingService.trackEvent('view_dish', {
            dishId: p.id,
            metadata: {
              page: 'dish-detail',
              category: p.categoria ?? null
            }
          });
          this.loadUpsellSuggestions();
        },
        error: err => {
          console.error('Errore caricamento dettaglio piatto', err);
          this.errorMessage = err.error?.message ?? 'Dettaglio piatto non disponibile.';
        }
      });
  }

  ngOnDestroy(): void {
    if (!this.piatto) {
      return;
    }

    this.trackingService.trackTimeSpent(this.enteredAt, {
      dishId: this.piatto.id,
      metadata: {
        page: 'dish-detail'
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

    this.customerOrderService.mutateDraftOptimistically(token, restaurantId, tableId, this.piatto.id, 1, this.selectedPortionKey ?? undefined)
      .subscribe({
        next: () => {
          this.trackingService.trackEvent('add_to_cart', {
            dishId: this.piatto.id,
            metadata: {
              page: 'dish-detail',
              quantity: this.quantita(),
              portionKey: this.selectedPortionKey
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  remove() {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId || !this.piatto) return;

    this.customerOrderService.mutateDraftOptimistically(token, restaurantId, tableId, this.piatto.id, -1, this.selectedPortionKey ?? undefined)
      .subscribe({
        next: () => {
          this.trackingService.trackEvent('remove_from_cart', {
            dishId: this.piatto.id,
            metadata: {
              page: 'dish-detail',
              quantity: this.quantita(),
              portionKey: this.selectedPortionKey
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  addSuggestion(suggestion: Piatto): void {
    if ((suggestion.porzioni?.length ?? 0) > 0) {
      void this.router.navigate(['/menu/piatto', suggestion.id]);
      return;
    }

    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;
    if (!token || !restaurantId || !tableId) return;

    this.orderService.markDraftAttribution(suggestion.id, null, 'dish_detail_upsell', this.piatto?.id);
    this.customerOrderService.mutateDraftOptimistically(token, restaurantId, tableId, suggestion.id, 1)
      .subscribe({
        next: () => {
          this.trackingService.trackEvent('add_to_cart', {
            dishId: suggestion.id,
            metadata: {
              page: 'upsell',
              sourceDishId: this.piatto?.id ?? null
            }
          });
        },
        error: err => console.error('Errore aggiornamento bozza', err)
      });
  }

  quantita(): number {
    return this.piatto ? this.orderService.quantita(this.piatto.id, this.selectedPortionKey) : 0;
  }

  displayPriceLabel(): string {
    if (!this.piatto) {
      return '';
    }

    const selected = this.piatto.porzioni?.find(item => item.key === this.selectedPortionKey);
    if (selected) {
      return `${selected.label} · ${selected.price.toFixed(2)} €`;
    }

    return `${this.piatto.prezzo.toFixed(2)} €`;
  }

  addToCart() {
    this.navigateToMenu();
  }

  goBack() {
    this.navigateToMenu();
  }

  private navigateToMenu(): void {
    if (this.demoContext.enabled) {
      this.router.navigate(['/demo/cliente'], { queryParams: { s: this.demoContext.token } });
      return;
    }
    this.router.navigate(['/menu']);
  }

  private loadUpsellSuggestions(): void {
    const restaurantId = this.auth.restaurantIdValue;
    if (!this.piatto || !restaurantId) {
      this.upsellSuggestions = [];
      return;
    }

    this.customerOrderService.getUpsellSuggestions(this.piatto.id, restaurantId, this.trackingService.sessionId)
      .subscribe({
        next: suggestions => {
          this.upsellSuggestions = suggestions.filter(suggestion => suggestion.id !== this.piatto.id).slice(0, 2);
        },
        error: err => {
          console.error('Errore caricamento upsell piatto', err);
          this.upsellSuggestions = [];
        }
      });
  }
}
