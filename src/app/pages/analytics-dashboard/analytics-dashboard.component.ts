import { CommonModule, DecimalPipe, PercentPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/AuthService';
import { AnalyticsOverview } from '../../models/analytics-overview.model';
import { BenchmarkInsight } from '../../models/benchmark-insight.model';
import { DishPerformance } from '../../models/dish-performance.model';
import { Insight } from '../../models/insight.model';
import { RevenueOpportunity } from '../../models/revenue-opportunity.model';
import { AnalyticsService, DishInsightApplyResult } from '../../services/analytics.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { UiFeaturesService } from '../../services/ui-features.service';
import { ExplainTooltipDirective } from '../../shared/explain-tooltip/explain-tooltip.directive';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe, PercentPipe, NgIf, NgFor, BrandLoaderComponent, ExplainTooltipDirective],
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.scss'
})
export class AnalyticsDashboardComponent implements OnInit {
  overview: AnalyticsOverview | null = null;
  dishPerformance: DishPerformance[] = [];
  revenueOpportunities: RevenueOpportunity[] = [];
  benchmarkInsights: BenchmarkInsight[] = [];
  insights: Insight[] = [];
  insightsExpanded = false;
  applyingInsights = false;
  applySummaryMessage = '';
  loading = true;
  errorMessage = '';
  ristoranteId: number | null = null;
  explainabilityEnabled = false;

  private analyticsService = inject(AnalyticsService);
  private authService = inject(AuthService);
  private uiFeaturesService = inject(UiFeaturesService);

  ngOnInit(): void {
    this.loadExplainability();
    this.ristoranteId = this.authService.getActingRestaurantId() ?? this.authService.getOwnedRestaurantId();
    this.loadOverview();
    this.loadInsights();
  }

  loadOverview(): void {
    this.loading = true;
    this.errorMessage = '';

    this.analyticsService.getDashboard().subscribe({
      next: dashboard => {
        this.overview = dashboard.overview;
        this.dishPerformance = this.sortDishPerformanceByConversion(dashboard.dishPerformance);
        this.revenueOpportunities = dashboard.revenueOpportunities;
        this.benchmarkInsights = dashboard.benchmarkInsights;
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento analytics dashboard', err);
        this.errorMessage = 'Non riesco a caricare i dati del locale.';
        this.loading = false;
      }
    });
  }

  loadInsights(): void {
    if (!this.ristoranteId) {
      this.insights = [];
      this.applySummaryMessage = '';
      return;
    }

    this.analyticsService.getInsights(this.ristoranteId).subscribe({
      next: data => {
        this.insights = data || [];
      },
      error: err => {
        console.error('Errore caricamento suggerimenti automatici', err);
        this.insights = [];
      }
    });
  }

  applyAutomaticInsights(): void {
    if (!this.ristoranteId || this.applyingInsights || this.insights.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      'Vuoi applicare i suggerimenti automatici?\n\n' +
      '- i piatti forti verranno messi in evidenza\n' +
      '- i piatti che convincono poco verranno messi più in basso\n' +
      '- i piatti deboli verranno nascosti dal menu'
    );
    if (!confirmed) {
      return;
    }

    this.applyingInsights = true;
    this.applySummaryMessage = '';

    this.analyticsService.applyInsights(this.ristoranteId).subscribe({
      next: result => {
        this.applySummaryMessage = this.buildApplySummary(result);
        this.insightsExpanded = true;
        this.applyingInsights = false;
        this.loadInsights();
      },
      error: err => {
        console.error('Errore applicazione suggerimenti automatici', err);
        this.applyingInsights = false;
        this.applySummaryMessage = 'Non riesco ad applicare i suggerimenti.';
        this.insightsExpanded = true;
      }
    });
  }

  toggleInsightsExpanded(): void {
    this.insightsExpanded = !this.insightsExpanded;
  }

  get conversionRate(): number {
    return this.overview?.conversionRate ?? 0;
  }

  get dropoffRate(): number {
    return this.overview?.dropoffRate ?? 0;
  }

  get averageOrderValue(): number {
    return this.overview?.averageOrderValue ?? 0;
  }

