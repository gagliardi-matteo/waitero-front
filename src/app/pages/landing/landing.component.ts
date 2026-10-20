import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  private readonly document = inject(DOCUMENT);
  goToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    const section = this.document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const view = this.document.defaultView;
    view?.history.replaceState(view.history.state, '', '#' + sectionId);
  }
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
      error: (error: HttpErrorResponse) => {
        this.formSuccess = false;
        if (error.status === 400) {
          this.formNotice = 'Controlla i dati inseriti e la lunghezza del messaggio, poi riprova.';
        } else if (error.status === 429) {
          this.formNotice = 'Hai raggiunto il limite di richieste. Riprova più tardi o scrivi a info@waiter-o.com.';
        } else {
          this.formNotice = 'Non è stato possibile inviare la richiesta. I dati sono ancora nel modulo: riprova oppure scrivi a info@waiter-o.com.';
        }
      }
    });
  }
}
