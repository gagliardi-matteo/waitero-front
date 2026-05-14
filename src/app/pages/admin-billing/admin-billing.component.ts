import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/AuthService';
import { environment } from '../../../environments/environment';
import { businessTypeLabel, BusinessType } from '../../models/business-type.model';

interface AdminRestaurantSummary {
  id: number;
  businessType: BusinessType;
  nome: string;
  email: string;
  city?: string | null;
  createdAt?: string;
}

interface BillingAccountDto {
  id: number;
  restaurantId: number;
  restaurantName: string;
  stripeCustomerId?: string | null;
  defaultPaymentMethodId?: string | null;
  billingEnabled: boolean;
  commissionPercentage: number;
  minimumMonthlyFee: number;
  billingDay: number;
  contractStartDate: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BillingGlobalConfigDto {
  commissionPercentage: number;
  minimumMonthlyFee: number;
  updatedAt?: string;
}

interface BillingReviewSummaryDto {
  id: number;
  restaurantId: number;
  restaurantName: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  calculatedFee: number;
  revenueDelta?: number | null;
  feeDelta?: number | null;
  orderCount: number;
  status: string;
  approvedAt?: string | null;
  anomalies: string[];
}

interface BillingReviewOrderSnapshotDto {
  id: number;
  orderId: number;
  orderTotal: number;
  createdAt: string;
}

interface StripeInvoiceSummaryDto {
  invoiceId: string;
  status: string;
  collectionMethod: string;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  autoAdvance: boolean;
}

interface BillingReviewDetailDto {
  id: number;
  restaurantId: number;
  restaurantName: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  orderCount: number;
  commissionPercentage: number;
  minimumMonthlyFee: number;
  calculatedFee: number;
  status: string;
  stripeInvoiceId?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  anomalies: string[];
  stripeInvoice?: StripeInvoiceSummaryDto | null;
  orderSnapshots: BillingReviewOrderSnapshotDto[];
}

interface BillingAccountForm {
  billingEnabled: boolean;
  contractStartDate: string;
  stripeCustomerId: string;
  defaultPaymentMethodId: string;
}

interface BillingGlobalConfigForm {
  commissionPercentage: string;
  minimumMonthlyFee: string;
}

@Component({
  selector: 'app-admin-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-billing.component.html',
  styleUrl: './admin-billing.component.scss'
})
export class AdminBillingComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  searchTerm = '';
  globalLoading = false;
  globalSaving = false;
  globalConfig: BillingGlobalConfigDto | null = null;
  globalForm: BillingGlobalConfigForm = {
    commissionPercentage: '',
    minimumMonthlyFee: ''
  };
  restaurantLoading = false;
  restaurants: AdminRestaurantSummary[] = [];
  selectedRestaurant: AdminRestaurantSummary | null = null;

  pendingLoading = false;
  pendingReviews: BillingReviewSummaryDto[] = [];
  restaurantReviewsLoading = false;
  restaurantReviews: BillingReviewSummaryDto[] = [];
  selectedReview: BillingReviewDetailDto | null = null;
  detailLoading = false;
  reviewActionLoading = false;
  reviewNotes = '';

