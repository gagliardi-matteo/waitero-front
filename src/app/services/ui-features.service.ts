import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UiFeatures {
  explainabilityBalloonsEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class UiFeaturesService {
  private readonly defaultFeatures: UiFeatures = { explainabilityBalloonsEnabled: true };
  private readonly featuresSubject = new BehaviorSubject<UiFeatures>(this.defaultFeatures);
  private loaded = false;

  constructor(private http: HttpClient) {}

  getFeatures(): Observable<UiFeatures> {
    if (!this.loaded) {
      this.loaded = true;
      this.http.get<UiFeatures>(`${environment.apiUrl}/ui/features`).pipe(
        catchError(err => {
          console.error('Errore caricamento feature UI', err);
          return of(this.defaultFeatures);
        })
      ).subscribe(features => {
        this.featuresSubject.next(this.normalize(features));
      });
    }

    return this.featuresSubject.asObservable();
  }

  updateExplainabilityBalloonsEnabled(enabled: boolean): Observable<UiFeatures> {
    return this.http.put<UiFeatures>(`${environment.apiUrl}/ui/features`, {
      explainabilityBalloonsEnabled: enabled
    }).pipe(
      tap(features => {
        this.loaded = true;
        this.featuresSubject.next(this.normalize(features));
      }),
      catchError(err => {
        console.error('Errore aggiornamento feature UI', err);
        return throwError(() => err);
      })
    );
  }

  private normalize(features: UiFeatures | null | undefined): UiFeatures {
    return {
      explainabilityBalloonsEnabled: features?.explainabilityBalloonsEnabled ?? this.defaultFeatures.explainabilityBalloonsEnabled
    };
  }
}
