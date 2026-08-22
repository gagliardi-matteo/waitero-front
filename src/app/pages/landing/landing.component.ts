import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LandingHeaderComponent } from './landing-header.component';
import { LandingFooterComponent } from './landing-footer.component';

@Component({ selector: 'app-landing', standalone: true, imports: [CommonModule, FormsModule, LandingHeaderComponent, LandingFooterComponent], templateUrl: './landing.component.html' })
export class LandingComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly http = inject(HttpClient);
  formNotice = '';
  formSuccess = false;
  sending = false;
  ngOnInit(): void {
    this.title.setTitle('WaiterO | Ordini al tavolo semplici e veloci');
    this.meta.updateTag({ name: 'description', content: 'WaiterO permette ai clienti di consultare il menu e ordinare direttamente dal proprio smartphone tramite QR code, semplificando la gestione del servizio per ristoranti e pub.' });
  }
  submitDemo(form: NgForm): void {
    if (form.invalid || this.sending) {
      form.control.markAllAsTouched();
      this.formSuccess = false;
      this.formNotice = 'Controlla i campi obbligatori prima di continuare.';
      return;
    }
    this.sending = true;
    this.formNotice = '';
    this.http.post<void>(environment.apiUrl + '/contact/demo', form.value).pipe(
      finalize(() => this.sending = false)
    ).subscribe({
      next: () => {
        this.formSuccess = true;
        this.formNotice = 'Richiesta inviata. Ti ricontatteremo il prima possibile.';
        form.resetForm();
      },
      error: () => {
        this.formSuccess = false;
        this.formNotice = 'Non è stato possibile inviare la richiesta. Riprova tra poco o scrivi a info@cdevia.com.';
      }
    });
  }
}
