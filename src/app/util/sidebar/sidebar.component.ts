import { CommonModule, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/AuthService';

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
export class SidebarComponent {
  private router = inject(Router);

  readonly primaryItems: NavItem[] = [
    { label: 'Sala', icon: 'dashboard', route: '/tables-dashboard' },
    { label: 'Analytics', icon: 'monitoring', route: '/analytics' },
    { label: 'Comanda', icon: 'playlist_add', route: '/waiter-order' },
    { label: 'Ordini', icon: 'receipt_long', route: '/orders' },
    { label: 'Menu', icon: 'local_dining', route: '/menu-management' }
  ];

  readonly secondaryItems: NavItem[] = [
    { label: 'Storico ordini', icon: 'history', route: '/orders-history' },
    { label: 'Tavoli', icon: 'table_restaurant', route: '/tables' },
    { label: 'Locale', icon: 'storefront', route: '/restaurant-settings' }
  ];

  mobileMoreOpen = false;

  constructor(public authService: AuthService) {}

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  isRouteActive(route: string): boolean {
    return this.router.url === route;
  }

  hasSecondaryActiveRoute(): boolean {
    return this.secondaryItems.some(item => this.isRouteActive(item.route));
  }

  toggleMobileMore(): void {
    this.mobileMoreOpen = !this.mobileMoreOpen;
  }

  closeMobileMore(): void {
    this.mobileMoreOpen = false;
  }
}
