import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from './util/sidebar/sidebar.component';
import { AuthService } from './auth/AuthService';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly backofficeRoutes = [
    '/admin',
    '/orders',
    '/orders-history',
    '/tables-dashboard',
    '/analytics',
    '/waiter-order',
    '/menu-management',
    '/tables',
    '/restaurant-settings',
    '/add-dish',
    '/ristoratore/'
  ];

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  showSidebar(): boolean {
    return this.isLoggedIn() && this.isBackofficeRoute();
  }

  isCustomerMenuRoute(): boolean {
    const url = this.router.url.toLowerCase();
    return url === '/menu' || url.startsWith('/menu/');
  }

  showImpersonationBanner(): boolean {
    return this.showSidebar() && this.authService.isImpersonating();
  }

  getImpersonationRestaurantName(): string {
    return this.authService.getImpersonatedRestaurantName() ?? 'ristorante selezionato';
  }

  async exitImpersonation(): Promise<void> {
    await this.authService.stopImpersonation();
    if (this.authService.isMaster()) {
      await this.router.navigate(['/admin/restaurants']);
    }
  }

  private isBackofficeRoute(): boolean {
    const url = this.router.url.toLowerCase();
    return this.backofficeRoutes.some(route => url === route || url.startsWith(route));
  }
}
