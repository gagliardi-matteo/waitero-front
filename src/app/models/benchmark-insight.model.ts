export interface BenchmarkInsight {
  dishId: number;
  dishName: string;
  category: string | null;
  views: number;
  orderCount: number;
  viewToCartRate: number;
  viewToOrderRate: number;
  categoryViewToCartRate: number;
  categoryViewToOrderRate: number;
  restaurantViewToOrderRate: number;
  benchmarkLabel: string;
  title: string;
  rationale: string;
  actionLabel: string;
  benchmarkScore: number;
}
