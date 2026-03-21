export interface CustomerOrderItem {
  id: number;
  dishId: number;
  nome: string;
  prezzoUnitario: number;
  quantita: number;
  paidQuantity: number;
  remainingQuantity: number;
  subtotale: number;
  imageUrl: string | null;
}

export interface CustomerOrderPaymentAllocation {
  id: number;
  orderItemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CustomerOrderPayment {
  id: number;
  amount: number;
  paymentMode: string;
  participantName: string | null;
  createdAt: string;
  allocations: CustomerOrderPaymentAllocation[];
}

export interface CustomerDraftItem {
  dishId: number;
  quantity: number;
}

export interface CustomerDraft {
  restaurantId: number;
  tableId: number;
  items: CustomerDraftItem[];
}

export interface CustomerOrder {
  id: number;
  restaurantId: number;
  tableId: number;
  status: string;
  paymentMode: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  totale: number;
  paidAmount: number;
  remainingAmount: number;
  items: CustomerOrderItem[];
  payments: CustomerOrderPayment[];
}
