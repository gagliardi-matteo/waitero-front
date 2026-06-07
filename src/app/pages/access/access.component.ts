import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthContextService } from '../../services/auth-context.service';
import { DeviceIdService } from '../../services/device-id.service';
import { FingerprintService } from '../../services/fingerprint.service';
import { GpsService, GpsSnapshot } from '../../services/gps.service';
import { TableAccessService } from '../../services/table-access.service';
import { LegalAcceptanceService, LegalConfig } from '../../services/legal-acceptance.service';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './access.component.html',
  styleUrl: './access.component.scss'
})
export class AccessComponent implements OnInit {
  errorMessage = '';
  accessStatus = 'Preparazione accesso al menu...';
  gpsSnapshot: GpsSnapshot | null = null;
  locationPermissionDenied = false;
  locationRetryMessage = '';
  locationBlockedPermanently = false;
  retryingLocation = false;
  locationNoticeVisible = false;
  legalModalVisible = false;
  legalAccepting = false;
  legalConfig: LegalConfig | null = null;
  legalErrorMessage = '';

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthContextService);
  private deviceIdService = inject(DeviceIdService);
  private fingerprintService = inject(FingerprintService);
  private gpsService = inject(GpsService);
  private tableAccessService = inject(TableAccessService);
  private legalAcceptanceService = inject(LegalAcceptanceService);

  async ngOnInit(): Promise<void> {
    this.prepareAccess();
  }

  async enterWithLocation(): Promise<void> {
    this.retryingLocation = true;
    this.locationNoticeVisible = false;
    this.locationPermissionDenied = false;
    this.locationBlockedPermanently = false;
    this.locationRetryMessage = '';
    this.errorMessage = '';
    this.accessStatus = 'Rilevazione posizione in corso...';
    await this.runAccessFlow();
    this.retryingLocation = false;
  }

  async retryWithLocation(): Promise<void> {
    await this.enterWithLocation();
  }

  private prepareAccess(): void {
    const token = this.route.snapshot.paramMap.get('token');
    const tablePublicId = this.route.snapshot.paramMap.get('tablePublicId');
    const restaurantId = this.route.snapshot.paramMap.get('restaurantId');
    const tableIdParam = this.route.snapshot.paramMap.get('tableId');

    if (!token) {
      this.errorMessage = 'Link tavolo non valido.';
      this.accessStatus = 'Accesso non disponibile.';
      this.locationNoticeVisible = false;
      return;
    }

    this.auth.setPendingAccess(token, tablePublicId, restaurantId, tableIdParam);
    this.showLegalModalOrContinue(this.fallbackLegalConfig());
    this.loadLegalConfig();
  }

  private loadLegalConfig(): void {
    this.legalAcceptanceService.getConfig().subscribe({
      next: config => {
        this.showLegalModalOrContinue(config);
      },
      error: err => {
        console.error('Errore caricamento configurazione legale', err);
        this.showLegalModalOrContinue(this.fallbackLegalConfig());
      }
    });
  }

  private showLegalModalOrContinue(config: LegalConfig): void {
    this.legalConfig = config;
    if (this.hasCustomerLegalAcceptanceForCurrentVersion()) {
      void this.runAccessFlow();
      return;
    }
    this.legalModalVisible = true;
    this.accessStatus = 'Accetta i documenti per continuare.';
  }

  continueAfterLegalAcceptance(): void {
    const token = this.route.snapshot.paramMap.get('token');
    const tablePublicId = this.route.snapshot.paramMap.get('tablePublicId');
    const restaurantId = this.route.snapshot.paramMap.get('restaurantId');
    const tableIdParam = this.route.snapshot.paramMap.get('tableId');
    const sessionId = this.ensureLegalSessionId();

    if (!token) {
      this.legalErrorMessage = 'Link tavolo non valido.';
      return;
    }

    this.legalAccepting = true;
    this.legalErrorMessage = '';
    this.legalAcceptanceService.acceptCustomer({
      sessionId,
      tablePublicId,
      restaurantId,
      tableId: tableIdParam ? Number(tableIdParam) : null,
      qrToken: token
    }).subscribe({
      next: response => {
        this.legalModalVisible = false;
        this.legalAccepting = false;
        this.rememberCustomerLegalAcceptance(response.config);
        void this.runAccessFlow();
      },
      error: err => {
        console.error('Errore accettazione documenti cliente', err);
        this.legalAccepting = false;
        this.legalErrorMessage = err.error?.message ?? `Impossibile registrare l'accettazione dei documenti (HTTP ${err.status ?? 'errore'}).`;
      }
    });
  }

  private async runAccessFlow(): Promise<void> {
    if (!this.hasCustomerLegalAcceptanceForCurrentVersion()) {
      this.legalModalVisible = true;
      this.accessStatus = 'Accetta i documenti per continuare.';
      return;
    }

    const token = this.route.snapshot.paramMap.get('token');
    const tablePublicId = this.route.snapshot.paramMap.get('tablePublicId');
    const restaurantId = this.route.snapshot.paramMap.get('restaurantId');
    const tableIdParam = this.route.snapshot.paramMap.get('tableId');

    if (!token) {
      this.errorMessage = 'Link tavolo non valido.';
      this.accessStatus = 'Accesso non disponibile.';
      return;
    }

    const deviceId = this.deviceIdService.getOrCreate();
    const shouldCollectFingerprint = environment.privacy?.customerBrowserFingerprintEnabled === true;
    const [fingerprint, gps] = await Promise.all([
      shouldCollectFingerprint ? this.fingerprintService.getVisitorId().catch(() => null) : Promise.resolve(null),
      this.gpsService.getCurrentPositionSafe()
    ]);

    this.gpsSnapshot = gps;
    this.locationPermissionDenied = gps.denied === true;

    if (this.locationPermissionDenied) {
      this.locationBlockedPermanently = gps.permissionState === 'denied';
      this.locationRetryMessage = this.locationBlockedPermanently
        ? 'Hai bloccato la posizione nel browser. Riattivala dalle impostazioni del sito o del browser, poi riprova.'
        : 'Serve autorizzare la posizione per continuare.';
      this.accessStatus = 'Per entrare nel tavolo serve autorizzare la posizione.';
      return;
    }

    this.accessStatus = 'Verifica accesso tavolo in corso...';

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

  legalDocumentUrl(url: string | null | undefined): string {
    return this.legalAcceptanceService.documentUrl(url);
  }

  termsClientUrl(): string {
    return this.legalAcceptanceService.termsClientUrl();
  }

  privacyClientUrl(): string {
    return this.legalAcceptanceService.privacyClientUrl();
  }

  private hasCustomerLegalAcceptanceForCurrentVersion(): boolean {
    if (!this.legalConfig) {
      this.legalModalVisible = true;
      return false;
    }

    const acceptedKey = sessionStorage.getItem(this.customerLegalStorageKey());
    return acceptedKey === this.customerLegalVersionKey(this.legalConfig);
  }

  private rememberCustomerLegalAcceptance(config: LegalConfig): void {
    sessionStorage.setItem(this.customerLegalStorageKey(), this.customerLegalVersionKey(config));
  }

  private ensureLegalSessionId(): string {
    const storageKey = `${this.customerLegalStorageKey()}:sessionId`;
    const existing = sessionStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(storageKey, value);
    return value;
  }

  private customerLegalStorageKey(): string {
    const tablePublicId = this.route.snapshot.paramMap.get('tablePublicId') ?? this.route.snapshot.paramMap.get('tableId') ?? 'unknown';
    return `waiteroCustomerLegalAcceptance:${tablePublicId}`;
  }

  private customerLegalVersionKey(config: LegalConfig): string {
    return `${config.termsVersion}:${config.privacyVersion}:${config.allergenDisclaimerVersion}`;
  }

  private fallbackLegalConfig(): LegalConfig {
    return {
      contractVersion: '1.0',
      privacyVersion: '1.0',
      termsVersion: '1.0',
      allergenDisclaimerVersion: '1.0',
      contractUrl: '/legal/contratto-saas',
      privacyUrl: '/legal/privacy-client-v1.0.html',
      termsUrl: '/legal/terms-client-v1.0.html',
      allergenDisclaimerUrl: '/legal/disclaimer-allergeni-v1.0.html'
    };
  }
}
