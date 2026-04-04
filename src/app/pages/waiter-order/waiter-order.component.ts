import { CommonModule, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerOrder } from '../../models/customer-order.model';
import { Piatto } from '../../models/piatto.model';
import { RestaurantTable } from '../../models/table.model';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { TableService } from '../../services/table.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-waiter-order',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NgIf, NgFor, DecimalPipe],
  templateUrl: './waiter-order.component.html',
  styleUrl: './waiter-order.component.scss'
})
export class WaiterOrderComponent implements OnInit {
  tables: RestaurantTable[] = [];
  dishes: Piatto[] = [];
  selectedTableId: number | null = null;
  selectedCategory = 'ALL';
  loading = true;
  saving = false;
  errorMessage = '';
  quantities: Record<number, number> = {};

  private http = inject(HttpClient);
  private tableService = inject(TableService);
  private ordersService = inject(RestaurantOrderService);
  private router = inject(Router);

  readonly categoriaOrder: string[] = ['ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'BEVANDA'];

  ngOnInit(): void {
    forkJoin({
      tables: this.tableService.getTables(),
      dishes: this.http.get<Piatto[]>(`${environment.apiUrl}/menu/piatti`)
    }).subscribe({
      next: ({ tables, dishes }) => {
        this.tables = tables.filter(table => table.attivo).sort((a, b) => a.numero - b.numero);
        this.dishes = dishes.filter(dish => dish.disponibile !== false);
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento dati comanda cameriere', err);
        this.errorMessage = 'Impossibile caricare tavoli o menu.';
        this.loading = false;
      }
    });
  }

  get categories(): string[] {
    const set = new Set<string>(this.dishes.map(dish => (dish.categoria || 'ALTRO').toUpperCase()));
    const sorted = Array.from(set).sort((a, b) => {
      const indexA = this.categoriaOrder.indexOf(a);
      const indexB = this.categoriaOrder.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
    return ['ALL', ...sorted];
  }

  get filteredDishes(): Piatto[] {
    return this.dishes
      .filter(dish => this.selectedCategory === 'ALL' || (dish.categoria || 'ALTRO').toUpperCase() === this.selectedCategory)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  get groupedDishes(): [string, Piatto[]][] {
    const groups = new Map<string, Piatto[]>();
    for (const dish of this.dishes) {
      const category = (dish.categoria || 'ALTRO').toUpperCase();
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(dish);
    }

    return Array.from(groups.entries())
      .sort((a, b) => {
        const indexA = this.categoriaOrder.indexOf(a[0]);
        const indexB = this.categoriaOrder.indexOf(b[0]);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
      .map(([category, items]) => [category, items.sort((a, b) => a.nome.localeCompare(b.nome))]);
  }

  get selectedItems() {
    return this.dishes
      .map(dish => ({ dish, quantity: this.getQuantity(dish.id) }))
      .filter(item => item.quantity > 0);
  }

  get total(): number {
    return this.selectedItems.reduce((sum, item) => sum + (item.dish.prezzo * item.quantity), 0);
  }

  get totalItems(): number {
    return this.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  get selectedTable(): RestaurantTable | undefined {
    return this.tables.find(table => table.id === this.selectedTableId);
  }

  selectTable(tableId: number): void {
    this.selectedTableId = tableId;
  }

  increase(dish: Piatto): void {
    this.quantities[dish.id] = this.getQuantity(dish.id) + 1;
  }

  decrease(dish: Piatto): void {
    const next = this.getQuantity(dish.id) - 1;
    this.quantities[dish.id] = Math.max(next, 0);
  }

  getQuantity(dishId: number): number {
    return this.quantities[dishId] ?? 0;
  }

  submit(): void {
    if (!this.selectedTableId) {
      this.errorMessage = 'Seleziona un tavolo.';
      return;
    }
    if (this.selectedItems.length === 0) {
      this.errorMessage = 'Aggiungi almeno un piatto.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.ordersService.createManualOrder({
      tableId: this.selectedTableId,
      items: this.selectedItems.map(item => ({ dishId: item.dish.id, quantity: item.quantity }))
    }).subscribe({
      next: (order: CustomerOrder) => {
        this.quantities = {};
        this.saving = false;
        this.router.navigate(['/orders', order.id]);
      },
      error: err => {
        console.error('Errore invio comanda cameriere', err);
        this.errorMessage = err.error?.message ?? 'Invio comanda non riuscito.';
        this.saving = false;
      }
    });
  }

  trackDish(index: number, dish: Piatto): number {
    return dish.id;
  }
}
