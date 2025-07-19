import { Injectable } from '@angular/core';
import { Piatto } from '../models/piatto.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private ordine: Piatto[] = [];

  getOrdine(): Piatto[] {
    return this.ordine;
  }

  add(piatto: Piatto) {
    this.ordine.push(piatto);
  }

  remove(piatto: Piatto) {
    const i = this.ordine.findIndex(p => p.id === piatto.id);
    if (i >= 0) this.ordine.splice(i, 1);
  }

  quantita(id: number): number {
    return this.ordine.filter(p => p.id === id).length;
  }

  clear() {
    this.ordine = [];
  }
}
