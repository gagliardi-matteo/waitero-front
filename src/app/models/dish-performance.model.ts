export interface DishPerformance {
  dishId: number;
  dishName: string;
  category: string | null;
  price: number;
  views: number;
  clicks: number;
  addToCart: number;
  orderCount: number;
  viewToCartRate: number;
  viewToOrderRate: number;
  recentViews: number;
  previousViews: number;
  recentOrderCount: number;
  previousOrderCount: number;
  recentViewToOrderRate: number;
  previousViewToOrderRate: number;
  trendDelta: number;
  trendDirection: string;
  performanceLabel: string;
}
