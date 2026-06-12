import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { PrinterService } from '../../core/printer/printer.service';
import { ModelloStampante, Stampante, StampantePayload, TipoConnessione } from '../../models/stampante.model';
import { RestaurantSettingsService } from '../../services/restaurant-settings.service';
import { StampanteService } from '../../services/stampante.service';

@Component({
  selector: 'app-printer-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor],
  templateUrl: './printer-settings.component.html',
  styleUrl: './printer-settings.component.scss'
})
export class PrinterSettingsComponent implements OnInit {
  stampanti: Stampante[] = [];
  restaurantId: number | null = null;
  loading = true;
  saving = false;
  editingId: number | null = null;
  formVisible = false;
  errorMessage = '';
  successMessage = '';
  testingPrinterKey: string | null = null;

  readonly modelloOptions: { value: ModelloStampante; label: string }[] = [
    { value: 'ITALRETAIL_PR2', label: 'Italretail PR2' },
    { value: 'EPSON_TM_T20', label: 'Epson TM-T20' },
    { value: 'EPSON_TM_M30', label: 'Epson TM-M30' },
    { value: 'CUSTOM_KUBE', label: 'Custom Kube' },
    { value: 'GENERIC_ESC_POS', label: 'Generica ESC/POS' }
  ];

  readonly connectionOptions: { value: TipoConnessione; label: string }[] = [
    { value: 'TCP_IP', label: 'TCP/IP' },
    { value: 'USB', label: 'USB' },
    { value: 'BLUETOOTH', label: 'Bluetooth' }
  ];

  private fb = inject(FormBuilder);
  private printerService = inject(PrinterService);
  private stampanteService = inject(StampanteService);
  private restaurantSettingsService = inject(RestaurantSettingsService);

