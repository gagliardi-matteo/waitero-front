import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../services/demo-session.service';
import { OrderDetailComponent } from '../order-detail/order-detail.component';
import { DemoBannerComponent } from './demo-banner.component';

@Component({
  selector: 'app-demo-order-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, OrderDetailComponent, DemoBannerComponent],
  template: `
    <app-demo-banner/>
    <div *ngIf='loading' class='demo-state'>Caricamento ordine demo…</div>
    <section *ngIf='expired' class='demo-expired'>
      <h1>La demo è terminata</h1>
      <p>Avvia una nuova sessione per continuare.</p>
      <a routerLink='/demo'>Avvia nuova demo</a>
    </section>
    <app-order-detail *ngIf='ready'/>
  `,
  styleUrl: './demo.component.scss'
})
export class DemoOrderDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private sessions = inject(DemoSessionService);

  loading = true;
  expired = false;
  ready = false;

  ngOnInit(): void {
    this.sessions.current(this.route.snapshot.queryParamMap.get('s')).subscribe({
      next: () => {
        this.ready = true;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.expired = true;
      }
    });
  }
}
