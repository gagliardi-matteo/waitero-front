export interface TokenPayload {
  sub: number;
  email?: string;
  role?: 'RISTORATORE' | 'MASTER';
  restaurantId?: number;
  actingRestaurantId?: number;
  exp?: number;
  [key: string]: any;
}
