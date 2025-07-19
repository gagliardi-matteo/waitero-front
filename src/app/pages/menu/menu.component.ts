import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { Piatto } from '../../models/piatto.model';
import { OrderSummaryComponent } from '../order-summary/order-summary.component';
import { Ristorante } from '../../models/ristorante.mode';
import { environment } from '../../../environments/environment';
import { AuthContextService } from '../../services/auth-context.service';
import { OrderService } from '../../services/order.service';

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
  piattiRaggruppati: [string, Piatto[]][] = [];
  ristoranteObj!: Ristorante;
  token!: string;

  readonly categoriaOrder: string[] = [
    'ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'BEVANDA'
  ];

  constructor(private orderService: OrderService, private auth: AuthContextService, private http: HttpClient, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    const token = this.auth.tokenValue;
    const restaurantId = this.auth.restaurantIdValue;
    const tableId = this.auth.tableIdValue;

    if (!token || !restaurantId || !tableId) {
      this.router.navigate(['/login']);
      return;
    }
    

    if (!restaurantId || !tableId || !token) return;

    this.restaurantId = restaurantId;
    this.tableId = tableId;
    this.loadPiatti();
    /*if (typeof window !== 'undefined') {
      history.replaceState(null, '', `/menu/${restaurantId}/${tableId}`);
    }*/
    this.http.get<Ristorante>(`${environment.apiUrl}/customer/ristorante/${this.restaurantId}`)
    .subscribe(data => {
      this.ristoranteObj = data;
      })

  }

  get ordine(): Piatto[] {
    return this.orderService.getOrdine();
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
    this.orderService.add(piatto);
  }

  removeFromOrder(piatto: Piatto) {
    this.orderService.remove(piatto);
  }

  quantita(itemId: number): number {
    return this.orderService.quantita(itemId);
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    return (!imageUrl || imageUrl.trim() === '') ? '/placeholder.png' :
      `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  trackById(index: number, item: any): any {
    return item.id;
  }

  openDettaglio(piatto: Piatto): void {
    this.router.navigate(['menu/piatto/', piatto.id]);
  }

  scrollToCategory(categoria: string) {
    const id = 'cat-' + categoria;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  


}
