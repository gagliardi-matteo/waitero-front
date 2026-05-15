import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import QRCode from 'qrcode';
import { BulkRestaurantTablePayload, RestaurantTable, RestaurantTablePayload } from '../../models/table.model';
import { TableService } from '../../services/table.service';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';

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
  private static readonly BULK_PRINT_COLUMNS = 3;
  private static readonly BULK_PRINT_ROWS = 4;

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

  private fb = inject(FormBuilder);
  private tableService = inject(TableService);
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

  constructor() {
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

  printQr(table: RestaurantTable): void {
    if (!this.isBrowser()) {
      return;
    }

    const qrImage = this.qrImageByTableId[table.id];
    if (!qrImage) {
      this.errorMessage = 'QR non ancora disponibile.';
      return;
    }

    const printWindow = window.open('', '_blank', 'width=720,height=900');
    if (!printWindow) {
      this.errorMessage = 'Impossibile aprire la finestra di stampa.';
      return;
    }

    const accessUrl = this.buildAccessUrl(table);
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Tavolo ${table.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 32px; text-align: center; }
            .sheet { border: 2px solid #111827; border-radius: 24px; padding: 32px; max-width: 420px; margin: 0 auto; }
            h1 { margin: 0 0 8px; font-size: 34px; }
            h2 { margin: 0 0 16px; font-size: 24px; color: #475467; }
            img { width: 280px; height: 280px; margin: 20px auto; display: block; }
            p { margin: 8px 0; }
            .url { font-size: 12px; word-break: break-all; color: #667085; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h1>WaiterO</h1>
            <h2>Tavolo ${table.numero}</h2>
            <p>${table.nome}</p>
            <img src="${qrImage}" alt="QR Tavolo ${table.numero}" />
            <p>Inquadra il QR per aprire il menu e ordinare.</p>
            <p class="url">${accessUrl}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async printBulkQrs(activeOnly: boolean): Promise<void> {
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

    const perPage = TablesManagementComponent.BULK_PRINT_COLUMNS * TablesManagementComponent.BULK_PRINT_ROWS;
    const pages = this.chunkTables(printableTables, perPage);
    const title = activeOnly ? 'QR tavoli attivi' : 'QR tutti i tavoli';
    const pageHeightMm = 297 - 20;
    const rowGapMm = 6;
    const rowHeightMm = ((pageHeightMm - (rowGapMm * (TablesManagementComponent.BULK_PRINT_ROWS - 1))) / TablesManagementComponent.BULK_PRINT_ROWS).toFixed(2);

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }
            .page {
              width: 100%;
              min-height: calc(297mm - 20mm);
              display: grid;
              grid-template-columns: repeat(${TablesManagementComponent.BULK_PRINT_COLUMNS}, 1fr);
              grid-template-rows: repeat(${TablesManagementComponent.BULK_PRINT_ROWS}, ${rowHeightMm}mm);
              align-content: start;
              gap: 6mm;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .card {
              border: 1px dashed #98a2b3;
              border-radius: 4mm;
              padding: 4mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              min-height: 0;
              height: 100%;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .brand {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            .table-number {
              margin-top: 2mm;
              font-size: 20px;
              font-weight: 700;
            }
            .table-name {
              margin-top: 1mm;
              font-size: 11px;
              color: #475467;
            }
            .qr {
              width: 100%;
              max-width: 48mm;
              aspect-ratio: 1 / 1;
              object-fit: contain;
              margin: 3mm 0;
            }
            .hint {
              font-size: 9px;
              color: #667085;
              line-height: 1.25;
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
          ${pages.map(page => `
            <section class="page">
              ${page.map(item => `
                <article class="card">
                  <div class="brand">WaiterO</div>
                  <div class="table-number">Tavolo ${item.table.numero}</div>
                  <div class="table-name">${this.escapeHtml(item.table.nome)}</div>
                  <img class="qr" src="${item.qrImage}" alt="QR tavolo ${item.table.numero}" />
                  <div class="hint">Scansiona per aprire il menu e ordinare</div>
                </article>
              `).join('')}
            </section>
          `).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    this.printingBulk = false;
    this.actionInFlightLabel = '';
  }

  cancelEdit(): void {
    this.resetForm();
  }

  buildAccessUrl(table: RestaurantTable): string {
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

    const logoSize = Math.round(canvas.width * TablesManagementComponent.QR_LOGO_RATIO);
    const padding = Math.round(logoSize * 0.22);
    const frameSize = logoSize + (padding * 2);
    const frameX = Math.round((canvas.width - frameSize) / 2);
    const frameY = Math.round((canvas.height - frameSize) / 2);
    const logoX = Math.round((canvas.width - logoSize) / 2);
    const logoY = Math.round((canvas.height - logoSize) / 2);
    const radius = Math.round(frameSize * 0.22);

    context.fillStyle = '#FFFFFF';
    this.roundRect(context, frameX, frameY, frameSize, frameSize, radius);
    context.fill();
    context.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

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

  private chunkTables<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
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


