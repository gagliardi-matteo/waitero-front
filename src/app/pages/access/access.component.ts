import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthContextService } from '../../services/auth-context.service';
import { DeviceIdService } from '../../services/device-id.service';
import { FingerprintService } from '../../services/fingerprint.service';
import { GpsService, GpsSnapshot } from '../../services/gps.service';
import { TableAccessService } from '../../services/table-access.service';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './access.component.html',
  styleUrl: './access.component.scss'
})
export class AccessComponent implements OnInit {
  errorMessage = '';
  accessStatus = 'Rilevazione posizione in corso...';
  gpsSnapshot: GpsSnapshot | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthContextService);
  private deviceIdService = inject(DeviceIdService);
  private fingerprintService = inject(FingerprintService);
  private gpsService = inject(GpsService);
  private tableAccessService = inject(TableAccessService);

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');
    const tablePublicId = this.route.snapshot.paramMap.get('tablePublicId');
    const restaurantId = this.route.snapshot.paramMap.get('restaurantId');
    const tableIdParam = this.route.snapshot.paramMap.get('tableId');

    if (!token) {
      this.errorMessage = 'Link tavolo non valido.';
      return;
    }

    this.auth.setPendingAccess(token, tablePublicId, restaurantId, tableIdParam);

    const deviceId = this.deviceIdService.getOrCreate();
    const [fingerprint, gps] = await Promise.all([
      this.fingerprintService.getVisitorId().catch(() => null),
      this.gpsService.getCurrentPositionSafe()
    ]);

    this.gpsSnapshot = gps;
    this.accessStatus = 'Verifica accesso tavolo in corso...';
    console.info('GPS letto dal browser', gps);

    this.tableAccessService.validateAccess({
      tablePublicId,
      qrToken: token,
      restaurantId,
      tableId: tableIdParam ? Number(tableIdParam) : null,
      deviceId,
      fingerprint,
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: gps.accuracy
    }).subscribe({
      next: response => {
        if (!response.allowed) {
          this.errorMessage = response.message || 'Accesso al tavolo non consentito.';
          this.accessStatus = `Esito backend: ${response.status}`;
          return;
        }

        this.auth.setContext(
          response.qrToken,
          String(response.restaurantId),
          String(response.tableId),
          deviceId,
          fingerprint,
          response.tablePublicId
        );

        this.router.navigate(['/menu'], {
          replaceUrl: true,
          queryParams: {
            restaurantId: response.restaurantId,
            tableId: response.tableId,
            token: response.qrToken,
            tablePublicId: response.tablePublicId
          }
        });
      },
      error: err => {
        console.error('Errore validazione accesso tavolo', err);
        this.errorMessage = err.error?.message ?? 'Impossibile validare l accesso al tavolo.';
        this.accessStatus = `HTTP ${err.status ?? 'errore sconosciuto'}`;
      }
    });
  }

  formatCoordinate(value: number | null): string {
    return value == null ? 'non disponibile' : value.toFixed(6);
  }

  formatAccuracy(value: number | null): string {
    return value == null ? 'non disponibile' : `${Math.round(value)} m`;
  }
}
