export type BusinessType = 'RISTORANTE' | 'PUB';

export function businessTypeLabel(type?: string | null): string {
  switch ((type ?? '').toUpperCase()) {
    case 'PUB':
      return 'Pub';
    case 'RISTORANTE':
      return 'Ristorante';
    default:
      return 'Locale';
  }
}

export function businessTypeLabelLower(type?: string | null): string {
  const label = businessTypeLabel(type);
  return label.charAt(0).toLowerCase() + label.slice(1);
}
