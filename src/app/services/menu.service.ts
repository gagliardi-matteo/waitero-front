import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Piatto } from '../models/piatto.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private http = inject(HttpClient);
  private baseUrl = '/api/menu';

  getPiatti(): Observable<Piatto[]> {
    return this.http.get<Piatto[]>(`${this.baseUrl}/piatti`);
  }

  creaPiatto(piatto: Piatto): Observable<Piatto> {
    return this.http.post<Piatto>(`${this.baseUrl}/piatti`, piatto);
  }

  aggiornaPiatto(id: number, piatto: Piatto): Observable<Piatto> {
    return this.http.put<Piatto>(`${this.baseUrl}/piatti/${id}`, piatto);
  }

  eliminaPiatto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/piatti/${id}`);
  }
}
