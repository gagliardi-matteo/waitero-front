import { InjectionToken } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PrintOrder, PrintResult } from './printer.models';

export enum PrinterProviderType {
  MOCK = 'MOCK',
  SUNMI = 'SUNMI'
}

export interface PrinterProvider {
  readonly type: PrinterProviderType;
  printKitchenOrder(order: PrintOrder): Promise<PrintResult>;
  printTestPage(): Promise<PrintResult>;
}

export interface WaiteroPrinterPlugin {
  printKitchenOrder(order: PrintOrder): Promise<PrintResult>;
  printTestPage(): Promise<PrintResult>;
}

export const Printer = registerPlugin<WaiteroPrinterPlugin>('WaiteroPrinter');

export const PRINTER_PROVIDER_TYPE = new InjectionToken<PrinterProviderType>('PRINTER_PROVIDER_TYPE', {
  providedIn: 'root',
  factory: () => {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      return PrinterProviderType.SUNMI;
    }
    return PrinterProviderType.MOCK;
  }
});

export class MockPrinterProvider implements PrinterProvider {
  readonly type = PrinterProviderType.MOCK;

  async printKitchenOrder(order: PrintOrder): Promise<PrintResult> {
    await new Promise<void>(resolve => window.setTimeout(resolve, 250));
    console.log('[WaiterO Printer MOCK]\n' + formatKitchenTicket(order));
    return { success: true };
  }

  async printTestPage(): Promise<PrintResult> {
    await new Promise<void>(resolve => window.setTimeout(resolve, 250));
    console.log('[WaiterO Printer MOCK]\n' + formatTestTicket());
    return { success: true };
  }
}

export class SunmiPrinterProvider implements PrinterProvider {
  readonly type = PrinterProviderType.SUNMI;

  async printKitchenOrder(order: PrintOrder): Promise<PrintResult> {
    try {
      const result = await Printer.printKitchenOrder(order);
      return normalizePrintResult(result);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SUNMI printer plugin unavailable'
      };
    }
  }

  async printTestPage(): Promise<PrintResult> {
    try {
      const result = await Printer.printTestPage();
      return normalizePrintResult(result);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SUNMI printer plugin unavailable'
      };
    }
  }
}

export function createPrinterProvider(type: PrinterProviderType): PrinterProvider {
  switch (type) {
    case PrinterProviderType.SUNMI:
      return new SunmiPrinterProvider();
    case PrinterProviderType.MOCK:
      return new MockPrinterProvider();
  }
}

function normalizePrintResult(result: PrintResult | undefined): PrintResult {
  if (!result) {
    return { success: false, error: 'Empty printer response' };
  }
  return result.success
    ? { success: true }
    : { success: false, error: result.error || 'Print failed' };
}

function formatKitchenTicket(order: PrintOrder): string {
  const separator = '========================';
  const sectionSeparator = '------------------------';
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const notes = order.items
    .map(item => item.notes?.trim())
    .filter((note): note is string => !!note);

  const lines = [
    separator,
    'WAITERO',
    'NUOVO ORDINE',
    separator,
    '',
    `Tavolo: ${order.tableName}`,
    `Ordine: #${order.orderId}`,
    `Ora: ${formatTicketTime(order.createdAt)}`,
    '',
    sectionSeparator,
    ''
  ];

  const newItems = order.items.filter(item => item.status !== 'PRINTED');
  const printedItems = order.items.filter(item => item.status === 'PRINTED');

  if (printedItems.length > 0) {
    lines.push('NUOVI PIATTI', '');
  }
  for (const item of newItems) {
    lines.push(`${item.quantity}x ${item.name}`);
  }

  if (printedItems.length > 0) {
    lines.push('', 'GIA STAMPATI', '');
    for (const item of printedItems) {
      lines.push(`${item.quantity}x ${item.name}`);
    }
  }

  if (notes.length > 0) {
    lines.push('', 'NOTE:');
    lines.push(...notes);
  }

  lines.push(
    '',
    sectionSeparator,
    '',
    `Totale piatti: ${totalItems}`,
    '',
    separator
  );

  return lines.join('\n');
}

function formatTestTicket(): string {
  const separator = '========================';
  const sectionSeparator = '------------------------';
  return [
    separator,
    'WAITERO',
    'STAMPA DI PROVA',
    separator,
    '',
    `Ora: ${formatTicketTime(new Date().toISOString())}`,
    '',
    sectionSeparator,
    '',
    'POS Sunmi locale',
    'Template senza ordine',
    '',
    'Se leggi questo ticket,',
    'la stampante funziona.',
    '',
    sectionSeparator,
    '',
    separator
  ].join('\n');
}

function formatTicketTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
