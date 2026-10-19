import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, catchError, EMPTY, exhaustMap, timer } from 'rxjs';
import { OrdersActiveComponent } from '../orders-active/orders-active.component';
import { DemoBannerComponent } from './demo-banner.component';
import { DemoSessionService, DemoWaiterCall } from '../../services/demo-session.service';
import { BackofficeEventService } from '../../services/backoffice-event.service';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { WaiterAlertAudioService } from '../../services/waiter-alert-audio.service';

@Component({
  selector: 'app-demo-restaurant-page', standalone: true,
  imports: [CommonModule, RouterLink, OrdersActiveComponent, DemoBannerComponent],
  template: `
    <app-demo-banner/>
    <div *ngIf="loading" class="demo-state">Apertura dashboard demo…</div>
    <section *ngIf="expired" class="demo-expired">
      <h1>La demo è terminata</h1><p>Avvia una nuova sessione per continuare.</p>
      <a routerLink="/demo">Avvia nuova demo</a>
    </section>
    <main *ngIf="ready" class="demo-dashboard">
      <aside *ngIf="guideOpen" class="demo-guide">
        <button aria-label="Chiudi guida" (click)="guideOpen=false">×</button>
        <small>GUIDA RAPIDA</small>
        <h2>{{completed ? 'Questo era un solo tavolo.' : received ? '2. Ordine ricevuto!' : '1. Fai un ordine'}}</h2>
        <p>{{completed ? 'Immagina WaiterO nel tuo locale.' : received ?
          'Quello che stai vedendo è ciò che vedrebbe il personale del tuo locale. 3. Apri l’ordine e prova a gestirlo.' :
          'Scansiona il QR dall’hub e ordina qualcosa dal tuo smartphone.'}}</p>
        <a *ngIf="!received" routerLink="/demo">Mostra il QR</a>
        <a *ngIf="completed" routerLink="/" fragment="contatti">Richiedi una demo</a>
      </aside>
      <header class="demo-dashboard-head">
        <div><small>Dashboard reale</small><h1>Osteria WaiterO</h1></div><a routerLink="/demo">Hub demo</a>
      </header>
      <section *ngIf="waiterCallPending" class="demo-waiter-call" role="status" aria-live="polite">
        <div><strong>Il Tavolo Demo ha chiamato il cameriere</strong><p>Un cliente richiede assistenza al tavolo.</p></div>
        <button type="button" [disabled]="clearingWaiterCall" (click)="clearWaiterCall()">Segna come gestita</button>
      </section>
      <p *ngIf="waiterCallError" role="alert">{{waiterCallError}}</p>
      <app-orders-active/>
    </main>`,
  styleUrl: './demo.component.scss'
})
export class DemoRestaurantPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private sessions = inject(DemoSessionService);
  private events = inject(BackofficeEventService);
  private orders = inject(RestaurantOrderService);
  private audio = inject(WaiterAlertAudioService);
  private subscriptions = new Subscription();
  private lastCallAt: string | null = null;
  loading = true;
  expired = false;
  ready = false;
  received = false;
  completed = false;
  guideOpen = true;
  waiterCallPending = false;
  clearingWaiterCall = false;
  waiterCallError = '';

  ngOnInit(): void {
    this.subscriptions.add(this.sessions.current(this.route.snapshot.queryParamMap.get('s')).subscribe({
      next: () => {
        this.ready = true;
        this.loading = false;
        this.subscriptions.add(this.orders.getActiveOrderSummaries().subscribe(values => this.received = values.length > 0));
        this.subscriptions.add(this.events.ordersUpdated$.subscribe(event => {
          if (event.payload?.orderId) this.received = true;
          if (event.payload?.status === 'PAGATO') this.completed = true;
          if (!event.payload || event.payload.type === 'WAITER_CALLED' || event.payload.type === 'WAITER_CALL_CLEARED') {
            this.refreshWaiterCall();
          }
        }));
        this.events.start();
        this.subscriptions.add(timer(0, 5000).pipe(
          exhaustMap(() => this.sessions.waiterCall().pipe(catchError(() => EMPTY)))
        ).subscribe(call => this.applyWaiterCall(call)));
      },
      error: () => { this.loading = false; this.expired = true; }
    }));
  }

  clearWaiterCall(): void {
    if (this.clearingWaiterCall) return;
    this.clearingWaiterCall = true;
    this.waiterCallError = '';
    this.subscriptions.add(this.sessions.clearWaiterCall().subscribe({
      next: () => { this.clearingWaiterCall = false; this.refreshWaiterCall(); },
      error: () => { this.clearingWaiterCall = false; this.waiterCallError = 'Chiamata non aggiornata. Riprova.'; }
    }));
  }

  private refreshWaiterCall(): void {
    this.subscriptions.add(this.sessions.waiterCall().subscribe({
      next: call => this.applyWaiterCall(call), error: () => {}
    }));
  }

  private applyWaiterCall(call: DemoWaiterCall): void {
    if (call.pending && (!this.waiterCallPending || call.calledAt !== this.lastCallAt)) {
      void this.audio.playWaiterCallAlert();
    }
    this.waiterCallPending = call.pending;
    this.lastCallAt = call.calledAt;
  }

  ngOnDestroy(): void { this.subscriptions.unsubscribe(); this.events.stop(); }
}
