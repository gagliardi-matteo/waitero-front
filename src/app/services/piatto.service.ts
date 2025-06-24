import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Piatto } from '../models/piatto.model';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PiattoService {
  private http = inject(HttpClient);
  private baseUrl = '/api/menu';

  getById(id: number): Observable<Piatto> {
    return this.http.get<Piatto>(`${environment.apiUrl}/menu/piatto/${id}`);
    }

  update(id: number, dto: Piatto): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/menu/piatti/${id}`, dto);
  }

  updateConImmagine(id: number, formData: FormData): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/menu/piatti/${id}/con-immagine`, formData);
  }


}
