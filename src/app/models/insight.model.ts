export interface Insight {
  type: 'PROMOTE' | 'FIX_CONVERSION' | 'UPSELL' | 'REMOVE';
  dishId?: number;
  targetDishId?: number;
  message: string;
}
