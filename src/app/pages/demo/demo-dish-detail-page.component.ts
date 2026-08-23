import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthContextService } from '../../services/auth-context.service';
import { DemoSession, DemoSessionService } from '../../services/demo-session.service';
import { DeviceIdService } from '../../services/device-id.service';
import { DettaglioPiattoComponent } from '../dettaglio-piatto/dettaglio-piatto.component';
import { DemoBannerComponent } from './demo-banner.component';

@Component({
  selector: 'app-demo-dish-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DettaglioPiattoComponent, DemoBannerComponent],
  template: `
    <app-demo-banner/>
    <div *ngIf='loading' class='demo-state'>Caricamento dettaglio…</div>
    <section *ngIf='expired' class='demo-expired'>
      <h1>La demo è terminata</h1>
      <p>Avvia una nuova sessione per continuare a provare WaiterO.</p>
      <a routerLink='/demo'>Avvia nuova demo</a>
    </section>
    <app-dettaglio-piatto *ngIf='session'/>
  `,
  styleUrl: './demo.component.scss'
})
export class DemoDishDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private sessions = inject(DemoSessionService);
  private auth = inject(AuthContextService);
  private devices = inject(DeviceIdService);

  session: DemoSession | null = null;
  loading = true;
  expired = false;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('s');
    this.sessions.current(token).subscribe({
      next: session => {
        this.auth.setContext(
          session.token,
          String(session.restaurantId),
          String(session.tableId),
          this.devices.getOrCreate(),
          null,
          session.tablePublicId,
          false
        );
        this.session = session;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.expired = true;
      }
    });
  }
}
