import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AnalyticsOverview } from '../models/analytics-overview.model';
import { BenchmarkInsight } from '../models/benchmark-insight.model';
import { DishPerformance } from '../models/dish-performance.model';
import { RevenueOpportunity } from '../models/revenue-opportunity.model';

export interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  dishPerformance: DishPerformance[];
  revenueOpportunities: RevenueOpportunity[];
  benchmarkInsights: BenchmarkInsight[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);

  getDashboard(): Observable<AnalyticsDashboard> {
    return this.http.get<AnalyticsDashboard>(`${environment.apiUrl}/analytics/dashboard`);
  }

  getOverview(): Observable<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>(`${environment.apiUrl}/analytics/overview`);
  }

  getDishPerformance(): Observable<DishPerformance[]> {
    return this.http.get<DishPerformance[]>(`${environment.apiUrl}/analytics/dish-performance`);
  }

  getRevenueOpportunities(): Observable<RevenueOpportunity[]> {
    return this.http.get<RevenueOpportunity[]>(`${environment.apiUrl}/analytics/revenue-opportunities`);
  }

  getBenchmarkInsights(): Observable<BenchmarkInsight[]> {
    return this.http.get<BenchmarkInsight[]>(`${environment.apiUrl}/analytics/benchmarks`);
  }
}
