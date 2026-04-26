import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface UiFeatures {
  explainabilityBalloonsEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class UiFeaturesService {
  private features$?: Observable<UiFeatures>;

  getFeatures(): Observable<UiFeatures> {
    if (!this.features$) {
      this.features$ = of({ explainabilityBalloonsEnabled: true });
    }

    return this.features$;
  }
}
