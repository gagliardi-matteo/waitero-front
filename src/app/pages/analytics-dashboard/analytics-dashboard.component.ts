import { CommonModule, DecimalPipe, PercentPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AnalyticsOverview } from '../../models/analytics-overview.model';
import { BenchmarkInsight } from '../../models/benchmark-insight.model';
import { DishPerformance } from '../../models/dish-performance.model';
import { RevenueOpportunity } from '../../models/revenue-opportunity.model';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe, PercentPipe, NgIf, NgFor],
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.scss'
})
export class AnalyticsDashboardComponent implements OnInit {
  overview: AnalyticsOverview | null = null;
  dishPerformance: DishPerformance[] = [];
  revenueOpportunities: RevenueOpportunity[] = [];
  benchmarkInsights: BenchmarkInsight[] = [];
  loading = true;
  errorMessage = '';

  private analyticsService = inject(AnalyticsService);

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading = true;
    this.errorMessage = '';

    this.analyticsService.getDashboard().subscribe({
      next: dashboard => {
        this.overview = dashboard.overview;
        this.dishPerformance = dashboard.dishPerformance;
        this.revenueOpportunities = dashboard.revenueOpportunities;
        this.benchmarkInsights = dashboard.benchmarkInsights;
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento analytics dashboard', err);
        this.errorMessage = 'Impossibile caricare le metriche del locale.';
        this.loading = false;
      }
    });
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
      return 'Traffico ad alta intenzione';
    }
    if (this.conversionRate >= 0.1) {
      return 'Traffico con buon potenziale';
    }
    return 'Molte visite, poca conversione';
  }

  get revenueSignalLabel(): string {
    if (this.averageOrderValue >= 30) {
      return 'Scontrino medio forte';
    }
    if (this.averageOrderValue >= 18) {
      return 'Scontrino medio stabile';
    }
    return 'Spazio per upsell e bundle';
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
        return 'Top performer';
      case 'high_interest_low_conversion':
        return 'Molto visto, poco ordinato';
      case 'cart_abandonment':
        return 'Entrata carrello, non chiuso';
      default:
        return 'Stabile';
    }
  }

  revenueOpportunityTypeLabel(type: string): string {
    switch (type) {
      case 'price_increase_test':
        return 'Test prezzo';
      case 'margin_upgrade':
        return 'Margine';
      case 'bundle_or_reposition':
        return 'Bundle';
      case 'visibility_anchor':
        return 'Anchor';
      default:
        return 'Revenue';
    }
  }

  benchmarkLabel(label: string): string {
    switch (label) {
      case 'outperforming_category':
        return 'Sopra categoria';
      case 'under_category_benchmark':
        return 'Sotto categoria';
      case 'post_cart_friction':
        return 'Attrito carrello';
      case 'above_restaurant_average':
        return 'Sopra media locale';
      default:
        return 'Benchmark';
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
}
