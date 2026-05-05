import { BusinessType } from './business-type.model';

export interface Ristorante {
  id: number;
  businessType?: BusinessType | null;
  nome: string;
  email?: string;
  address?: string | null;
  city?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  allowedRadiusMeters?: number | null;
}
