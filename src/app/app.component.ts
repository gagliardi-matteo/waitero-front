import { Component, OnDestroy, effect, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/AuthService';
import { RestaurantOrderService } from './services/restaurant-order.service';
import { MobileNativeService } from './services/mobile-native.service';
import { OrientationLockService } from './services/orientation-lock.service';
import { WaiterAlertAudioService } from './services/waiter-alert-audio.service';
import { WaiterCallNotificationService } from './services/waiter-call-notification.service';
import { SidebarComponent } from './util/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private mobileNativeService = inject(MobileNativeService);
  private orientationLockService = inject(OrientationLockService);
  private restaurantOrderService = inject(RestaurantOrderService);
  private waiterAlertAudioService = inject(WaiterAlertAudioService);
  private waiterCallNotificationService = inject(WaiterCallNotificationService);
  private eventSource: EventSource | null = null;

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

  constructor() {
    void this.mobileNativeService.initialize();
    this.orientationLockService.initialize();

    effect(() => {
      if (this.authService.authenticated() && this.canSubscribeToBackofficeStream()) {
        this.connectBackofficeStream();
      } else {
        this.disconnectBackofficeStream();
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnectBackofficeStream();
  }

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
    return this.authService.getImpersonatedRestaurantName() ?? 'locale selezionato';
  }

  async exitImpersonation(): Promise<void> {
    await this.authService.stopImpersonation();
    if (this.authService.isMaster()) {
      await this.router.navigate(['/admin/restaurants']);
    }
  }

  isBackofficeRoute(): boolean {
    const url = this.router.url.toLowerCase();
    return this.backofficeRoutes.some(route => url === route || url.startsWith(route));
  }

  private canSubscribeToBackofficeStream(): boolean {
    return !!this.authService.getToken()
      && (this.authService.getActingRestaurantId() !== null || this.authService.getOwnedRestaurantId() !== null);
  }

  private connectBackofficeStream(): void {
    if (this.eventSource) {
      return;
    }

    const eventSource = this.restaurantOrderService.connectToStream();
    if (!eventSource) {
      return;
    }

    eventSource.addEventListener('orders-updated', event => {
      const payload = this.parseOrderEvent(event);
      if (payload?.type === 'WAITER_CALLED' && payload.restaurantId && payload.tableId) {
        this.waiterCallNotificationService.markWaiterCall(payload.restaurantId, payload.tableId);
        void this.waiterAlertAudioService.playWaiterCallAlert();
        return;
      }

      if (payload?.type === 'ORDER_UPDATED') {
        void this.waiterAlertAudioService.playNewOrderAlert();
      }
    });

    eventSource.addEventListener('error', () => {
      this.disconnectBackofficeStream();
    });

    this.eventSource = eventSource;
  }

  private disconnectBackofficeStream(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.waiterCallNotificationService.clearAll();
  }

  private parseOrderEvent(event: Event): { type?: string; restaurantId?: number; tableId?: number } | null {
    const data = (event as MessageEvent<string>).data;
    if (!data || typeof data !== 'string') {
      return null;
    }

    try {
      return JSON.parse(data) as { type?: string };
    } catch {
      return null;
    }
  }
}