  accountLoading = false;
  accountSaving = false;
  accountMissing = false;
  accountForm: BillingAccountForm = this.emptyAccountForm();

  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadGlobalConfig();
    this.loadRestaurants();
    this.loadPendingReviews();
  }

  loadGlobalConfig(): void {
    this.globalLoading = true;
    this.http.get<BillingGlobalConfigDto>(`${environment.apiUrl}/admin/billing/config`).subscribe({
      next: config => {
        this.globalConfig = config;
        this.globalForm = {
          commissionPercentage: this.decimalToString(config.commissionPercentage, 6),
          minimumMonthlyFee: this.decimalToString(config.minimumMonthlyFee, 2)
        };
        this.globalLoading = false;
      },
      error: err => {
        console.error('Errore caricamento config billing globale', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare la configurazione billing globale.';
        this.globalLoading = false;
      }
    });
  }

  loadRestaurants(): void {
    this.restaurantLoading = true;
    const query = this.searchTerm.trim();
    const url = query
      ? `${environment.apiUrl}/admin/restaurants?q=${encodeURIComponent(query)}`
      : `${environment.apiUrl}/admin/restaurants`;

    this.http.get<AdminRestaurantSummary[]>(url).subscribe({
      next: restaurants => {
        this.restaurants = restaurants;
        this.restaurantLoading = false;
        if (!this.selectedRestaurant && restaurants.length > 0) {
          this.selectRestaurant(restaurants[0]);
        }
      },
      error: err => {
        console.error('Errore caricamento locali billing', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare i locali.';
        this.restaurantLoading = false;
      }
    });
  }

  loadPendingReviews(): void {
    this.pendingLoading = true;
    this.http.get<BillingReviewSummaryDto[]>(`${environment.apiUrl}/admin/billing/reviews/pending`).subscribe({
      next: reviews => {
        this.pendingReviews = reviews;
        this.pendingLoading = false;
      },
      error: err => {
        console.error('Errore caricamento review billing', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare le review billing.';
        this.pendingLoading = false;
      }
    });
  }

  selectRestaurant(restaurant: AdminRestaurantSummary): void {
    this.selectedRestaurant = restaurant;
    this.loadAccount(restaurant.id);
    this.loadRestaurantReviews(restaurant.id);
  }

  loadRestaurantReviews(restaurantId: number): void {
    this.restaurantReviewsLoading = true;
    this.http.get<BillingReviewSummaryDto[]>(`${environment.apiUrl}/admin/billing/reviews/restaurant/${restaurantId}`).subscribe({
      next: reviews => {
        this.restaurantReviews = reviews;
        this.restaurantReviewsLoading = false;
      },
      error: err => {
        console.error('Errore caricamento review locale', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare lo storico review del locale.';
        this.restaurantReviewsLoading = false;
      }
    });
  }

  loadAccount(restaurantId: number): void {
    this.accountLoading = true;
    this.accountMissing = false;
    this.http.get<BillingAccountDto>(`${environment.apiUrl}/admin/billing/accounts/${restaurantId}`).subscribe({
      next: account => {
        this.accountForm = {
          billingEnabled: account.billingEnabled,
          contractStartDate: account.contractStartDate,
          stripeCustomerId: account.stripeCustomerId ?? '',
          defaultPaymentMethodId: account.defaultPaymentMethodId ?? ''
        };
        this.accountLoading = false;
      },
      error: err => {
        if (err.status === 500 || err.status === 404) {
          this.accountMissing = true;
          this.accountForm = this.defaultAccountFormForRestaurant();
          this.accountLoading = false;
          return;
        }
        console.error('Errore caricamento account billing', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare l’account billing.';
        this.accountLoading = false;
      }
    });
  }

  saveAccount(): void {
    if (!this.selectedRestaurant) {
      return;
    }

    this.accountSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      billingEnabled: this.accountForm.billingEnabled,
      contractStartDate: this.accountForm.contractStartDate,
      stripeCustomerId: this.accountForm.stripeCustomerId.trim() || null,
      defaultPaymentMethodId: this.accountForm.defaultPaymentMethodId.trim() || null
    };

    this.http.put<BillingAccountDto>(`${environment.apiUrl}/admin/billing/accounts/${this.selectedRestaurant.id}`, payload).subscribe({
      next: account => {
        this.accountMissing = false;
        this.accountForm = {
          billingEnabled: account.billingEnabled,
          contractStartDate: account.contractStartDate,
          stripeCustomerId: account.stripeCustomerId ?? '',
          defaultPaymentMethodId: account.defaultPaymentMethodId ?? ''
        };
        this.accountSaving = false;
        this.successMessage = `Billing aggiornato per ${account.restaurantName}.`;
      },
      error: err => {
        console.error('Errore salvataggio billing', err);
        this.errorMessage = err.error?.message ?? 'Impossibile salvare la configurazione billing.';
        this.accountSaving = false;
      }
    });
  }

  openReview(reviewId: number): void {
    this.detailLoading = true;
    this.selectedReview = null;
    this.http.get<BillingReviewDetailDto>(`${environment.apiUrl}/admin/billing/reviews/${reviewId}`).subscribe({
      next: review => {
        this.selectedReview = review;
        this.reviewNotes = review.notes ?? '';
        this.detailLoading = false;
      },
      error: err => {
        console.error('Errore dettaglio review billing', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare il dettaglio review.';
        this.detailLoading = false;
      }
    });
  }

  approveSelectedReview(): void {
    this.runReviewAction('approve');
  }

  finalizeSelectedReview(): void {
    this.runReviewAction('finalize');
  }

  rejectSelectedReview(): void {
    this.runReviewAction('reject');
  }

  syncSelectedReviewFromStripe(): void {
    this.runReviewAction('sync-stripe-status');
  }

  logout(): void {
    this.authService.logout();
  }

  trackRestaurant(index: number, restaurant: AdminRestaurantSummary): number {
    return restaurant.id;
  }

  trackReview(index: number, review: BillingReviewSummaryDto): number {
    return review.id;
  }

  businessLabel(type: string | null | undefined): string {
    return businessTypeLabel(type);
  }

  saveGlobalConfig(): void {
    this.globalSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.put<BillingGlobalConfigDto>(`${environment.apiUrl}/admin/billing/config`, {
      commissionPercentage: Number(this.globalForm.commissionPercentage),
      minimumMonthlyFee: Number(this.globalForm.minimumMonthlyFee)
    }).subscribe({
      next: config => {
        this.globalConfig = config;
        this.globalForm = {
          commissionPercentage: this.decimalToString(config.commissionPercentage, 6),
          minimumMonthlyFee: this.decimalToString(config.minimumMonthlyFee, 2)
        };
        this.globalSaving = false;
        this.successMessage = 'Parametri billing globali aggiornati.';
        if (this.selectedRestaurant) {
          this.loadAccount(this.selectedRestaurant.id);
        }
      },
      error: err => {
        console.error('Errore salvataggio config billing globale', err);
        this.errorMessage = err.error?.message ?? 'Impossibile aggiornare la configurazione billing globale.';
        this.globalSaving = false;
      }
    });
  }

  private runReviewAction(action: 'approve' | 'finalize' | 'reject' | 'sync-stripe-status'): void {
    if (!this.selectedReview || this.reviewActionLoading) {
      return;
    }

    this.reviewActionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<BillingReviewDetailDto>(
      `${environment.apiUrl}/admin/billing/reviews/${this.selectedReview.id}/${action}`,
      { notes: this.reviewNotes }
    ).subscribe({
      next: review => {
        this.selectedReview = review;
        this.reviewActionLoading = false;
        this.successMessage = action === 'approve'
          ? 'Review approvata.'
          : action === 'finalize'
            ? 'Review finalizzata.'
            : action === 'reject'
              ? 'Review rifiutata.'
              : 'Review sincronizzata da Stripe.';
        this.loadPendingReviews();
        if (this.selectedRestaurant) {
          this.loadRestaurantReviews(this.selectedRestaurant.id);
        }
      },
      error: err => {
        console.error(`Errore azione review ${action}`, err);
        this.errorMessage = err.error?.message ?? 'Operazione billing non riuscita.';
        this.reviewActionLoading = false;
      }
    });
  }

  private defaultAccountFormForRestaurant(): BillingAccountForm {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return {
      billingEnabled: false,
      contractStartDate: `${yyyy}-${mm}-${dd}`,
      stripeCustomerId: '',
      defaultPaymentMethodId: ''
    };
  }

  private emptyAccountForm(): BillingAccountForm {
    return {
      billingEnabled: false,
      contractStartDate: '',
      stripeCustomerId: '',
      defaultPaymentMethodId: ''
    };
  }

  private decimalToString(value: number | string | null | undefined, scale: number): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return Number(value).toFixed(scale);
  }
}
