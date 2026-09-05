import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="landing-header"><div class="landing-shell header-inner">
      <a class="landing-brand" href="#top" aria-label="WaiterO, torna all'inizio"><span class="landing-brand-mark"><img src="assets/brand/logo_w.svg" alt="" /></span><span>WaiterO</span></a>
      <button class="menu-toggle" type="button" (click)="toggleMenu()" [attr.aria-expanded]="menuOpen" aria-controls="landing-nav" aria-label="Apri o chiudi il menu"><span></span><span></span><span></span></button>
      <nav id="landing-nav" class="landing-nav" [class.is-open]="menuOpen" aria-label="Navigazione principale">
        <a href="#come-funziona" (click)="goToSection($event, 'come-funziona')">Come funziona</a><a href="#perche" (click)="goToSection($event, 'perche')">Perché WaiterO</a><a href="#funzionalita" (click)="goToSection($event, 'funzionalita')">Funzionalità</a><a href="#ristoratori" (click)="goToSection($event, 'ristoratori')">Per i ristoratori</a><a href="#pricing" (click)="goToSection($event, 'pricing')">Pricing</a><a href="#contatti" (click)="goToSection($event, 'contatti')">Contatti</a>
        <a class="landing-login-link" routerLink="/login" (click)="closeMenu()">Accedi</a>
        <a class="landing-button landing-button--small" href="#contatti" (click)="goToSection($event, 'contatti')">Richiedi una demo</a>
      </nav>
    </div></header>`
})
export class LandingHeaderComponent {
  menuOpen = false;
  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
  closeMenu(): void { this.menuOpen = false; }
  goToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    this.closeMenu();
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + sectionId);
  }
  @HostListener('document:keydown.escape') onEscape(): void { this.closeMenu(); }
}
