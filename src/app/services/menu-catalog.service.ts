import { Injectable } from '@angular/core';
import { Piatto } from '../models/piatto.model';

@Injectable({ providedIn: 'root' })
export class MenuCatalogService {
  private catalogs = new Map<string, Piatto[]>();

  setCatalog(restaurantId: string, piatti: Piatto[]): void {
    this.catalogs.set(restaurantId, [...piatti]);
  }

  getCatalog(restaurantId: string): Piatto[] {
    return [...(this.catalogs.get(restaurantId) ?? [])];
  }
}
