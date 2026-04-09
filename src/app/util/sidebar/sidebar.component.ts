import { CommonModule, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/AuthService';
import { RestaurantSettingsService } from '../../services/restaurant-settings.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [NgIf, CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  private restaurantSettingsService = inject(RestaurantSettingsService);

  readonly ownerPrimaryItems: NavItem[] = [
    { label: 'Sala', icon: 'dashboard', route: '/tables-dashboard' },
    { label: 'Analytics', icon: 'monitoring', route: '/analytics' },
    { label: 'Comanda', icon: 'playlist_add', route: '/waiter-order' },
    { label: 'Ordini', icon: 'receipt_long', route: '/orders' },
    { label: 'Menu', icon: 'local_dining', route: '/menu-management' }
  ];

  readonly ownerSecondaryItems: NavItem[] = [
    { label: 'Storico ordini', icon: 'history', route: '/orders-history' },
    { label: 'Tavoli', icon: 'table_restaurant', route: '/tables' },
    { label: 'Locale', icon: 'storefront', route: '/restaurant-settings' }
  ];

  readonly masterPrimaryItems: NavItem[] = [
    { label: 'Ristoranti', icon: 'store', route: '/admin/restaurants' }
  ];

  readonly masterImpersonatingSecondaryItems: NavItem[] = [
    { label: 'Console master', icon: 'shield_person', route: '/admin/restaurants' }
  ];

  mobileMoreOpen = false;
  restaurantName = '';

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    this.loadRestaurantName();
  }

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  get primaryItems(): NavItem[] {
    if (this.authService.isMaster() && !this.authService.isImpersonating()) {
      return this.masterPrimaryItems;
    }
    return this.ownerPrimaryItems;
  }

  get secondaryItems(): NavItem[] {
    if (this.authService.isMaster() && !this.authService.isImpersonating()) {
      return [];
    }
    if (this.authService.isMaster()) {
      return [...this.masterImpersonatingSecondaryItems, ...this.ownerSecondaryItems];
    }
    return this.ownerSecondaryItems;
  }

  get brandTitle(): string {
    if (this.authService.isMaster() && !this.authService.isImpersonating()) {
      return 'WaiterO';
    }

    return this.authService.getImpersonatedRestaurantName() || this.restaurantName || 'Ristorante';
  }

  get brandCaption(): string {
    if (this.authService.isMaster() && !this.authService.isImpersonating()) {
      return 'Console master';
    }
    if (this.authService.isMaster()) {
      return 'Master in impersonazione';
    }
    return 'Backoffice ristorante';
  }

  get footerLabel(): string {
    return this.authService.isMaster() ? 'Supporto operativo' : 'Pannello operativo';
  }

  get mobileGridColumns(): string {
    const columns = this.primaryItems.length + (this.secondaryItems.length > 0 ? 1 : 0);
    return `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))`;
  }

  isRouteActive(route: string): boolean {
    return this.router.url === route;
  }

  hasSecondaryActiveRoute(): boolean {
    return this.secondaryItems.some(item => this.isRouteActive(item.route));
  }

  toggleMobileMore(): void {
    if (this.secondaryItems.length === 0) {
      return;
    }
    this.mobileMoreOpen = !this.mobileMoreOpen;
  }

  closeMobileMore(): void {
    this.mobileMoreOpen = false;
  }

  private loadRestaurantName(): void {
    if (!this.authService.isAuthenticated() || (this.authService.isMaster() && !this.authService.isImpersonating())) {
      return;
    }

    const impersonatedRestaurantName = this.authService.getImpersonatedRestaurantName();
    if (impersonatedRestaurantName) {
      this.restaurantName = impersonatedRestaurantName;
      return;
    }

    this.restaurantSettingsService.getSettings().subscribe({
      next: settings => {
        this.restaurantName = settings.nome;
      },
      error: err => {
        console.error('Errore caricamento nome ristorante:', err);
      }
    });
  }
}
