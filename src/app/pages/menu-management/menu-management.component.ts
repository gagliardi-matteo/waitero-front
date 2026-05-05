import { Component, OnInit, inject } from '@angular/core';
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
import { UiFeaturesService } from '../../services/ui-features.service';
import { ExplainTooltipDirective } from '../../shared/explain-tooltip/explain-tooltip.directive';
import { DishCategoryGroup, dishCategoryLabel, groupDishesByCategory } from '../../shared/dish-category';

interface AutopilotCategoryPlan {
  categoria: string;
  spotlight: Piatto | null;
  nextDishes: Piatto[];
}

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, RouterModule, MenuInsightsPanelComponent, MenuAutopilotPanelComponent, ExplainTooltipDirective],
  templateUrl: './menu-management.component.html',
  styleUrl: './menu-management.component.scss',
})
export class MenuManagementComponent implements OnInit {
  piatti: Piatto[] = [];
  userId: number | null = null;
  deletingDishId: number | null = null;
  togglingRecommendedId: number | null = null;
  explainabilityEnabled = false;

  private uiFeaturesService = inject(UiFeaturesService);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private analyticsService: AnalyticsService
  ) {}

  ngOnInit(): void {
    this.loadExplainability();
    this.userId = this.authService.getActingRestaurantId() ?? this.authService.getOwnedRestaurantId();
    if (!this.userId) {
      alert('Locale non disponibile');
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

  get menuByCategory(): DishCategoryGroup[] {
    return groupDishesByCategory(
      this.piatti,
      (left, right) => (right.numeroOrdini ?? 0) - (left.numeroOrdini ?? 0) || left.id - right.id
    );
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
      .map(group => {
        const ranked = rankDishes(group.items);
        return {
          categoria: group.label,
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

  categoryLabel(item: Piatto): string {
    return dishCategoryLabel(item);
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

  addDishButtonTooltip(): string {
    return this.joinTooltip([
      'Azione UI.',
      'Premendo questo bottone si apre la pagina di inserimento nuovo piatto.',
      'Non vengono ricalcolate metriche e non parte nessuna scrittura sul backend finche il nuovo piatto non viene salvato.'
    ]);
  }

  categorySectionTooltip(group: DishCategoryGroup): string {
    return this.joinTooltip([
      `Categoria ${group.label}.`,
      'I piatti vengono raggruppati usando la categoria restituita dal backend per il locale corrente.',
      "L'ordine dei blocchi usa sortOrder della categoria e, a parita, la label.",
      'Dentro ogni categoria i piatti sono ordinati per numeroOrdini decrescente e, a parita, per id crescente.',
      `Piatti mostrati in questa sezione: ${group.items.length}.`
    ]);
  }

  dishCardTooltip(item: Piatto): string {
    return this.joinTooltip([
      `${item.nome}.`,
      'Il contenuto del piatto arriva dal catalogo menu del locale. Le metriche arrivano da /analytics/dish-performance e vengono fuse lato frontend.',
      'Metriche usate: orderCount da customer_orders/customer_order_items; views da event_log.view_dish; clicks da event_log.click_dish; addToCart da event_log.add_to_cart.',
      'Formule: viewToOrderRate = orderCount / views. viewToCartRate = addToCart / views.',
      "Label backend: top_performer se orderCount >= 5 oppure views >= 10 e conversione >= 15%; high_interest_low_conversion se views >= 10 e ordini = 0; cart_abandonment se addToCart > 0 e ordini = 0.",
      `Valori attuali: ordini ${item.numeroOrdini ?? 0}, views ${item.views ?? 0}, clicks ${item.clicks ?? 0}, addToCart ${item.addToCart ?? 0}, conversione ${this.formatPercent(item.viewToOrderRate)}, label ${item.performanceLabel ?? 'stable'}.`
    ]);
  }

  editDishButtonTooltip(item: Piatto): string {
    return this.joinTooltip([
      `Azione su ${item.nome}.`,
      'Apre la pagina di modifica del piatto.',
      'Non salva nulla finche non confermi le modifiche dal form dedicato.'
    ]);
  }

  deleteDishButtonTooltip(item: Piatto): string {
    return this.joinTooltip([
      `Azione distruttiva su ${item.nome}.`,
      `Flusso reale: conferma browser -> DELETE /menu/piatti/${item.id} -> se il backend risponde OK il piatto viene rimosso dalla lista locale.`,
      "Se il backend restituisce errore, la UI mostra un alert e il piatto resta invariato."
    ]);
  }

  private loadExplainability(): void {
    this.uiFeaturesService.getFeatures().subscribe(features => {
      this.explainabilityEnabled = features.explainabilityBalloonsEnabled;
    });
  }

  private formatPercent(value: number | undefined): string {
    return `${((value ?? 0) * 100).toFixed(1)}%`;
  }

  private joinTooltip(parts: Array<string | null | undefined>): string {
    return parts
      .filter((part): part is string => !!part && part.trim().length > 0)
      .join('\n\n');
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
