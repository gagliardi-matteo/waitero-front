import { Component, OnInit } from '@angular/core';
import { Piatto } from '../../models/piatto.model';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthContextService } from '../../services/auth-context.service';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-dettaglio-piatto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dettaglio-piatto.component.html',
  styleUrl: './dettaglio-piatto.component.scss'
})
export class DettaglioPiattoComponent implements OnInit{

  piatto!: Piatto;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthContextService,
    private router: Router,
    private orderService: OrderService
  ){}


  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('dishId');
    if (!id) return;

    this.http.get<Piatto>(`${environment.apiUrl}/customer/dettaglio-piatto/${id}`)
      .subscribe(p => this.piatto = p);
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    return (!imageUrl || imageUrl.trim() === '') ? '/placeholder.png' :
      `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  add() {
    this.orderService.add(this.piatto);
  }

  remove() {
    this.orderService.remove(this.piatto);
  }

  quantita(): number {
    return this.orderService.quantita(this.piatto.id);
  }

  addToCart() {
    this.router.navigate(['/menu']);
  }

  goBack() {
    this.router.navigate(['/menu']);
  }
}
