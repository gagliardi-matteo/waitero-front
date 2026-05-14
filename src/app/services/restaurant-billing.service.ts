import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RestaurantBillingAccountDto {
  id: number;
  stripeCustomerId?: string | null;
  defaultPaymentMethodId?: string | null;
  billingEnabled: boolean;
  commissionPercentage: number;
  minimumMonthlyFee: number;
  billingDay: number;
  contractStartDate: string;
  updatedAt?: string | null;
}

export interface CreateSetupIntentResponse {
  billingAccountId: number;
  stripeCustomerId: string;
  setupIntentId: string;
  clientSecret: string;
  publishableKey?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RestaurantBillingService {
  private http = inject(HttpClient);

  getAccount(): Observable<RestaurantBillingAccountDto> {
    return this.http.get<RestaurantBillingAccountDto>(`${environment.apiUrl}/billing/account`);
  }

  createSetupIntent(): Observable<CreateSetupIntentResponse> {
    return this.http.post<CreateSetupIntentResponse>(`${environment.apiUrl}/billing/setup-intents`, {});
  }

  completeSetupIntent(setupIntentId: string): Observable<RestaurantBillingAccountDto> {
    return this.http.post<RestaurantBillingAccountDto>(
      `${environment.apiUrl}/billing/setup-intents/${encodeURIComponent(setupIntentId)}/complete`,
      { setupIntentId }
    );
  }
}
