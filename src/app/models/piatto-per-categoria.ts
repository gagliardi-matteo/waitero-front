import { CategoriaEnum } from "./categorie.enum";
import { Piatto } from "./piatto.model";

export interface PiattoPerCategoria {
  categoria: CategoriaEnum;
  piatti: Piatto[];
}