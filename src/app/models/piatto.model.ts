export interface Piatto {
  id: number;
  nome: string;
  descrizione: string;
  prezzo: number;
  disponibile: boolean;
  categoria: string;
  imageUrl: string | null;
  ingredienti?: string;
  allergeni?: string;
}
