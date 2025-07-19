import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { Piatto } from '../../models/piatto.model';
import { OrderSummaryComponent } from '../order-summary/order-summary.component';
import { Ristorante } from '../../models/ristorante.mode';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, OrderSummaryComponent, NgFor, NgIf],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit {
  restaurantId: string = '';
  tableId: string = '';
  piatti: Piatto[] = [];
  ordine: Piatto[] = [];
  piattiRaggruppati: [string, Piatto[]][] = [];
  ristoranteObj!: Ristorante;

  readonly categoriaOrder: string[] = [
    'ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'BEVANDA'
  ];

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const restaurantId = this.route.snapshot.paramMap.get('restaurantId');
    const tableId = this.route.snapshot.paramMap.get('tableId');
    const token = this.route.snapshot.paramMap.get('token');

    if (!restaurantId || !tableId || !token) return;

    this.http.post<{ valid: boolean }>(`${environment.apiUrl}/customer/validate-token`, {
      token, restaurantId, tableId
    }).subscribe(res => {
      if (!res.valid) return;
      this.restaurantId = restaurantId;
      this.tableId = tableId;
      this.loadPiatti();
      if (typeof window !== 'undefined') {
        history.replaceState(null, '', `/menu/${restaurantId}/${tableId}`);
      }
      this.http.get<Ristorante>(`${environment.apiUrl}/customer/ristorante/${this.restaurantId}`)
      .subscribe(data => {
        this.ristoranteObj = data;
      })
    });

  }

  loadPiatti() {
    this.http.get<Piatto[]>(`${environment.apiUrl}/customer/menu/piatti/${this.restaurantId}`)
      .subscribe(data => {
        this.piatti = data;
        this.piattiRaggruppati = this.raggruppaPerCategoria(data);
      });
  }

  private raggruppaPerCategoria(piatti: Piatto[]): [string, Piatto[]][] {
    const map = new Map<string, Piatto[]>();
    for (const piatto of piatti) {
      const cat = (piatto.categoria ?? 'SENZA CATEGORIA').toUpperCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(piatto);
    }
    return this.categoriaOrder.filter(cat => map.has(cat)).map(cat => [cat, map.get(cat)!]);
  }

  categoriaLabel(cat: string): string {
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }  

  addToOrder(piatto: Piatto) {
    this.ordine.push(piatto);
  }

  removeFromOrder(piatto: Piatto) {
    const index = this.ordine.findIndex(p => p.id === piatto.id);
    if (index >= 0) this.ordine.splice(index, 1);
  }

  quantita(itemId: number): number {
    return this.ordine.filter(p => p.id === itemId).length;
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    return (!imageUrl || imageUrl.trim() === '') ? '/placeholder.png' :
      `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  trackById(index: number, item: any): any {
    return item.id;
  }

  openDettaglio(piatto: Piatto): void {
    console.log('Dettaglio piatto:', piatto);
  }

  scrollToCategory(categoria: string) {
    const id = 'cat-' + categoria;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }


}
