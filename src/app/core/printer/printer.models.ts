export interface PrintOrder {
  orderId: number;
  tableName: string;
  createdAt: string;
  items: PrintOrderItem[];
}

export interface PrintOrderItem {
  quantity: number;
  name: string;
  status?: 'NEW' | 'PRINTED';
  notes?: string;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}
