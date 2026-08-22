import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { LandingHeaderComponent } from './landing-header.component';
import { LandingFooterComponent } from './landing-footer.component';

@Component({ selector: 'app-landing', standalone: true, imports: [CommonModule, FormsModule, LandingHeaderComponent, LandingFooterComponent], templateUrl: './landing.component.html' })
export class LandingComponent implements OnInit {
  private readonly title = inject(Title); private readonly meta = inject(Meta);
  formNotice = '';
  ngOnInit(): void {
    this.title.setTitle('WaiterO | Ordini al tavolo semplici e veloci');
    this.meta.updateTag({ name: 'description', content: 'WaiterO permette ai clienti di consultare il menu e ordinare direttamente dal proprio smartphone tramite QR code, semplificando la gestione del servizio per ristoranti e pub.' });
  }
  submitDemo(form: NgForm): void {
    this.formNotice = form.invalid ? 'Controlla i campi obbligatori prima di continuare.' : 'Il modulo è pronto: il canale di invio commerciale sarà collegato prossimamente. Per ora contatta direttamente il team WaiterO.';
  }
}
