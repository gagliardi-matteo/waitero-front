export const STANDARD_ALLERGENS = [
  'Glutine',
  'Crostacei',
  'Uova',
  'Pesce',
  'Arachidi',
  'Soia',
  'Latte',
  'Frutta a guscio',
  'Sedano',
  'Senape',
  'Semi di sesamo',
  'Solfiti',
  'Lupini',
  'Molluschi'
] as const;

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

export function splitStoredAllergens(value: string | null | undefined): { standard: string[]; custom: string[] } {
  const parts = (value ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0);

  const standard: string[] = [];
  const custom: string[] = [];

  for (const part of parts) {
    const matched = STANDARD_ALLERGENS.find(allergen => normalizeValue(allergen) === normalizeValue(part));
    if (matched) {
      if (!standard.includes(matched)) {
        standard.push(matched);
      }
      continue;
    }
    if (!custom.some(item => normalizeValue(item) === normalizeValue(part))) {
      custom.push(part);
    }
  }

  return { standard, custom };
}

export function buildStoredAllergens(standard: string[], customRaw: string | null | undefined): string | null {
  const uniqueStandard = Array.from(new Set(standard.map(item => item.trim()).filter(Boolean)));
  const custom = (customRaw ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .filter(item => !uniqueStandard.some(std => normalizeValue(std) === normalizeValue(item)));

  const combined = [...uniqueStandard, ...custom];
  return combined.length > 0 ? combined.join(', ') : null;
}
