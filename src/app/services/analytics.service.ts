import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AnalyticsOverview } from '../models/analytics-overview.model';
import { BenchmarkInsight } from '../models/benchmark-insight.model';
import { DishPerformance } from '../models/dish-performance.model';
import { RevenueOpportunity } from '../models/revenue-opportunity.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);

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
