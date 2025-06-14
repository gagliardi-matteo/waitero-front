export interface CategoriaPiatto {
  id: number;
  nome: string;
}

export interface PiattoDTO {
  id: number;
  nome: string;
  descrizione: string;
  prezzo: number;
  disponibile: boolean;
  categoriaId: number;
}
