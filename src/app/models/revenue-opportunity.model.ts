export interface RevenueOpportunity {
  dishId: number;
  dishName: string;
  category: string | null;
  currentPrice: number;
  suggestedPrice: number;
  opportunityType: string;
  title: string;
  rationale: string;
  actionLabel: string;
  revenueScore: number;
}
