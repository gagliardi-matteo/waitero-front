import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import QRCode from 'qrcode';
import { BulkRestaurantTablePayload, RestaurantTable, RestaurantTablePayload } from '../../models/table.model';
import { TableService } from '../../services/table.service';
import { RestaurantSettingsService } from '../../services/restaurant-settings.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { environment } from '../../../environments/environment';

type PrintOrientation = 'vertical' | 'horizontal';
type PrintTarget = 'single' | 'bulk-all' | 'bulk-active';
type PrintSizePreset = '6x7' | '7x10' | '10x15' | 'custom';

interface PrintSizeOption {
  value: PrintSizePreset;
  label: string;
  widthCm: number;
  heightCm: number;
}

interface PrintLayout {
  widthMm: number;
  heightMm: number;
  qrSizeMm: number;
  orientation: PrintOrientation;
}

@Component({
  selector: 'app-tables-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BrandLoaderComponent],
  templateUrl: './tables-management.component.html',
  styleUrl: './tables-management.component.scss'
})
export class TablesManagementComponent {
  private static readonly QR_LOGO_SRC = 'assets/brand/logo_b.png';
  private static readonly QR_SIZE = 280;
  private static readonly QR_LOGO_RATIO = 0.22;
  private static readonly PRINT_PAGE_MARGIN_MM = 10;
  private static readonly PRINT_CARD_GAP_MM = 6;

  tables: RestaurantTable[] = [];
  loading = true;
  saving = false;
  bulkCreating = false;
  printingBulk = false;
  actionInFlightLabel = '';
  errorMessage = '';
  copiedTableId: number | null = null;
  editingTableId: number | null = null;
  qrImageByTableId: Record<number, string> = {};
  qrLoadingByTableId: Record<number, boolean> = {};
  restaurantName = '';
  printDialogOpen = false;
  printTarget: PrintTarget = 'single';
  printTable: RestaurantTable | null = null;

  readonly printSizeOptions: PrintSizeOption[] = [
    { value: '6x7', label: '6 x 7 cm', widthCm: 6, heightCm: 7 },
    { value: '7x10', label: '7 x 10 cm', widthCm: 7, heightCm: 10 },
    { value: '10x15', label: '10 x 15 cm', widthCm: 10, heightCm: 15 },
    { value: 'custom', label: 'Personalizzato', widthCm: 7, heightCm: 10 }
  ];

  private fb = inject(FormBuilder);
  private tableService = inject(TableService);
  private restaurantSettingsService = inject(RestaurantSettingsService);
  private platformId = inject(PLATFORM_ID);

  readonly form = this.fb.nonNullable.group({
    numero: [1, [Validators.required, Validators.min(1)]],
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    coperti: [2, [Validators.required, Validators.min(1)]],
    attivo: true
  });

  readonly bulkForm = this.fb.nonNullable.group({
    count: [10, [Validators.required, Validators.min(1), Validators.max(200)]],
    coperti: [2, [Validators.required, Validators.min(1)]],
    startingNumber: [null as number | null, [Validators.min(1)]],
    namePrefix: ['T', [Validators.maxLength(24)]],
    attivo: true
  });

  readonly printForm = this.fb.nonNullable.group({
    sizePreset: ['7x10' as PrintSizePreset],
    orientation: ['vertical' as PrintOrientation],
    customWidthCm: [7, [Validators.required, Validators.min(3), Validators.max(21)]],
    customHeightCm: [10, [Validators.required, Validators.min(3), Validators.max(29.7)]]
  });

  constructor() {
    this.loadRestaurantSettings();
    this.loadTables();
  }

  get numeroControl() {
    return this.form.controls.numero;
  }

  get nomeControl() {
    return this.form.controls.nome;
  }

  get copertiControl() {
    return this.form.controls.coperti;
  }

  get activeTablesCount(): number {
    return this.tables.filter(table => table.attivo).length;
  }

  get inactiveTablesCount(): number {
    return this.tables.length - this.activeTablesCount;
  }

  get totalSeats(): number {
    return this.tables.reduce((sum, table) => sum + table.coperti, 0);
  }

  get hasTables(): boolean {
    return this.tables.length > 0;
  }

