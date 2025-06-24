import { Component, Input } from '@angular/core';
import { Piatto } from '../../models/piatto.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss']
})
export class OrderSummaryComponent {
  @Input() piatti: Piatto[] = [];
  @Input() restaurantId!: string;
  @Input() tableId!: string;

  isExpanded = false;

  get totale(): number {
    return this.piatti.reduce((acc, piatto) => acc + piatto.prezzo, 0);
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  confermaOrdine(event: Event) {
    event.stopPropagation();
    // TODO: invio ordine
    console.log('Ordine confermato!', this.piatti);
  }

  aggiungi(piatto: Piatto) {
    this.piatti.push(piatto);
  }

  rimuovi(piatto: Piatto) {
    const index = this.piatti.findIndex(p => p.id === piatto.id);
    if (index >= 0) this.piatti.splice(index, 1);
  }

  quantita(id: number): number {
    return this.piatti.filter(p => p.id === id).length;
  }

  get piattiRaggruppati(): Piatto[] {
    const mappa = new Map<number, Piatto>();
    this.piatti.forEach(p => {
      if (!mappa.has(p.id)) {
        mappa.set(p.id, p);
      }
    });
    return Array.from(mappa.values());
  }

}
