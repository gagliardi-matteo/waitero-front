import { Inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PrintOrder, PrintResult } from './printer.models';
import { createPrinterProvider, PRINTER_PROVIDER_TYPE, PrinterProvider, PrinterProviderType } from './printer.provider';

@Injectable({ providedIn: 'root' })
export class PrinterService {
  private readonly provider: PrinterProvider;
  private readonly providerType: PrinterProviderType;

  constructor(@Inject(PRINTER_PROVIDER_TYPE) providerType: PrinterProviderType) {
    this.providerType = providerType;
    this.provider = createPrinterProvider(providerType);
  }

  canPrintLocally(): boolean {
    return this.providerType === PrinterProviderType.SUNMI && Capacitor.isPluginAvailable('WaiteroPrinter');
  }

  getLocalPrinterStatus(): string {
    if (!Capacitor.isNativePlatform()) {
      return 'La stampa Sunmi funziona solo dall APK Android installata sul POS, non dal browser.';
    }

    if (Capacitor.getPlatform() !== 'android') {
      return 'La stampa Sunmi e disponibile solo su Android.';
    }

    if (!Capacitor.isPluginAvailable('WaiteroPrinter')) {
      return 'Plugin WaiteroPrinter non disponibile nella build installata. Aggiorna l APK sul POS.';
    }

    return '';
  }

  async printKitchenOrder(order: PrintOrder): Promise<PrintResult> {
    if (!this.isValidOrder(order)) {
      return { success: false, error: 'Invalid kitchen order payload' };
    }

    return this.provider.printKitchenOrder(order);
  }

  private isValidOrder(order: PrintOrder): boolean {
    return Number.isFinite(order.orderId)
      && !!order.tableName?.trim()
      && !!order.createdAt?.trim()
      && Array.isArray(order.items)
      && order.items.length > 0
      && order.items.every(item => Number.isFinite(item.quantity) && item.quantity > 0 && !!item.name?.trim());
  }
}