  get hasActiveTables(): boolean {
    return this.tables.some(table => table.attivo);
  }

  get selectedPrintLayoutLabel(): string {
    const layout = this.getPrintLayout();
    return `${this.formatCm(layout.widthMm)} x ${this.formatCm(layout.heightMm)} cm`;
  }

  loadTables(): void {
    this.loading = true;
    this.errorMessage = '';
    this.tableService.getTables().subscribe({
      next: tables => {
        this.tables = tables;
        this.loading = false;
        void this.generateQrCodes(tables);
      },
      error: err => {
        console.error('Errore caricamento tavoli', err);
        this.errorMessage = 'Impossibile caricare i tavoli.';
        this.loading = false;
      }
    });
  }

  private loadRestaurantSettings(): void {
    this.restaurantSettingsService.getSettings().subscribe({
      next: settings => {
        this.restaurantName = settings.nome?.trim() ?? '';
      },
      error: err => {
        console.error('Errore caricamento impostazioni ristorante', err);
        this.restaurantName = '';
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Compila correttamente i campi obbligatori.';
      return;
    }

    this.saving = true;
    this.actionInFlightLabel = 'Salvataggio tavolo';
    this.errorMessage = '';
    const payload: RestaurantTablePayload = this.form.getRawValue();

    const request$ = this.editingTableId === null
      ? this.tableService.createTable(payload)
      : this.tableService.updateTable(this.editingTableId, payload);

    request$.subscribe({
      next: () => {
        this.resetForm();
        this.loadTables();
      },
      error: err => {
        console.error('Errore salvataggio tavolo', err);
        this.errorMessage = err.error?.message ?? 'Salvataggio tavolo non riuscito.';
        this.saving = false;
        this.actionInFlightLabel = '';
      },
      complete: () => {
        this.saving = false;
        this.actionInFlightLabel = '';
      }
    });
  }

  submitBulkCreate(): void {
    if (this.bulkForm.invalid) {
      this.bulkForm.markAllAsTouched();
      this.errorMessage = 'Compila correttamente i dati per la generazione massiva.';
      return;
    }

    this.bulkCreating = true;
    this.actionInFlightLabel = 'Generazione tavoli';
    this.errorMessage = '';
    const raw = this.bulkForm.getRawValue();
    const payload: BulkRestaurantTablePayload = {
      count: raw.count,
      coperti: raw.coperti,
      startingNumber: raw.startingNumber,
      namePrefix: raw.namePrefix,
      attivo: raw.attivo
    };

    this.tableService.bulkCreateTables(payload).subscribe({
      next: () => {
        this.bulkForm.patchValue({
          count: raw.count,
          coperti: raw.coperti,
          startingNumber: null,
          namePrefix: raw.namePrefix,
          attivo: raw.attivo
        });
        this.loadTables();
      },
      error: err => {
        console.error('Errore generazione massiva tavoli', err);
        this.errorMessage = err.error?.message ?? 'Generazione massiva tavoli non riuscita.';
        this.bulkCreating = false;
        this.actionInFlightLabel = '';
      },
      complete: () => {
        this.bulkCreating = false;
        this.actionInFlightLabel = '';
      }
    });
  }

  editTable(table: RestaurantTable): void {
    this.editingTableId = table.id;
    this.form.patchValue({
      numero: table.numero,
      nome: table.nome,
      coperti: table.coperti,
      attivo: table.attivo
    });
    this.errorMessage = '';
  }

  deleteTable(table: RestaurantTable): void {
    if (!this.isBrowser() || !window.confirm(`Eliminare ${table.nome}?`)) {
      return;
    }

    this.actionInFlightLabel = `Eliminazione ${table.nome}`;
    this.tableService.deleteTable(table.id).subscribe({
      next: () => {
        delete this.qrImageByTableId[table.id];
        delete this.qrLoadingByTableId[table.id];
        if (this.editingTableId === table.id) {
          this.resetForm();
        }
        this.loadTables();
      },
      error: err => {
        console.error('Errore eliminazione tavolo', err);
        this.errorMessage = err.error?.message ?? 'Eliminazione tavolo non riuscita.';
        this.actionInFlightLabel = '';
      },
      complete: () => {
        this.actionInFlightLabel = '';
      }
    });
  }

  regenerateToken(table: RestaurantTable): void {
    this.actionInFlightLabel = `Rigenerazione QR ${table.nome}`;
    this.tableService.regenerateToken(table.id).subscribe({
      next: updated => {
        this.tables = this.tables.map(current => current.id === updated.id ? updated : current);
        if (this.editingTableId === updated.id) {
          this.editTable(updated);
        }
        void this.generateQrCode(updated);
      },
      error: err => {
        console.error('Errore rigenerazione token tavolo', err);
        this.errorMessage = err.error?.message ?? 'Rigenerazione token non riuscita.';
        this.actionInFlightLabel = '';
      },
      complete: () => {
        this.actionInFlightLabel = '';
      }
    });
  }

  toggleTableActive(table: RestaurantTable): void {
    this.errorMessage = '';
    const payload: RestaurantTablePayload = {
      numero: table.numero,
      nome: table.nome,
      coperti: table.coperti,
      attivo: !table.attivo
    };

    this.actionInFlightLabel = `${table.attivo ? 'Disattivazione' : 'Attivazione'} ${table.nome}`;
    this.tableService.updateTable(table.id, payload).subscribe({
      next: updated => {
        this.tables = this.tables.map(current => current.id === updated.id ? updated : current);
        if (this.editingTableId === updated.id) {
          this.editTable(updated);
        }
      },
      error: err => {
        console.error('Errore aggiornamento stato tavolo', err);
        this.errorMessage = err.error?.message ?? 'Aggiornamento stato tavolo non riuscito.';
        this.actionInFlightLabel = '';
      },
      complete: () => {
        this.actionInFlightLabel = '';
      }
    });
  }

  copyAccessLink(table: RestaurantTable): void {
    if (!this.isBrowser()) {
      return;
    }

    navigator.clipboard.writeText(this.buildAccessUrl(table))
      .then(() => {
        this.copiedTableId = table.id;
        setTimeout(() => {
          this.copiedTableId = this.copiedTableId === table.id ? null : this.copiedTableId;
        }, 2000);
      })
      .catch(err => {
        console.error('Errore copia link tavolo', err);
        this.errorMessage = 'Copia link non riuscita.';
      });
  }

  downloadQr(table: RestaurantTable): void {
    if (!this.isBrowser()) {
      return;
    }

    const qrImage = this.qrImageByTableId[table.id];
    if (!qrImage) {
      this.errorMessage = 'QR non ancora disponibile.';
      return;
    }

    const link = window.document.createElement('a');
    link.href = qrImage;
    link.download = `waitero-tavolo-${table.numero}.png`;
    link.click();
  }

  openSinglePrintDialog(table: RestaurantTable): void {
    this.printTarget = 'single';
    this.printTable = table;
    this.errorMessage = '';
    this.printDialogOpen = true;
  }

  openBulkPrintDialog(activeOnly: boolean): void {
    this.printTarget = activeOnly ? 'bulk-active' : 'bulk-all';
    this.printTable = null;
    this.errorMessage = '';
    this.printDialogOpen = true;
  }

  closePrintDialog(): void {
    if (this.printingBulk) {
      return;
    }
    this.printDialogOpen = false;
    this.printTable = null;
  }

  onPrintSizePresetChange(): void {
    const selected = this.printSizeOptions.find(option => option.value === this.printForm.controls.sizePreset.value);
    if (selected && selected.value !== 'custom') {
      this.printForm.patchValue({
        customWidthCm: selected.widthCm,
        customHeightCm: selected.heightCm
      });
    }
  }

  async confirmPrint(): Promise<void> {
    if (this.printForm.invalid) {
      this.printForm.markAllAsTouched();
      this.errorMessage = 'Imposta dimensioni di stampa valide.';
      return;
    }

    const layout = this.getPrintLayout();
    if (this.printTarget === 'single') {
      if (this.printTable) {
        this.printQr(this.printTable, layout);
      }
      return;
    }

    await this.printBulkQrs(this.printTarget === 'bulk-active', layout);
  }

  private printQr(table: RestaurantTable, layout: PrintLayout): void {
    if (!this.isBrowser()) {
      return;
    }

    const qrImage = this.qrImageByTableId[table.id];
    if (!qrImage) {
      this.errorMessage = 'QR non ancora disponibile.';
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) {
      this.errorMessage = 'Impossibile aprire la finestra di stampa.';
      return;
    }

    const escapedRestaurantName = this.escapeHtml(this.restaurantName);
    const qrSizeMm = layout.qrSizeMm.toFixed(1);
    const horizontalClass = layout.orientation === 'horizontal' ? ' sheet--horizontal' : '';
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Tavolo ${table.numero}</title>
          <style>
            @page { size: A4 portrait; margin: ${TablesManagementComponent.PRINT_PAGE_MARGIN_MM}mm; }
            * { box-sizing: border-box; }
            body {
              min-height: calc(297mm - ${TablesManagementComponent.PRINT_PAGE_MARGIN_MM * 2}mm);
              margin: 0;
              display: flex;
              align-items: flex-start;
              justify-content: center;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
              text-align: center;
            }
            .sheet {
              width: ${layout.widthMm.toFixed(1)}mm;
              height: ${layout.heightMm.toFixed(1)}mm;
              border: 1px dashed #98a2b3;
              border-radius: 4mm;
              padding: 4mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              gap: 1.5mm;
              overflow: hidden;
            }
            .sheet--horizontal {
              display: grid;
              grid-template-columns: minmax(0, 1fr) ${qrSizeMm}mm;
              grid-template-rows: 1fr;
              align-items: center;
              justify-items: center;
              column-gap: 4mm;
              text-align: left;
            }
            .sheet__copy {
              min-width: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 1.5mm;
              text-align: center;
            }
            .sheet--horizontal .sheet__copy {
              align-items: flex-start;
              text-align: left;
            }
            h1 { margin: 0; font-size: 15px; line-height: 1.12; }
            h2 { margin: 0; font-size: 18px; line-height: 1.05; color: #111827; }
            img {
              width: ${qrSizeMm}mm;
              height: ${qrSizeMm}mm;
              margin: 1mm auto;
              display: block;
              object-fit: contain;
              flex: 0 0 auto;
            }
            p { margin: 0; }
            .restaurant { font-size: 10px; font-weight: 700; color: #111827; }
            .hint { margin-top: auto; font-size: 9px; line-height: 1.15; color: #667085; }
            .sheet--horizontal .hint { margin-top: 2mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="sheet${horizontalClass}">
            <div class="sheet__copy">
              <h1>${escapedRestaurantName}</h1>
              <p class="restaurant">Waitero</p>
              <h2>Tavolo ${table.numero}</h2>
              <p class="hint">Scansiona per aprire il menu ed ordinare</p>
            </div>
            <img src="${qrImage}" alt="QR Tavolo ${table.numero}" />
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    this.closePrintDialog();
  }

  private async printBulkQrs(activeOnly: boolean, layout: PrintLayout): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const selectedTables = this.tables
      .filter(table => !activeOnly || table.attivo)
      .sort((left, right) => left.numero - right.numero);

    if (selectedTables.length === 0) {
      this.errorMessage = activeOnly
        ? 'Non ci sono tavoli attivi da stampare.'
        : 'Non ci sono tavoli da stampare.';
      return;
    }

    this.errorMessage = '';
    this.printingBulk = true;
    this.actionInFlightLabel = activeOnly ? 'Preparazione stampa QR attivi' : 'Preparazione stampa QR';
    try {
      await this.ensureQrCodesForTables(selectedTables);
    } catch (err) {
      console.error('Errore preparazione QR massivi', err);
      this.errorMessage = 'Preparazione stampa QR non riuscita.';
      this.printingBulk = false;
      this.actionInFlightLabel = '';
      return;
    }

    const printableTables = selectedTables
      .map(table => ({
        table,
        qrImage: this.qrImageByTableId[table.id]
      }))
      .filter(item => !!item.qrImage);

    if (printableTables.length === 0) {
      this.errorMessage = 'QR non ancora disponibili.';
      this.printingBulk = false;
      this.actionInFlightLabel = '';
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      this.errorMessage = 'Impossibile aprire la finestra di stampa.';
      this.printingBulk = false;
      this.actionInFlightLabel = '';
      return;
    }

    const title = activeOnly ? 'QR tavoli attivi' : 'QR tutti i tavoli';
    const qrSizeMm = layout.qrSizeMm.toFixed(1);
    const horizontalClass = layout.orientation === 'horizontal' ? ' card--horizontal' : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: A4 portrait; margin: ${TablesManagementComponent.PRINT_PAGE_MARGIN_MM}mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }
            .page {
              width: 100%;
              display: flex;
              flex-wrap: wrap;
              align-content: flex-start;
              align-items: flex-start;
              gap: ${TablesManagementComponent.PRINT_CARD_GAP_MM}mm;
            }
            .card {
              width: ${layout.widthMm.toFixed(1)}mm;
              height: ${layout.heightMm.toFixed(1)}mm;
              flex: 0 0 ${layout.widthMm.toFixed(1)}mm;
              border: 1px dashed #98a2b3;
              border-radius: 4mm;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              gap: 1.2mm;
              text-align: center;
              min-height: 0;
              break-inside: avoid;
              page-break-inside: avoid;
              overflow: hidden;
            }
            .card--horizontal {
              display: grid;
              grid-template-columns: minmax(0, 1fr) ${qrSizeMm}mm;
              grid-template-rows: 1fr;
              align-items: center;
              justify-items: center;
              column-gap: 3mm;
              text-align: left;
            }
            .card__copy {
              min-width: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              gap: 1.2mm;
              text-align: center;
            }
            .card--horizontal .card__copy {
              align-items: flex-start;
              text-align: left;
            }
            .brand {
              font-size: 8px;
              font-weight: 700;
              line-height: 1.1;
            }
            .restaurant-name {
              font-size: 9px;
              font-weight: 700;
              color: #111827;
              line-height: 1.15;
              overflow: hidden;
            }
            .table-number {
              margin-top: 0.4mm;
              font-size: 15px;
              font-weight: 700;
              line-height: 1.05;
            }
            .qr {
              width: ${qrSizeMm}mm;
              height: ${qrSizeMm}mm;
              aspect-ratio: 1 / 1;
              object-fit: contain;
              margin: 0.8mm 0;
              flex: 0 0 auto;
            }
            .hint {
              font-size: 8px;
              color: #667085;
              line-height: 1.15;
              margin-top: auto;
            }
            .card--horizontal .hint {
              margin-top: 1.5mm;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
          <script>
            window.addEventListener('load', () => {
              const images = Array.from(document.images);
              const whenReady = images.map(image => {
                if (image.complete) {
                  return Promise.resolve();
                }
                return new Promise(resolve => {
                  image.onload = () => resolve();
                  image.onerror = () => resolve();
                });
              });

              Promise.all(whenReady).then(() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    window.focus();
                    window.print();
                  });
                });
              });
            });
          </script>
        </head>
        <body>
          <section class="page">
              ${printableTables.map(item => `
                <article class="card${horizontalClass}">
                  <div class="card__copy">
                    <div class="restaurant-name">${this.escapeHtml(this.restaurantName)}</div>
                    <div class="brand">Waitero</div>
                    <div class="table-number">Tavolo ${item.table.numero}</div>
                    <div class="hint">Scansiona per aprire il menu ed ordinare</div>
                  </div>
                  <img class="qr" src="${item.qrImage}" alt="QR tavolo ${item.table.numero}" />
                </article>
              `).join('')}
          </section>
        </body>
      </html>
    `);
    printWindow.document.close();
    this.printingBulk = false;
    this.actionInFlightLabel = '';
    this.closePrintDialog();
  }

  cancelEdit(): void {
    this.resetForm();
  }

  buildAccessUrl(table: RestaurantTable): string {
    const publicFrontendUrl = (environment as { publicFrontendUrl?: string }).publicFrontendUrl?.replace(/\/+$/, '');
    if (publicFrontendUrl) {
      return `${publicFrontendUrl}/menu/${table.tablePublicId}/${table.qrToken}`;
    }

    if (!this.isBrowser()) {
      return `/menu/${table.tablePublicId}/${table.qrToken}`;
    }

    return `${window.location.origin}/menu/${table.tablePublicId}/${table.qrToken}`;
  }

  private async generateQrCodes(tables: RestaurantTable[]): Promise<void> {
    await Promise.all(tables.map(table => this.generateQrCode(table)));
  }

  private async ensureQrCodesForTables(tables: RestaurantTable[]): Promise<void> {
    await Promise.all(tables.map(async table => {
      if (!this.qrImageByTableId[table.id]) {
        await this.generateQrCode(table);
      }
    }));
  }

  private async generateQrCode(table: RestaurantTable): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    this.qrLoadingByTableId[table.id] = true;
    try {
      const qrBaseImage = await QRCode.toDataURL(this.buildAccessUrl(table), {
        width: TablesManagementComponent.QR_SIZE,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#111827',
          light: '#FFFFFF'
        }
      });
      this.qrImageByTableId[table.id] = await this.composeQrWithLogo(qrBaseImage);
    } catch (err) {
      console.error('Errore generazione QR tavolo', err);
      this.errorMessage = 'Generazione QR non riuscita.';
    } finally {
      this.qrLoadingByTableId[table.id] = false;
    }
  }

  private async composeQrWithLogo(qrDataUrl: string): Promise<string> {
    const qrImage = await this.loadImage(qrDataUrl);
    const logoImage = await this.loadImage(TablesManagementComponent.QR_LOGO_SRC);
    const canvas = window.document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context non disponibile');
    }

    canvas.width = qrImage.width;
    canvas.height = qrImage.height;
    context.drawImage(qrImage, 0, 0);

    const logoMaxSize = Math.round(canvas.width * TablesManagementComponent.QR_LOGO_RATIO);
    const logoRatio = logoImage.width / logoImage.height;
    const logoWidth = logoRatio >= 1 ? logoMaxSize : Math.round(logoMaxSize * logoRatio);
    const logoHeight = logoRatio >= 1 ? Math.round(logoMaxSize / logoRatio) : logoMaxSize;
    const padding = Math.round(logoMaxSize * 0.22);
    const frameSize = logoMaxSize + (padding * 2);
    const frameX = Math.round((canvas.width - frameSize) / 2);
    const frameY = Math.round((canvas.height - frameSize) / 2);
    const logoX = Math.round((canvas.width - logoWidth) / 2);
    const logoY = Math.round((canvas.height - logoHeight) / 2);
    const radius = Math.round(frameSize * 0.22);

    context.fillStyle = '#FFFFFF';
    this.roundRect(context, frameX, frameY, frameSize, frameSize, radius);
    context.fill();
    context.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);

    return canvas.toDataURL('image/png');
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Impossibile caricare immagine: ${src}`));
      image.src = src;
    });
  }

  private roundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  private resetForm(): void {
    this.editingTableId = null;
    this.form.reset({
      numero: 1,
      nome: '',
      coperti: 2,
      attivo: true
    });
    this.errorMessage = '';
    this.saving = false;
    this.actionInFlightLabel = '';
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getPrintLayout(): PrintLayout {
    const raw = this.printForm.getRawValue();
    const preset = this.printSizeOptions.find(option => option.value === raw.sizePreset);
    let widthCm = preset && preset.value !== 'custom' ? preset.widthCm : raw.customWidthCm;
    let heightCm = preset && preset.value !== 'custom' ? preset.heightCm : raw.customHeightCm;

    if (raw.orientation === 'horizontal' && preset?.value !== 'custom') {
      [widthCm, heightCm] = [heightCm, widthCm];
    }

    const widthMm = widthCm * 10;
    const heightMm = heightCm * 10;
    const qrSizeMm = Math.max(26, Math.min(widthMm - 10, heightMm - 28, 58));
    return { widthMm, heightMm, qrSizeMm, orientation: raw.orientation };
  }

  private formatCm(mm: number): string {
    return (mm / 10).toLocaleString('it-IT', {
      maximumFractionDigits: 1
    });
  }

  private escapeHtml(value: string | null | undefined): string {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      return '&nbsp;';
    }
    return normalized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}


