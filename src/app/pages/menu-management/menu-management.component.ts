import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../auth/AuthService';
import { Piatto } from '../../models/piatto.model';
import { environment } from '../../../environments/environment';
import { splitStoredAllergens } from '../../shared/allergens';
import { AnalyticsService } from '../../services/analytics.service';
import { DishPerformance } from '../../models/dish-performance.model';
import { rankDishes } from '../../shared/menu-ranking';
import { MenuInsightsPanelComponent } from './components/menu-insights-panel/menu-insights-panel.component';
import { MenuAutopilotPanelComponent } from './components/menu-autopilot-panel/menu-autopilot-panel.component';

interface AutopilotCategoryPlan {
  categoria: string;
  spotlight: Piatto | null;
  nextDishes: Piatto[];
}

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, RouterModule, MenuInsightsPanelComponent, MenuAutopilotPanelComponent],
  templateUrl: './menu-management.component.html',
  styleUrl: './menu-management.component.scss',
})
export class MenuManagementComponent implements OnInit {
  piatti: Piatto[] = [];
  userId: number | null = null;
  deletingDishId: number | null = null;
  togglingRecommendedId: number | null = null;
  applyingAutopilot = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private analyticsService: AnalyticsService
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
    this.updateRecommended(item, !item.consigliato);
  }

  applyAutopilotRecommended(event: Event): void {
    event.stopPropagation();
    const candidates = this.autopilotRecommendedCandidates;
    if (this.applyingAutopilot || candidates.length === 0) {
      return;
    }

    this.applyingAutopilot = true;
    forkJoin(candidates.map(item => this.http.put<Piatto>(`${environment.apiUrl}/menu/piatti/${item.id}`, {
      ...item,
      consigliato: true,
      disponibile: item.disponibile ?? true
    }))).subscribe({
      next: () => {
        const candidateIds = new Set(candidates.map(item => item.id));
        this.piatti = this.piatti.map(item => candidateIds.has(item.id) ? { ...item, consigliato: true } : item);
        this.applyingAutopilot = false;
      },
      error: err => {
        console.error('Errore applicazione autopilot consigliati:', err);
        this.applyingAutopilot = false;
        alert(err.error?.message ?? 'Impossibile applicare i consigliati automatici.');
      }
    });
  }

  get menuByCategory(): [string, Piatto[]][] {
    const categoriaOrder: string[] = ['ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'BEVANDA'];

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
      .map(([categoria, items]) => [categoria, items.sort((a, b) => (b.numeroOrdini ?? 0) - (a.numeroOrdini ?? 0) || a.id - b.id)] as [string, Piatto[]]);
  }

  get topPerformerCount(): number {
    return this.piatti.filter(item => item.performanceLabel === 'top_performer').length;
  }

  get optimizationCount(): number {
    return this.piatti.filter(item => item.performanceLabel === 'high_interest_low_conversion').length;
  }

  get upsellOpportunityCount(): number {
    return this.piatti.filter(item => this.hasUpsellOpportunity(item)).length;
  }

  get autopilotRecommendedCandidates(): Piatto[] {
    return rankDishes(this.piatti)
      .filter(item => !item.consigliato)
      .filter(item => item.performanceLabel !== 'high_interest_low_conversion')
      .slice(0, 3);
  }

  get autopilotOptimizationQueue(): Piatto[] {
    return this.piatti
      .filter(item => item.performanceLabel === 'high_interest_low_conversion')
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 3);
  }

  get autopilotCategoryPlans(): AutopilotCategoryPlan[] {
    return this.menuByCategory
      .map(([categoria, items]) => {
        const ranked = rankDishes(items);
        return {
          categoria,
          spotlight: ranked[0] ?? null,
          nextDishes: ranked.slice(1, 3)
        };
      })
      .filter(plan => !!plan.spotlight);
  }

  getAllergenBadges(piatto: Piatto): string[] {
    const parsed = splitStoredAllergens(piatto.allergeni);
    return [...parsed.standard, ...parsed.custom];
  }

  getDishInsightPills(piatto: Piatto): string[] {
    const pills: string[] = [];
    if (piatto.performanceLabel === 'top_performer') pills.push('Top performer');
    if (piatto.performanceLabel === 'high_interest_low_conversion') pills.push('Molto visto, poco ordinato');
    if (piatto.performanceLabel === 'cart_abandonment') pills.push('Entra nel carrello ma non chiude');
    if (this.hasUpsellOpportunity(piatto)) pills.push('Buono per upsell');
    if (piatto.consigliato) pills.push('Spinto nel menu');
    return pills.slice(0, 3);
  }

  getPrimaryInsight(piatto: Piatto): string {
    if (piatto.performanceLabel === 'high_interest_low_conversion') {
      return 'Rivedi nome, foto o descrizione: attira attenzione ma converte poco.';
    }
    if (piatto.performanceLabel === 'top_performer') {
      return 'Tienilo in alto nel menu e usalo come ancora per le categorie correlate.';
    }
    if (this.hasUpsellOpportunity(piatto)) {
      return 'Puo trainare bevande, contorni o dolci nel carrello.';
    }
    if ((piatto.views ?? 0) === 0 && (piatto.numeroOrdini ?? 0) === 0) {
      return 'Non ha ancora segnali utili: va testato con traffico reale.';
    }
    return 'Performance stabile: monitora conversione e add to cart nelle prossime sessioni.';
  }

  formatRate(value: number | undefined): string {
    return `${Math.round((value ?? 0) * 100)}%`;
  }

  trackBadge(index: number, allergen: string): string {
    return allergen;
  }

  trackInsight(index: number, insight: string): string {
    return insight;
  }

  trackDish(index: number, item: Piatto): number {
    return item.id;
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

  private loadPiatti(): void {
    forkJoin({
      dishes: this.http.get<Piatto[]>(`${environment.apiUrl}/menu/piattiRistoratore/${this.userId}`),
      performance: this.analyticsService.getDishPerformance()
    }).subscribe({
      next: ({ dishes, performance }) => {
        this.piatti = this.mergePerformance(dishes, performance);
      },
      error: err => console.error('Errore caricamento piatti:', err)
    });
  }

  private mergePerformance(dishes: Piatto[], performance: DishPerformance[]): Piatto[] {
    const performanceByDishId = new Map<number, DishPerformance>(performance.map(item => [item.dishId, item]));

    return dishes.map(dish => {
      const metrics = performanceByDishId.get(dish.id);
      if (!metrics) {
        return {
          ...dish,
          numeroOrdini: dish.numeroOrdini ?? 0,
          views: dish.views ?? 0,
          clicks: dish.clicks ?? 0,
          addToCart: dish.addToCart ?? 0,
          viewToCartRate: dish.viewToCartRate ?? 0,
          viewToOrderRate: dish.viewToOrderRate ?? 0,
          performanceLabel: dish.performanceLabel ?? 'stable'
        };
      }

      return {
        ...dish,
        numeroOrdini: metrics.orderCount,
        views: metrics.views,
        clicks: metrics.clicks,
        addToCart: metrics.addToCart,
        viewToCartRate: metrics.viewToCartRate,
        viewToOrderRate: metrics.viewToOrderRate,
        performanceLabel: metrics.performanceLabel
      };
    });
  }

  private hasUpsellOpportunity(piatto: Piatto): boolean {
    return (piatto.numeroOrdini ?? 0) >= 3 || (piatto.viewToCartRate ?? 0) >= 0.18;
  }

  private updateRecommended(item: Piatto, nextValue: boolean): void {
    if (this.togglingRecommendedId === item.id) {
      return;
    }

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
}
