import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RestaurantTable, RestaurantTablePayload } from '../models/table.model';

@Injectable({ providedIn: 'root' })
export class TableService {
  private http = inject(HttpClient);

  getTables(): Observable<RestaurantTable[]> {
    return this.http.get<RestaurantTable[]>(`${environment.apiUrl}/tables`);
  }

  createTable(payload: RestaurantTablePayload): Observable<RestaurantTable> {
    return this.http.post<RestaurantTable>(`${environment.apiUrl}/tables`, payload);
  }

  updateTable(tableId: number, payload: RestaurantTablePayload): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${environment.apiUrl}/tables/${tableId}`, payload);
  }

  regenerateToken(tableId: number): Observable<RestaurantTable> {
    return this.http.post<RestaurantTable>(`${environment.apiUrl}/tables/${tableId}/regenerate-token`, {});
  }

  deleteTable(tableId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/tables/${tableId}`);
  }
}
