import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { DemoContextService } from './demo-context.service';

export interface DemoSession { token: string; restaurantId: number; tableId: number; tablePublicId: string; restaurantName: string; expiresAt: string; }

@Injectable({ providedIn: 'root' })
export class DemoSessionService {
  private http = inject(HttpClient); private context = inject(DemoContextService);
  create(): Observable<DemoSession> { return this.http.post<DemoSession>(`${environment.apiUrl}/customer/demo/sessions`, {}).pipe(tap(s => this.context.activate(s.token))); }
  current(token?: string | null): Observable<DemoSession> {
    const sessionToken = token || this.context.token;
    return this.http.get<DemoSession>(`${environment.apiUrl}/customer/demo/sessions/current`, { params: new HttpParams().set('token', sessionToken ?? '') }).pipe(tap(s => this.context.activate(s.token)));
  }
}
