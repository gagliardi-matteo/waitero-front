import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/AuthService';
import { environment } from '../../../environments/environment';
import { BusinessType, businessTypeLabel } from '../../models/business-type.model';
import { UiFeaturesService } from '../../services/ui-features.service';

interface AdminRestaurantSummary {
  id: number;
  businessType: BusinessType;
  nome: string;
  email: string;
  city?: string | null;
  createdAt?: string;
}

interface AdminAuditLog {
  id: string;
  masterUserId: number;
  restaurantId?: number | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface ImpersonationResponse {
  accessToken: string;
  actingRestaurantId: number;
  restaurantName: string;
}

interface CreateRestaurantForm {
  businessType: BusinessType;
  nome: string;
  email: string;
  password: string;
  address: string;
  city: string;
}

@Component({
  selector: 'app-admin-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-restaurants.component.html',
  styleUrl: './admin-restaurants.component.scss'
})
export class AdminRestaurantsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);
  private uiFeaturesService = inject(UiFeaturesService);

  searchTerm = '';
  loading = false;
  loadingAudit = false;
  creating = false;
  enteringRestaurantId: number | null = null;
  resettingRestaurantId: number | null = null;
  tooltipFeatureEnabled = true;
  tooltipFeatureSaving = false;
  errorMessage = '';
  successMessage = '';
  restaurants: AdminRestaurantSummary[] = [];
  auditLogs: AdminAuditLog[] = [];
  createForm: CreateRestaurantForm = this.emptyCreateForm();
  resetPasswords: Record<number, string> = {};

  ngOnInit(): void {
    this.loadUiFeatures();
    this.loadRestaurants();
    this.loadAuditLogs();
  }

  loadUiFeatures(): void {
    this.uiFeaturesService.getFeatures().subscribe(features => {
      this.tooltipFeatureEnabled = features.explainabilityBalloonsEnabled;
    });
  }

  loadRestaurants(): void {
    this.loading = true;
    this.errorMessage = '';

    const query = this.searchTerm.trim();
    const url = query
      ? `${environment.apiUrl}/admin/restaurants?q=${encodeURIComponent(query)}`
      : `${environment.apiUrl}/admin/restaurants`;

    this.http.get<AdminRestaurantSummary[]>(url).subscribe({
      next: restaurants => {
        this.restaurants = restaurants;
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento locali admin', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare i locali.';
        this.loading = false;
      }
    });
  }

  loadAuditLogs(): void {
    this.loadingAudit = true;
    this.http.get<AdminAuditLog[]>(`${environment.apiUrl}/admin/audit-logs?limit=12`).subscribe({
      next: logs => {
        this.auditLogs = logs;
        this.loadingAudit = false;
      },
      error: err => {
        console.error('Errore caricamento audit admin', err);
        this.loadingAudit = false;
      }
    });
  }

  updateTooltipVisibility(enabled: boolean): void {
    if (this.tooltipFeatureSaving || enabled === this.tooltipFeatureEnabled) {
      return;
    }

    const previous = this.tooltipFeatureEnabled;
    this.tooltipFeatureEnabled = enabled;
    this.tooltipFeatureSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.uiFeaturesService.updateExplainabilityBalloonsEnabled(enabled).subscribe({
      next: features => {
        this.tooltipFeatureEnabled = features.explainabilityBalloonsEnabled;
        this.tooltipFeatureSaving = false;
        this.successMessage = this.tooltipFeatureEnabled
          ? 'Tooltip riattivati per tutti i ristoratori.'
          : 'Tooltip disattivati per tutti i ristoratori.';
        this.loadAuditLogs();
      },
      error: err => {
        console.error('Errore aggiornamento visibilita tooltip', err);
        this.tooltipFeatureEnabled = previous;
        this.tooltipFeatureSaving = false;
        this.errorMessage = err.error?.message ?? 'Impossibile aggiornare la visibilita dei tooltip.';
      }
    });
  }

  createRestaurant(): void {
    const payload = {
      businessType: this.createForm.businessType,
      nome: this.createForm.nome.trim(),
      email: this.createForm.email.trim(),
      password: this.createForm.password,
      address: this.createForm.address.trim(),
      city: this.createForm.city.trim()
    };

    if (!payload.nome || !payload.email || payload.password.length < 8) {
      this.errorMessage = 'Nome, email e password di almeno 8 caratteri sono obbligatori.';
      return;
    }

    this.creating = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<AdminRestaurantSummary>(`${environment.apiUrl}/admin/restaurants`, payload).subscribe({
      next: restaurant => {
        this.restaurants = [restaurant, ...this.restaurants.filter(item => item.id !== restaurant.id)];
        this.createForm = this.emptyCreateForm();
        this.successMessage = 'Locale creato. Il relativo account puo accedere con email e password impostate.';
        this.creating = false;
        this.loadAuditLogs();
      },
      error: err => {
        console.error('Errore creazione locale admin', err);
        this.errorMessage = err.error?.message ?? 'Impossibile creare il locale.';
        this.creating = false;
      }
    });
  }

  resetPassword(restaurant: AdminRestaurantSummary): void {
    const password = (this.resetPasswords[restaurant.id] ?? '').trim();
    if (password.length < 8) {
      this.errorMessage = 'La nuova password deve contenere almeno 8 caratteri.';
      return;
    }

    this.resettingRestaurantId = restaurant.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.put<void>(`${environment.apiUrl}/admin/restaurants/${restaurant.id}/password`, { password }).subscribe({
      next: () => {
        this.resetPasswords[restaurant.id] = '';
        this.successMessage = `Password aggiornata per ${restaurant.nome}.`;
        this.resettingRestaurantId = null;
        this.loadAuditLogs();
      },
      error: err => {
        console.error('Errore reset password locale', err);
        this.errorMessage = err.error?.message ?? 'Impossibile aggiornare la password.';
        this.resettingRestaurantId = null;
      }
    });
  }

  enterRestaurant(restaurant: AdminRestaurantSummary): void {
    if (this.enteringRestaurantId === restaurant.id) {
      return;
    }

    this.enteringRestaurantId = restaurant.id;
    this.http.post<ImpersonationResponse>(`${environment.apiUrl}/admin/impersonations`, {
      restaurantId: restaurant.id,
      reason: 'Support access'
    }).subscribe({
      next: response => {
        this.authService.beginImpersonation(response.accessToken, response.restaurantName);
        this.enteringRestaurantId = null;
        this.loadAuditLogs();
        void this.router.navigate(['/tables-dashboard']);
      },
      error: err => {
        console.error('Errore avvio impersonazione', err);
        this.errorMessage = err.error?.message ?? 'Impossibile entrare nel locale selezionato.';
        this.enteringRestaurantId = null;
      }
    });
  }

  auditActionLabel(action: string): string {
    const labels: Record<string, string> = {
      ADMIN_CREATE_RESTAURANT: 'Creazione locale',
      ADMIN_RESET_RESTAURANT_PASSWORD: 'Reset password',
      ADMIN_START_IMPERSONATION: 'Accesso supporto',
      UI_TOOLTIP_VISIBILITY_UPDATED: 'Visibilita tooltip'
    };
    if (labels[action]) {
      return labels[action];
    }
    if (action.startsWith('IMPERSONATED_')) {
      return `Modifica in impersonazione (${action.replace('IMPERSONATED_', '')})`;
    }
    return action;
  }

  auditMetadata(log: AdminAuditLog): string {
    const uri = log.metadata?.['uri'];
    const restaurantName = log.metadata?.['restaurantName'];
    if (typeof restaurantName === 'string') {
      return restaurantName;
    }
    if (typeof uri === 'string') {
      return uri;
    }
    return log.entityType ? `${log.entityType}${log.entityId ? ' #' + log.entityId : ''}` : 'Evento operativo';
  }

  logout(): void {
    this.authService.logout();
  }

  trackRestaurant(index: number, restaurant: AdminRestaurantSummary): number {
    return restaurant.id;
  }

  trackAuditLog(index: number, log: AdminAuditLog): string {
    return log.id;
  }

  businessTypeLabel(type: string | null | undefined): string {
    return businessTypeLabel(type);
  }

  private emptyCreateForm(): CreateRestaurantForm {
    return {
      businessType: 'RISTORANTE',
      nome: '',
      email: '',
      password: '',
      address: '',
      city: ''
    };
  }
}
