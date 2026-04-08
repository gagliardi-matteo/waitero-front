import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { authGuard } from './auth/AuthGuard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders-active/orders-active.component').then(m => m.OrdersActiveComponent),
    canActivate: [authGuard]
  },
  {
    path: 'orders-history',
    loadComponent: () => import('./pages/orders-history/orders-history.component').then(m => m.OrdersHistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'orders/:id',
    loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tables-dashboard',
    loadComponent: () => import('./pages/tables-dashboard/tables-dashboard.component').then(m => m.TablesDashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'analytics',
    loadComponent: () => import('./pages/analytics-dashboard/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'waiter-order',
    loadComponent: () => import('./pages/waiter-order/waiter-order.component').then(m => m.WaiterOrderComponent),
    canActivate: [authGuard]
  },
  {
    path: 'menu-management',
    loadComponent: () => import('./pages/menu-management/menu-management.component').then(m => m.MenuManagementComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tables',
    loadComponent: () => import('./pages/tables-management/tables-management.component').then(m => m.TablesManagementComponent),
    canActivate: [authGuard]
  },
  {
    path: 'restaurant-settings',
    loadComponent: () => import('./pages/restaurant-settings/restaurant-settings.component').then(m => m.RestaurantSettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'add-dish',
    loadComponent: () => import('./pages/aggiungi-piatto/aggiungi-piatto.component').then(m => m.AddDishComponent),
    canActivate: [authGuard]
  },
  {
    path: 'ristoratore/piatto/modifica/:id',
    loadComponent: () => import('./pages/modifica-piatto/modifica-piatto.component').then(m => m.ModificaPiattoComponent),
    canActivate: [authGuard],
  },
  {
    path: 'ristoratore/piatto/:dishId',
    loadComponent: () => import('./pages/dettaglio-piatto-ristoratore/dettaglio-piatto-ristoratore.component').then(m => m.DettaglioPiattoRistoratoreComponent),
    canActivate: [authGuard],
  },
  {
    path: 'menu/piatto/:dishId',
    loadComponent: () => import('./pages/dettaglio-piatto/dettaglio-piatto.component').then(m => m.DettaglioPiattoComponent)
  },
  {
    path: 'menu/:tablePublicId/:token',
    loadComponent: () => import('./pages/access/access.component').then(m => m.AccessComponent)
  },
  {
    path: 'menu/:restaurantId/:tableId/:token',
    loadComponent: () => import('./pages/access/access.component').then(m => m.AccessComponent)
  },
  {
    path: 'menu',
    loadComponent: () => import('./pages/menu/menu.component').then(m => m.MenuComponent)
  }
];


