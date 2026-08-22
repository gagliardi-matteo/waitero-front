import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-footer', standalone: true, imports: [RouterLink],
  template: `<footer class="landing-footer"><div class="landing-shell footer-grid"><div><a class="landing-brand landing-brand--footer" href="#top" aria-label="WaiterO, torna all'inizio"><span class="landing-brand-mark"><img src="assets/brand/logo_w.svg" alt="" /></span><span>WaiterO</span></a><p>Il servizio al tavolo, nelle mani di chi lo vive.</p></div><nav aria-label="Link nel footer"><a routerLink="/legal/privacy">Privacy Policy</a><a routerLink="/legal/terms">Termini di utilizzo</a><a href="#contatti">Contatti</a></nav></div><div class="landing-shell footer-bottom">© {{ currentYear }} WaiterO</div></footer>`
})
export class LandingFooterComponent { readonly currentYear = new Date().getFullYear(); }