  get topPerformerCount(): number {
    return this.dishPerformance.filter(dish => dish.performanceLabel === 'top_performer').length;
  }

  get opportunityCount(): number {
    return this.dishPerformance.filter(dish => dish.performanceLabel === 'high_interest_low_conversion').length;
  }

  get revenueOpportunityCount(): number {
    return this.revenueOpportunities.length;
  }

  get benchmarkAlertCount(): number {
    return this.benchmarkInsights.length;
  }

  get trafficQualityLabel(): string {
    if (this.conversionRate >= 0.2) {
      return 'Molti visitatori diventano clienti';
    }
    if (this.conversionRate >= 0.1) {
      return 'Buon rapporto tra visite e ordini';
    }
    return 'Tante visite, pochi ordini';
  }

  get revenueSignalLabel(): string {
    if (this.averageOrderValue >= 30) {
      return 'Spesa media alta';
    }
    if (this.averageOrderValue >= 18) {
      return 'Spesa media nella norma';
    }
    return 'Spazio per aumentare la spesa media';
  }

  get funnelSteps(): Array<{ label: string; value: number; ratio: number }> {
    const views = this.overview?.views ?? 0;
    const sessions = this.overview?.sessions ?? 0;
    const orders = this.overview?.orders ?? 0;
    const base = Math.max(views, sessions, orders, 1);

    return [
      { label: 'Visualizzazioni piatti', value: views, ratio: views / base },
      { label: 'Sessioni attive', value: sessions, ratio: sessions / base },
      { label: 'Ordini inviati', value: orders, ratio: orders / base }
    ];
  }

  performanceBadgeLabel(label: string): string {
    switch (label) {
      case 'top_performer':
        return 'Più forte del menu';
      case 'high_interest_low_conversion':
        return 'Piace ma si ordina poco';
      case 'cart_abandonment':
        return 'Iniziato ma non completato';
      default:
        return 'Nella media';
    }
  }

  revenueOpportunityTypeLabel(type: string): string {
    switch (type) {
      case 'price_increase_test':
        return 'Prova un prezzo diverso';
      case 'margin_upgrade':
        return 'Più margine';
      case 'bundle_or_reposition':
        return 'Da abbinare';
      case 'visibility_anchor':
        return 'Più visibilità';
      default:
        return 'Più incasso';
    }
  }

  benchmarkLabel(label: string): string {
    switch (label) {
      case 'outperforming_category':
        return 'Va meglio della media';
      case 'under_category_benchmark':
        return 'Va peggio della media';
      case 'post_cart_friction':
        return 'Rallenta prima dell’ordine';
      case 'above_restaurant_average':
        return 'Sopra la media del locale';
      default:
        return 'Confronto';
    }
  }

  trackStep(index: number, step: { label: string }): string {
    return step.label;
  }

  trackDish(index: number, dish: DishPerformance): number {
    return dish.dishId;
  }

  trackOpportunity(index: number, opportunity: RevenueOpportunity): number {
    return opportunity.dishId;
  }

  trackBenchmark(index: number, insight: BenchmarkInsight): number {
    return insight.dishId;
  }

  trackAutoInsight(index: number, insight: Insight): string {
    return `${insight.type}-${insight.dishId ?? 'none'}-${insight.targetDishId ?? 'none'}-${index}`;
  }

  refreshButtonTooltipSimple(): string {
    return 'Ricarica i dati della pagina.';
  }

  openOrdersButtonTooltipSimple(): string {
    return 'Apre la lista degli ordini.';
  }

  automaticInsightsBoxTooltipSimple(): string {
    return 'Qui trovi suggerimenti automatici per migliorare i piatti.';
  }

  automaticInsightsToggleTooltipSimple(): string {
    return 'Mostra o nasconde i suggerimenti automatici.';
  }

  applyAutomaticInsightsTooltipSimple(): string {
    return 'Applica i suggerimenti al menu dopo la tua conferma.';
  }

  insightItemTooltipSimple(insight: Insight): string {
    return this.joinTooltip([
      this.insightTitle(insight),
      'Basato sui dati recenti del locale.',
      this.insightRuleTooltipSimple(insight),
      `Spiegazione: ${insight.message}`
    ]);
  }

