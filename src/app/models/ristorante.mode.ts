export interface Ristorante {
  id: number;
  nome: string;
  email?: string;
  address?: string | null;
  city?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  allowedRadiusMeters?: number | null;
}
