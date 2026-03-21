import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../auth/AuthService';
import { Piatto } from '../../models/piatto.model';
import { environment } from '../../../environments/environment';
import { splitStoredAllergens } from '../../shared/allergens';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './menu-management.component.html',
  styleUrl: './menu-management.component.scss',
})
export class MenuManagementComponent implements OnInit {
  piatti: Piatto[] = [];
  userId: number | null = null;
  deletingDishId: number | null = null;
  togglingRecommendedId: number | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userId = this.authService.getUserIdFromToken();
    if (!this.userId) {
      alert('Utente non autenticato');
      return;
    }

    this.loadPiatti();
  }

  deleteDish(item: Piatto, event: Event): void {
    event.stopPropagation();

    if (this.deletingDishId === item.id) {
      return;
    }

    const confirmed = window.confirm(`Vuoi eliminare il piatto "${item.nome}"?`);
    if (!confirmed) {
      return;
    }

    this.deletingDishId = item.id;
    this.http.delete<void>(`${environment.apiUrl}/menu/piatti/${item.id}`).subscribe({
      next: () => {
        this.piatti = this.piatti.filter(piatto => piatto.id !== item.id);
        this.deletingDishId = null;
      },
      error: err => {
        console.error('Errore eliminazione piatto:', err);
        this.deletingDishId = null;
        alert(err.error?.message ?? 'Impossibile eliminare il piatto.');
      }
    });
  }

  toggleRecommended(item: Piatto, event: Event): void {
    event.stopPropagation();
    if (this.togglingRecommendedId === item.id) {
      return;
    }

    const nextValue = !item.consigliato;
    const payload: Piatto = {
      ...item,
      consigliato: nextValue,
      disponibile: item.disponibile ?? true
    };

    this.togglingRecommendedId = item.id;
    this.http.put<Piatto>(`${environment.apiUrl}/menu/piatti/${item.id}`, payload).subscribe({
      next: () => {
        item.consigliato = nextValue;
        this.togglingRecommendedId = null;
      },
      error: err => {
        console.error('Errore aggiornamento consigliato:', err);
        this.togglingRecommendedId = null;
        alert(err.error?.message ?? 'Impossibile aggiornare il piatto consigliato.');
      }
    });
  }

  get menuByCategory(): [string, Piatto[]][] {
    const categoriaOrder: string[] = [
      'ANTIPASTO',
      'PRIMO',
      'SECONDO',
      'CONTORNO',
      'DOLCE',
      'BEVANDA',
    ];

    const normalizeCategoria = (raw: string | null | undefined): string => {
      if (!raw) return 'SENZA CATEGORIA';
      return raw.trim().toUpperCase();
    };

    const map = new Map<string, Piatto[]>();

    for (const item of this.piatti) {
      const categoria = normalizeCategoria(item.categoria);
      if (!map.has(categoria)) {
        map.set(categoria, []);
      }
      map.get(categoria)!.push(item);
    }

    return Array.from(map.entries())
      .sort((a, b) => {
        const indexA = categoriaOrder.indexOf(a[0]);
        const indexB = categoriaOrder.indexOf(b[0]);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
      .map(([categoria, items]) => [categoria, items.sort((a, b) => a.id - b.id)] as [string, Piatto[]]);
  }

  getAllergenBadges(piatto: Piatto): string[] {
    const parsed = splitStoredAllergens(piatto.allergeni);
    return [...parsed.standard, ...parsed.custom];
  }

  trackBadge(index: number, allergen: string): string {
    return allergen;
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl || imageUrl.trim() === '') {
      return '/placeholder.png';
    }
    return `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  private loadPiatti(): void {
    this.http.get<Piatto[]>(`${environment.apiUrl}/menu/piattiRistoratore/${this.userId}`)
      .subscribe({
        next: data => this.piatti = data,
        error: err => console.error('Errore caricamento piatti:', err)
      });
  }
}