  conversionTooltipSimple(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.formatPercent(this.conversionRate)}.`,
      'Mostra quante volte una scheda piatto vista diventa un ordine.'
    ]);
  }

  averageOrderValueTooltipSimple(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.formatMoney(this.averageOrderValue)}.`,
      'Mostra quanto spende in media un cliente a ordine.'
    ]);
  }

  totalOrdersTooltipSimple(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.overview?.orders ?? 0}.`,
      'Conta quanti ordini sono arrivati davvero.'
    ]);
  }

  dropoffTooltipSimple(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.formatPercent(this.dropoffRate)}.`,
      'Mostra quante persone guardano il menu ma non arrivano a ordinare.'
    ]);
  }

  funnelStepTooltipSimple(step: { label: string; value: number; ratio: number }): string {
    switch (step.label) {
      case 'Visualizzazioni piatti':
        return this.joinTooltip([
          `Valore attuale: ${step.value}.`,
          'Quante volte un piatto è stato aperto.'
        ]);
      case 'Sessioni attive':
        return this.joinTooltip([
          `Valore attuale: ${step.value}.`,
          'Quante sessioni sono state aperte.'
        ]);
      case 'Ordini inviati':
        return this.joinTooltip([
          `Valore attuale: ${step.value}.`,
          'Quanti ordini sono arrivati.'
        ]);
      default:
        return '';
    }
  }

  servedSeatsTooltipSimple(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.overview?.sessions ?? 0}.`,
      'Mostra quante persone hanno aperto il menu o la pagina.'
    ]);
  }

  menuViewsTooltipSimple(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.overview?.views ?? 0}.`,
      'Conta quante schede piatto sono state aperte.'
    ]);
  }

  topPerformerTooltipSimple(): string {
    return this.joinTooltip([
      `Conteggio attuale: ${this.topPerformerCount}.`,
      'Conta i piatti che stanno andando meglio.'
    ]);
  }

  dishPerformancePanelTooltipSimple(): string {
    return this.joinTooltip([
      'Qui vedi ogni piatto con i suoi numeri principali.',
      'Serve per capire quali piatti attirano attenzione e quali vendono meglio.'
    ]);
  }

  dishRowTooltipSimple(dish: DishPerformance): string {
    return this.joinTooltip([
      `${dish.dishName}.`,
      `Ordini reali: ${dish.orderCount}.`,
      `Aperture della scheda: ${dish.views}.`,
      `Passaggi verso il carrello: ${dish.addToCart}.`,
      `Andamento recente: ${this.trendDisplay(dish)}.`,
      `Incasso stimato: ${this.formatMoney(dish.orderCount * dish.price)}.`
    ]);
  }

  trendTooltipSimple(dish: DishPerformance): string {
    if (dish.trendDirection === 'insufficient_data') {
      return this.joinTooltip([
        `${dish.dishName}.`,
        'Trend non ancora disponibile.',
        'Serve un po’ di storico per fare il confronto.'
      ]);
    }

    return this.joinTooltip([
      `${dish.dishName}.`,
      'Confronto tra un periodo recente e quello precedente.',
      `Differenza mostrata: ${this.trendDisplay(dish)}.`
    ]);
  }

  private insightRuleTooltipSimple(insight: Insight): string {
    switch (insight.type) {
      case 'PROMOTE':
        return 'Questo piatto piace e merita più visibilità.';
      case 'FIX_CONVERSION':
        return 'Il piatto incuriosisce, ma viene ordinato poco.';
      case 'UPSELL':
        return 'Questo piatto si abbina bene a un altro.';
      case 'REMOVE':
        return 'Il piatto riceve visite ma convince poco.';
      default:
        return 'Suggerimento generato automaticamente.';
    }
  }

  refreshButtonTooltip(): string {
    return this.joinTooltip([
      'Ricarica i dati della pagina.',
      'Non cambia nulla nel menu o negli ordini.',
      'Serve solo ad aggiornare i numeri a schermo.'
    ]);
  }

  openOrdersButtonTooltip(): string {
    return this.joinTooltip([
      'Apre la lista degli ordini.',
      'Non modifica nessun dato.',
      'Ti porta dove controlli cosa sta succedendo adesso.'
    ]);
  }

  automaticInsightsBoxTooltip(): string {
    return this.joinTooltip([
      'Qui trovi suggerimenti automatici per migliorare i piatti.',
      'Guardano gli ultimi 30 giorni.',
      'Usano i dati reali di visite, clic e ordini.'
    ]);
  }

  automaticInsightsToggleTooltip(): string {
    return this.joinTooltip([
      'Mostra o nasconde i suggerimenti automatici.',
      'Non cambia i dati.',
      'Serve solo a leggere meglio la sezione.'
    ]);
  }

  applyAutomaticInsightsTooltip(): string {
    return this.joinTooltip([
      'Azione automatica reale.',
      'Flusso: conferma browser -> POST /dish-intelligence/insights/apply con id del locale -> il backend applica gli insight correnti.',
      "Effetti possibili: PROMOTE => consigliato=true; FIX_CONVERSION => consigliato=false; REMOVE => disponibile=false e consigliato=false; UPSELL => consigliato=true sul piatto target.",
      'Dopo la risposta la UI aggiorna il riepilogo testuale e ricarica solo la lista insight, non i KPI della pagina.'
    ]);
  }

  insightItemTooltip(insight: Insight): string {
    return this.joinTooltip([
      `${this.insightTitle(insight)}.`,
      'Sorgente: Dish Intelligence ultimi 30 giorni.',
      this.insightRuleTooltip(insight),
      `Messaggio prodotto dal planner: ${insight.message}`
    ]);
  }

  conversionTooltip(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.formatPercent(this.conversionRate)}.`,
      'Formula backend: conversionRate = orders / views.',
      'orders = count(*) da customer_orders.',
      "views = count(*) da event_log con event_type = 'view_dish'."
    ]);
  }

  averageOrderValueTooltip(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.formatMoney(this.averageOrderValue)}.`,
      'Formula backend: averageOrderValue = avg(totale) sulle righe customer_orders del locale.',
      "Usa ordini reali, non l'evento order_submitted."
    ]);
  }

  totalOrdersTooltip(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.overview?.orders ?? 0}.`,
      'Formula backend: count(*) da customer_orders del locale.',
      "Conta ordini reali presenti a database, non i click o le view del menu."
    ]);
  }

  dropoffTooltip(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.formatPercent(this.dropoffRate)}.`,
      'Formula backend: dropoffRate = 1 - (orders / sessions).',
      'sessions = count(distinct session_id) in event_log.',
      "Il nome suggerisce abbandono, ma il dato e' calcolato come complementare del rapporto ordini/sessioni."
    ]);
  }

  funnelStepTooltip(step: { label: string; value: number; ratio: number }): string {
    switch (step.label) {
      case 'Visualizzazioni piatti':
        return this.joinTooltip([
          `Valore attuale: ${step.value}.`,
          "Corrisponde a event_log.view_dish, non alle impression del menu.",
          `La barra e' normalizzata sul massimo tra views, sessions e orders. Rapporto attuale: ${this.formatPercent(step.ratio)}.`
        ]);
      case 'Sessioni attive':
        return this.joinTooltip([
          `Valore attuale: ${step.value}.`,
          'Corrisponde a count(distinct session_id) in event_log.',
          "La UI lo chiama funnel step attivo, ma non e' un conteggio tavoli/coperti certificato."
        ]);
      case 'Ordini inviati':
        return this.joinTooltip([
          `Valore attuale: ${step.value}.`,
          'Corrisponde a count(*) in customer_orders.',
          `La barra mostra il rapporto rispetto al massimo del funnel: ${this.formatPercent(step.ratio)}.`
        ]);
      default:
        return '';
    }
  }

  servedSeatsTooltip(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.overview?.sessions ?? 0}.`,
      "Il dato mostrato come 'Coperti serviti' e' in realta count(distinct session_id) in event_log.",
      'Quindi e una proxy di sessioni attive, non un vero conteggio coperti validato a tavolo.'
    ]);
  }

  menuViewsTooltip(): string {
    return this.joinTooltip([
      `Valore attuale: ${this.overview?.views ?? 0}.`,
      "La label UI dice 'Visualizzazioni menu', ma il backend popola overview.views con event_log.view_dish.",
      "Quindi oggi stai vedendo aperture di dettaglio piatto, non impression del menu o della lista."
    ]);
  }

  topPerformerTooltip(): string {
    return this.joinTooltip([
      `Conteggio attuale: ${this.topPerformerCount}.`,
      "Conta i piatti con performanceLabel = 'top_performer'.",
      "La label nasce se orderCount >= 5 oppure se views >= 10 e viewToOrderRate >= 15%.",
      'Segnali usati: view_dish per views e ordini reali da customer_order_items/customer_orders.'
    ]);
  }

  dishPerformancePanelTooltip(): string {
    return this.joinTooltip([
      'Questa tabella usa la pipeline legacy /analytics/dashboard.',
      'Per ogni piatto aggrega: views da view_dish, impressions da view_menu_item, clicks da click_dish, addToCart da add_to_cart, ordini e revenue da customer_order_items/customer_orders.',
      "Il trend confronta la conversione degli ultimi 7 giorni osservati con i 7 osservati precedenti, ancorati all'ultima attivita reale del locale: trendDelta = recentViewToOrderRate - previousViewToOrderRate.",
      'Il trend viene mostrato se la finestra recente ha almeno 5 view_dish per quel piatto; se la finestra precedente non ha views, il baseline e 0.'
    ]);
  }

  dishRowTooltip(dish: DishPerformance): string {
    return this.joinTooltip([
      `${dish.dishName}.`,
      `orderCount = ${dish.orderCount} da ordini reali.`,
      `views = ${dish.views}, clicks = ${dish.clicks}, addToCart = ${dish.addToCart}.`,
      `viewToOrderRate = ${this.formatPercent(dish.viewToOrderRate)} = orderCount / views.`,
      `viewToCartRate = ${this.formatPercent(dish.viewToCartRate)} = addToCart / views.`,
      `Trend conversione: ${this.trendDisplay(dish)}.`,
      `Label backend: ${dish.performanceLabel}. Revenue mostrata in tabella = orderCount * price = ${this.formatMoney(dish.orderCount * dish.price)}; e' una stima frontend, non il revenue reale aggregato dal backend.`
    ]);
  }

  trendClass(dish: DishPerformance): string {
    switch (dish.trendDirection) {
      case 'up':
        return 'up';
      case 'down':
        return 'down';
      case 'flat':
        return 'flat';
      default:
        return 'na';
    }
  }

  trendDisplay(dish: DishPerformance): string {
    const deltaPp = (dish.trendDelta ?? 0) * 100;
    switch (dish.trendDirection) {
      case 'up':
        return `+${deltaPp.toFixed(1)} pp`;
      case 'down':
        return `${deltaPp.toFixed(1)} pp`;
      case 'flat':
        return 'stabile';
      default:
        return 'n/d';
    }
  }

  trendTooltip(dish: DishPerformance): string {
    if (dish.trendDirection === 'insufficient_data') {
      return this.joinTooltip([
        `${dish.dishName}.`,
        'Trend non disponibile.',
        "Regola: servono almeno 5 view_dish nella finestra recente di 7 giorni osservati ancorata all'ultima attivita reale del locale.",
        `Volumi attuali: recente ${dish.recentViews} views / ${dish.recentOrderCount} ordini, precedente ${dish.previousViews} views / ${dish.previousOrderCount} ordini.`
      ]);
    }

    return this.joinTooltip([
      `${dish.dishName}.`,
      'Trend sulla conversione del piatto.',
      'Formula: trendDelta = recentViewToOrderRate - previousViewToOrderRate.',
      "Finestre usate: ultimi 7 giorni osservati e 7 precedenti, ancorati all'ultima attivita reale del locale.",
      `Finestra recente: ${dish.recentOrderCount} ordini / ${dish.recentViews} views = ${this.formatPercent(dish.recentViewToOrderRate)}.`,
      `Finestra precedente: ${dish.previousOrderCount} ordini / ${dish.previousViews} views = ${this.formatPercent(dish.previousViewToOrderRate)}.`,
      `Delta mostrato in tabella: ${this.trendDisplay(dish)}.`
    ]);
  }

  private buildApplySummary(result: DishInsightApplyResult): string {
    if (!result || result.appliedCount <= 0) {
      return 'Nessuna modifica necessaria: i suggerimenti risultano gia applicati.';
    }

    const parts: string[] = [];
    if (result.promotedCount > 0) {
      parts.push(`${result.promotedCount} promossi`);
    }
    if (result.deprioritizedCount > 0) {
      parts.push(`${result.deprioritizedCount} de-prioritizzati`);
    }
    if (result.removedCount > 0) {
      parts.push(`${result.removedCount} nascosti`);
    }
    if (result.upsellActivatedCount > 0) {
      parts.push(`${result.upsellActivatedCount} spinti per upsell`);
    }

    return `Applicati ${result.appliedCount} suggerimenti: ${parts.join(', ')}.`;
  }

  insightTitle(insight: Insight): string {
    const dishName = this.resolveDishName(insight.dishId);
    const targetDishName = this.resolveDishName(insight.targetDishId);

    switch (insight.type) {
      case 'PROMOTE':
        return dishName ? `Promuovi ${dishName}` : 'Promuovi questo piatto';
      case 'FIX_CONVERSION':
        return dishName ? `Rivedi ${dishName}` : 'Rivedi questo piatto';
      case 'UPSELL':
        if (dishName && targetDishName) {
          return `Abbina ${dishName} a ${targetDishName}`;
        }
        return dishName ? `Usa ${dishName} per upsell` : 'Suggerimento upsell';
      case 'REMOVE':
        return dishName ? `Valuta ${dishName}` : 'Valuta questo piatto';
      default:
        return 'Suggerimento';
    }
  }

  insightMeta(insight: Insight): string | null {
    const dishName = this.resolveDishName(insight.dishId);
    const targetDishName = this.resolveDishName(insight.targetDishId);

    if (insight.type === 'UPSELL' && dishName && targetDishName) {
      return `${dishName} -> ${targetDishName}`;
    }
    if (dishName) {
      return dishName;
    }
    return null;
  }

  private resolveDishName(dishId?: number): string | null {
    if (!dishId) {
      return null;
    }
    const match = this.dishPerformance.find(dish => dish.dishId === dishId);
    return match?.dishName ?? null;
  }

  private loadExplainability(): void {
    this.uiFeaturesService.getFeatures().subscribe(features => {
      this.explainabilityEnabled = features.explainabilityBalloonsEnabled;
    });
  }

  private sortDishPerformanceByConversion(items: DishPerformance[]): DishPerformance[] {
    return [...items].sort((left, right) => {
      const conversionDelta = (right.viewToOrderRate ?? 0) - (left.viewToOrderRate ?? 0);
      if (conversionDelta !== 0) {
        return conversionDelta;
      }

      const orderDelta = (right.orderCount ?? 0) - (left.orderCount ?? 0);
      if (orderDelta !== 0) {
        return orderDelta;
      }

      return left.dishName.localeCompare(right.dishName);
    });
  }

  private insightRuleTooltip(insight: Insight): string {
    switch (insight.type) {
      case 'PROMOTE':
        return 'Regola planner: orderRate alto, impressions presenti ma basse. In pratica il piatto converte bene ma e poco esposto.';
      case 'FIX_CONVERSION':
        return 'Regola planner: ctr alto, orderRate basso, ctr > orderRate e impressions > 0. In pratica genera interesse ma chiude male.';
      case 'UPSELL':
        return 'Regola planner: affinità/co-occorrenza alta con un piatto target ricavata dagli ordini reali.';
      case 'REMOVE':
        return 'Regola planner: performanceCategory LOW con impressions alte. In pratica il piatto riceve visibilita ma resta debole nello score relativo.';
      default:
        return 'Insight generato dal planner automatico.';
    }
  }

  private formatPercent(value: number | undefined): string {
    return `${((value ?? 0) * 100).toFixed(1)}%`;
  }

  private formatMoney(value: number | undefined): string {
    return `${(value ?? 0).toFixed(2)} EUR`;
  }

  private joinTooltip(parts: Array<string | null | undefined>): string {
    return parts
      .filter((part): part is string => !!part && part.trim().length > 0)
      .join('\n\n');
  }
}


