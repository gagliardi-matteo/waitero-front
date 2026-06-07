import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Stampante, StampantePayload } from '../models/stampante.model';

@Injectable({ providedIn: 'root' })
export class StampanteService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/stampanti`;

  create(payload: StampantePayload): Observable<Stampante> {
    return this.http.post<Stampante>(this.baseUrl, payload);
  }

  update(id: number, payload: StampantePayload): Observable<Stampante> {
    return this.http.put<Stampante>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  findById(id: number): Observable<Stampante> {
    return this.http.get<Stampante>(`${this.baseUrl}/${id}`);
  }

  findByRistorante(ristoranteId: number): Observable<Stampante[]> {
    return this.http.get<Stampante[]>(`${this.baseUrl}/ristorante/${ristoranteId}`);
  }

  enable(id: number): Observable<Stampante> {
    return this.http.patch<Stampante>(`${this.baseUrl}/${id}/enable`, {});
  }

  disable(id: number): Observable<Stampante> {
    return this.http.patch<Stampante>(`${this.baseUrl}/${id}/disable`, {});
  }

  testPrint(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/test-print`, {});
  }
}
