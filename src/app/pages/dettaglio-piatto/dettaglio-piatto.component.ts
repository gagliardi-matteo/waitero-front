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

@Component({
  selector: 'app-dettaglio-piatto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dettaglio-piatto.component.html',
  styleUrl: './dettaglio-piatto.component.scss'
})
export class DettaglioPiattoComponent implements OnInit {

  piatto!: Piatto;
  upsellSuggestions: Piatto[] = [];
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthContextService,
    private router: Router,
    private orderService: OrderService,
    private customerOrderService: CustomerOrderService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('dishId');
    if (!id) return;

    this.http.get<Piatto>(`${environment.apiUrl}/customer/dettaglio-piatto/${id}`)
      .subscribe({
        next: p => {
          this.errorMessage = '';
          this.piatto = p;
          this.loadUpsellSuggestions();
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

  private loadUpsellSuggestions(): void {
    const restaurantId = this.auth.restaurantIdValue;
    if (!this.piatto || !restaurantId) {
      this.upsellSuggestions = [];
      return;
    }

    this.customerOrderService.getUpsellSuggestions(this.piatto.id, restaurantId)
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
