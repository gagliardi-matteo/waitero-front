import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Piatto } from '../../models/piatto.model';
import { PiattoService } from '../../services/piatto.service';
import { environment } from '../../../environments/environment';
import { splitStoredAllergens } from '../../shared/allergens';

@Component({
  selector: 'app-dettaglio-piatto-ristoratore',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dettaglio-piatto-ristoratore.component.html',
  styleUrl: './dettaglio-piatto-ristoratore.component.scss'
})
export class DettaglioPiattoRistoratoreComponent implements OnInit {
  piatto: Piatto | null = null;
  errorMessage = '';

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private piattoService = inject(PiattoService);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('dishId'));
    if (!Number.isFinite(id) || id <= 0) {
      this.errorMessage = 'Piatto non valido.';
      return;
    }

    this.piattoService.getById(id).subscribe({
      next: piatto => {
        this.errorMessage = '';
        this.piatto = piatto;
      },
      error: err => {
        console.error('Errore caricamento dettaglio piatto ristoratore', err);
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

  get orderCount(): number {
    return this.piatto?.numeroOrdini ?? 0;
  }

  get viewCount(): number {
    return this.piatto?.views ?? 0;
  }

  get conversionRate(): number {
    if (this.piatto?.viewToOrderRate != null) {
      return this.piatto.viewToOrderRate;
    }
    if (this.viewCount > 0) {
      return this.orderCount / this.viewCount;
    }
    return 0;
  }

  get revenueValue(): number {
    if (!this.piatto) {
      return 0;
    }
    return this.orderCount * this.piatto.prezzo;
  }

  get statusLabel(): string {
    return this.piatto?.disponibile ? 'Disponibile' : 'Non disponibile';
  }

  get categoryPriceLabel(): string {
    if (!this.piatto) {
      return '';
    }
    return `${this.capitalize(this.piatto.categoria)} €${this.piatto.prezzo.toFixed(2)}`;
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    return (!imageUrl || imageUrl.trim() === '')
      ? '/placeholder.png'
      : `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  goBack(): void {
    this.router.navigate(['/menu-management']);
  }

  private capitalize(value: string | null | undefined): string {
    if (!value) {
      return 'Piatto';
    }
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
}
