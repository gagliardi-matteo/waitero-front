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

  getImageUrl(imageUrl: string | null | undefined): string {
    return (!imageUrl || imageUrl.trim() === '')
      ? '/placeholder.png'
      : `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  goBack(): void {
    this.router.navigate(['/menu-management']);
  }
}
