import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RestaurantServiceHour {
  id?: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export interface RestaurantSettings {
  id: number;
  nome: string;
  email: string;
  address: string | null;
  city: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  allowedRadiusMeters: number | null;
  serviceHours: RestaurantServiceHour[];
}

export interface RestaurantSettingsPayload {
  nome: string;
  address: string;
  city: string;
  allowedRadiusMeters: number;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  hasStreetNumber: boolean;
  serviceHours: RestaurantServiceHour[];
}

export interface AddressSuggestion {
  address: string;
  city: string | null;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  hasStreetNumber: boolean;
}

@Injectable({ providedIn: 'root' })
export class RestaurantSettingsService {
  private http = inject(HttpClient);

  getSettings(): Observable<RestaurantSettings> {
    return this.http.get<RestaurantSettings>(`${environment.apiUrl}/restaurant/settings`);
  }

  updateSettings(payload: RestaurantSettingsPayload): Observable<RestaurantSettings> {
    return this.http.put<RestaurantSettings>(`${environment.apiUrl}/restaurant/settings`, payload);
  }

  searchAddress(query: string, city?: string): Observable<AddressSuggestion[]> {
    let params = new HttpParams().set('q', query);
    if (city && city.trim()) {
      params = params.set('city', city.trim());
    }
    return this.http.get<AddressSuggestion[]>(`${environment.apiUrl}/restaurant/address-search`, { params });
  }
}
