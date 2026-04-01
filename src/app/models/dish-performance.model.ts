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
  performanceLabel: string;
}
