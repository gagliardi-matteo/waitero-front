import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type LegalDocumentKey = 'contratto-saas' | 'privacy-policy' | 'termini-uso';

interface LegalDocument {
  title: string;
  version: string;
  sections: Array<{ heading: string; body: string }>;
}

const DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  'contratto-saas': {
    title: 'Contratto SaaS WaiterO',
    version: '1.0',
    sections: [
      { heading: 'Oggetto', body: 'Il presente documento disciplina l utilizzo del servizio WaiterO da parte del ristoratore.' },
      { heading: 'Servizio', body: 'WaiterO fornisce strumenti digitali per gestione menu, tavoli, ordini e funzionalita operative collegate.' },
      { heading: 'Responsabilita', body: 'Il ristoratore resta responsabile dei dati inseriti, della correttezza del menu e del rapporto con i propri clienti.' }
    ]
  },
  'privacy-policy': {
    title: 'Privacy Policy WaiterO',
    version: '1.0',
    sections: [
      { heading: 'Titolare e finalita', body: 'I dati sono trattati per erogare il servizio WaiterO, gestire accessi, ordini, sicurezza e obblighi amministrativi.' },
      { heading: 'Cliente QR', body: 'Il cliente accede senza account. Vengono trattati solo dati tecnici minimi necessari alla sessione e alla sicurezza del tavolo.' },
      { heading: 'Conservazione', body: 'I dati sono conservati per il tempo necessario alle finalita operative, legali e di sicurezza.' }
    ]
  },
  'termini-uso': {
    title: 'Termini d Uso WaiterO',
    version: '1.0',
    sections: [
      { heading: 'Accesso cliente', body: 'Il cliente puo accedere al menu tramite QR senza registrazione e usare il servizio nel rispetto del locale e del sistema.' },
      { heading: 'Ordini', body: 'Gli ordini inviati tramite WaiterO sono destinati al ristoratore che gestisce preparazione, conferma e pagamento.' },
      { heading: 'Uso corretto', body: 'Non e consentito usare il servizio per finalita abusive, fraudolente o non collegate all esperienza presso il tavolo.' }
    ]
  }
};

@Component({
  selector: 'app-legal-document',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="legal-page">
      <article class="legal-card">
        <p class="eyebrow">WaiterO · versione {{ document.version }}</p>
        <h1>{{ document.title }}</h1>
        <section *ngFor="let section of document.sections">
          <h2>{{ section.heading }}</h2>
          <p>{{ section.body }}</p>
        </section>
      </article>
    </main>
  `,
  styles: [`
    .legal-page {
      min-height: 100vh;
      padding: 2rem 1rem;
      background: #fbf8f3;
      color: #151821;
    }

    .legal-card {
      width: min(820px, 100%);
      margin: 0 auto;
      padding: 2rem;
      border: 1px solid #e7ded3;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 18px 40px rgba(21, 24, 33, 0.08);
    }

    .eyebrow {
      margin: 0 0 0.6rem;
      color: #7d6f62;
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    h1 {
      margin: 0 0 1.4rem;
      font-size: 2rem;
      line-height: 1.1;
    }

    section + section {
      margin-top: 1.2rem;
    }

    h2 {
      margin: 0 0 0.4rem;
      font-size: 1rem;
    }

    p {
      margin: 0;
      line-height: 1.6;
      color: #4f5663;
    }
  `]
})
export class LegalDocumentComponent {
  private route = inject(ActivatedRoute);

  get document(): LegalDocument {
    const key = this.route.snapshot.paramMap.get('document') as LegalDocumentKey | null;
    return key && DOCUMENTS[key] ? DOCUMENTS[key] : DOCUMENTS['privacy-policy'];
  }
}