  form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    modello: ['ITALRETAIL_PR2' as ModelloStampante, Validators.required],
    tipoConnessione: ['TCP_IP' as TipoConnessione, Validators.required],
    ipAddress: [''],
    porta: [9100],
    abilitata: [true]
  });

  ngOnInit(): void {
    this.loadData();
  }

  get isTcpIp(): boolean {
    return this.form.controls.tipoConnessione.value === 'TCP_IP';
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';

    this.restaurantSettingsService.getSettings().subscribe({
      next: settings => {
        this.restaurantId = settings.id;
        this.loadPrinters(settings.id);
      },
      error: err => {
        console.error('Errore caricamento locale per stampanti', err);
        this.errorMessage = 'Impossibile caricare il locale.';
        this.loading = false;
      }
    });
  }

  showCreateForm(): void {
    this.editingId = null;
    this.formVisible = true;
    this.form.reset({
      nome: '',
      modello: 'ITALRETAIL_PR2',
      tipoConnessione: 'TCP_IP',
      ipAddress: '',
      porta: 9100,
      abilitata: true
    });
    this.clearMessages();
  }

  edit(stampante: Stampante): void {
    this.editingId = stampante.id;
    this.formVisible = true;
    this.form.reset({
      nome: stampante.nome,
      modello: stampante.modello,
      tipoConnessione: stampante.tipoConnessione,
      ipAddress: stampante.ipAddress ?? '',
      porta: stampante.porta ?? 9100,
      abilitata: stampante.abilitata
    });
    this.clearMessages();
  }

  cancelForm(): void {
    this.formVisible = false;
    this.editingId = null;
    this.clearMessages();
  }

  save(): void {
    this.clearMessages();

    if (!this.restaurantId) {
      this.errorMessage = 'Locale non disponibile.';
      return;
    }

    if (this.form.invalid || !this.validateTcpIpFields()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;
    const request$ = this.editingId
      ? this.stampanteService.update(this.editingId, payload)
      : this.stampanteService.create(payload);

    request$
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: saved => {
          this.upsertPrinter(saved);
          this.successMessage = this.editingId ? 'Stampante aggiornata.' : 'Stampante aggiunta.';
          this.formVisible = false;
          this.editingId = null;
        },
        error: err => {
          console.error('Errore salvataggio stampante', err);
          this.errorMessage = err.error?.message ?? 'Impossibile salvare la stampante.';
        }
      });
  }

  delete(stampante: Stampante): void {
    if (!confirm(`Eliminare la stampante "${stampante.nome}"?`)) {
      return;
    }

    this.clearMessages();
    this.stampanteService.delete(stampante.id).subscribe({
      next: () => {
        this.stampanti = this.stampanti.filter(item => item.id !== stampante.id);
        this.successMessage = 'Stampante eliminata.';
      },
      error: err => {
        console.error('Errore eliminazione stampante', err);
        this.errorMessage = err.error?.message ?? 'Impossibile eliminare la stampante.';
      }
    });
  }

  enable(stampante: Stampante): void {
    this.updateEnabledState(stampante, true);
  }

  disable(stampante: Stampante): void {
    this.updateEnabledState(stampante, false);
  }

  async testSunmiPrint(): Promise<void> {
    this.clearMessages();
    this.testingPrinterKey = 'SUNMI';
    const result = await this.printerService.printKitchenOrder({
      orderId: 0,
      tableName: 'TEST',
      createdAt: new Date().toISOString(),
      items: [
        {
          quantity: 1,
          name: 'Stampa di prova WaiterO',
          notes: 'POS Sunmi locale'
        }
      ]
    });
    this.testingPrinterKey = null;

    if (result.success) {
      this.successMessage = 'Stampa di prova inviata al POS Sunmi.';
      return;
    }

    this.errorMessage = result.error ?? 'Impossibile stampare sul POS Sunmi.';
  }

  testExternalPrint(stampante: Stampante): void {
    this.clearMessages();
    this.testingPrinterKey = this.externalPrinterKey(stampante);
    this.stampanteService.testPrint(stampante.id)
      .pipe(finalize(() => this.testingPrinterKey = null))
      .subscribe({
        next: () => {
          this.successMessage = `Stampa di prova richiesta per ${stampante.nome}.`;
        },
        error: err => {
          console.error('Errore stampa prova stampante', err);
          this.errorMessage = err.error?.message ?? 'Impossibile richiedere la stampa di prova.';
        }
      });
  }

  modelLabel(value: ModelloStampante): string {
    return this.modelloOptions.find(option => option.value === value)?.label ?? value;
  }

  connectionLabel(value: TipoConnessione): string {
    return this.connectionOptions.find(option => option.value === value)?.label ?? value;
  }

  endpointLabel(stampante: Stampante): string {
    if (stampante.tipoConnessione !== 'TCP_IP') {
      return this.connectionLabel(stampante.tipoConnessione);
    }
    return `${stampante.ipAddress ?? '-'}:${stampante.porta ?? '-'}`;
  }

  trackPrinter(index: number, stampante: Stampante): number {
    return stampante.id;
  }

  isTestingSunmi(): boolean {
    return this.testingPrinterKey === 'SUNMI';
  }

  canTestSunmi(): boolean {
    return this.printerService.canPrintLocally();
  }

  sunmiStatusMessage(): string {
    return this.printerService.getLocalPrinterStatus();
  }

  isTestingExternal(stampante: Stampante): boolean {
    return this.testingPrinterKey === this.externalPrinterKey(stampante);
  }

  private loadPrinters(restaurantId: number): void {
    forkJoin({
      stampanti: this.stampanteService.findByRistorante(restaurantId)
    }).subscribe({
      next: ({ stampanti }) => {
        this.stampanti = [...stampanti].sort((left, right) => left.nome.localeCompare(right.nome));
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento stampanti', err);
        this.errorMessage = 'Impossibile caricare le stampanti.';
        this.loading = false;
      }
    });
  }

  private buildPayload(): StampantePayload {
    const raw = this.form.getRawValue();
    const isTcpIp = raw.tipoConnessione === 'TCP_IP';
    return {
      ristoranteId: this.restaurantId,
      nome: raw.nome.trim(),
      modello: raw.modello,
      tipoConnessione: raw.tipoConnessione,
      ipAddress: isTcpIp ? raw.ipAddress.trim() : null,
      porta: isTcpIp ? Number(raw.porta) : null,
      abilitata: raw.abilitata
    };
  }

  private validateTcpIpFields(): boolean {
    if (!this.isTcpIp) {
      return true;
    }

    const ipAddress = this.form.controls.ipAddress.value.trim();
    const porta = Number(this.form.controls.porta.value);
    if (!ipAddress) {
      this.errorMessage = 'IP obbligatorio per stampanti TCP/IP.';
      return false;
    }
    if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) {
      this.errorMessage = 'Porta obbligatoria e valida per stampanti TCP/IP.';
      return false;
    }
    return true;
  }

  private updateEnabledState(stampante: Stampante, enabled: boolean): void {
    this.clearMessages();
    const request$ = enabled
      ? this.stampanteService.enable(stampante.id)
      : this.stampanteService.disable(stampante.id);

    request$.subscribe({
      next: updated => {
        this.upsertPrinter(updated);
        this.successMessage = enabled ? 'Stampante abilitata.' : 'Stampante disabilitata.';
      },
      error: err => {
        console.error('Errore cambio stato stampante', err);
        this.errorMessage = err.error?.message ?? 'Impossibile aggiornare lo stato della stampante.';
      }
    });
  }

  private upsertPrinter(stampante: Stampante): void {
    this.stampanti = [
      stampante,
      ...this.stampanti.filter(item => item.id !== stampante.id)
    ].sort((left, right) => left.nome.localeCompare(right.nome));
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private externalPrinterKey(stampante: Stampante): string {
    return `EXTERNAL:${stampante.id}`;
  }
}
