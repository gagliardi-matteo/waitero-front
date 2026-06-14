export interface RestaurantTable {
  id: number;
  restaurantId: number;
  tablePublicId: string;
  numero: number;
  nome: string;
  coperti: number;
  attivo: boolean;
  waiterCallPending: boolean;
  waiterCalledAt: string | null;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTablePayload {
  numero: number;
  nome: string;
  coperti: number;
  attivo: boolean;
}

export interface BulkRestaurantTablePayload {
  count: number;
  coperti: number;
  startingNumber?: number | null;
  namePrefix?: string | null;
  attivo: boolean;
}
