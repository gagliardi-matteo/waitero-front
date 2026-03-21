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

  quantita(): number {
    return this.piatto ? this.orderService.quantita(this.piatto.id) : 0;
  }

  addToCart() {
    this.router.navigate(['/menu']);
  }

  goBack() {
    this.router.navigate(['/menu']);
  }
}
