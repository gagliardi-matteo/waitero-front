import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { authGuard } from './auth/AuthGuard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  {
    path: 'menu-management',
    loadComponent: () => import('./pages/menu-management/menu-management.component').then(m => m.MenuManagementComponent),
    canActivate: [authGuard]
  },
  {
    path: 'add-dish',
    loadComponent: () => import('./pages/aggiungi-piatto/aggiungi-piatto.component').then(m => m.AddDishComponent),
    canActivate: [authGuard]
  },
  {
    path: 'ristoratore/piatto/modifica/:id',
    loadComponent: () =>import('./pages/modifica-piatto/modifica-piatto.component').then(m => m.ModificaPiattoComponent),
    canActivate: [authGuard],
  },
  {
  path: 'menu/:restaurantId/:tableId/:token',
    loadComponent: () => import('./pages/menu/menu.component').then(m => m.MenuComponent)
  }
  // altre rotte (es. menu)...
];
