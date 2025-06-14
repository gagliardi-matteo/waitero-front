export interface Piatto {
  id: number;
  nome: string;
  descrizione: string;
  prezzo: number;
  disponibile: boolean;
  categoriaId: number;
}
