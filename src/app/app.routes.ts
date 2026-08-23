import { Routes } from '@angular/router';
import { authGuard, loginGuard, masterGuard } from './auth/AuthGuard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent), pathMatch: 'full' },
  { path: 'demo', loadComponent: () => import('./pages/demo/demo-hub.component').then(m => m.DemoHubComponent) },
  { path: 'demo/cliente', loadComponent: () => import('./pages/demo/demo-client-page.component').then(m => m.DemoClientPageComponent) },
  { path: 'demo/cliente/piatto/:dishId', loadComponent: () => import('./pages/demo/demo-dish-detail-page.component').then(m => m.DemoDishDetailPageComponent) },
  { path: 'demo/ristorante', loadComponent: () => import('./pages/demo/demo-restaurant-page.component').then(m => m.DemoRestaurantPageComponent) },
  { path: 'demo/ristorante/ordini/:id', loadComponent: () => import('./pages/demo/demo-order-detail-page.component').then(m => m.DemoOrderDetailPageComponent) },
  { path: 'login', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent), canActivate: [loginGuard] },
  { path: 'legal/:document', loadComponent: () => import('./pages/legal-document/legal-document.component').then(m => m.LegalDocumentComponent) },
  {
    path: 'admin/restaurants',
    loadComponent: () => import('./pages/admin-restaurants/admin-restaurants.component').then(m => m.AdminRestaurantsComponent),
    canActivate: [masterGuard]
  },
  {
    path: 'admin/billing',
    loadComponent: () => import('./pages/admin-billing/admin-billing.component').then(m => m.AdminBillingComponent),
    canActivate: [masterGuard]
  },
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
    path: 'printer-settings',
    loadComponent: () => import('./pages/printer-settings/printer-settings.component').then(m => m.PrinterSettingsComponent),
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
    path: 'menu/bloccato',
    loadComponent: () => import('./pages/menu-blocked/menu-blocked.component').then(m => m.MenuBlockedComponent)
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

