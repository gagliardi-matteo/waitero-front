export interface RestaurantTable {
  id: number;
  restaurantId: number;
  tablePublicId: string;
  numero: number;
  nome: string;
  coperti: number;
  attivo: boolean;
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
