import { Piatto } from '../models/piatto.model';

export function rankDishes(piatti: Piatto[]): Piatto[] {
  if (!piatti.length) {
    return [];
  }

  const orderValues = piatti
    .map(piatto => piatto.numeroOrdini)
    .filter((value): value is number => typeof value === 'number');
  const priceValues = piatti.map(piatto => piatto.prezzo ?? 0);

  const minOrders = orderValues.length ? Math.min(...orderValues) : 0;
  const maxOrders = orderValues.length ? Math.max(...orderValues) : 0;
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);

  const ranked = piatti.map(piatto => {
    const hasOrderCount = typeof piatto.numeroOrdini === 'number';
    const normalizedOrders = hasOrderCount ? normalizeValue(piatto.numeroOrdini ?? 0, minOrders, maxOrders) : 0;
    const normalizedPrice = normalizeValue(piatto.prezzo ?? 0, minPrice, maxPrice);
    const score = hasOrderCount
      ? 0.7 * normalizedOrders + 0.3 * normalizedPrice
      : normalizedPrice;

    return {
      ...piatto,
      numeroOrdini: piatto.numeroOrdini ?? 0,
      score,
      badge: hasOrderCount ? null : 'Novita'
    };
  });

  const eligibleForTop = ranked
    .filter(piatto => typeof piatto.score === 'number' && typeof piatto.numeroOrdini === 'number' && piatto.numeroOrdini > 0)
    .sort(byScoreDesc);

  const topCount = eligibleForTop.length > 0 ? Math.max(1, Math.ceil(eligibleForTop.length * 0.2)) : 0;
  const topIds = new Set(eligibleForTop.slice(0, topCount).map(piatto => piatto.id));

  return ranked
    .map(piatto => ({
      ...piatto,
      badge: piatto.badge ?? (topIds.has(piatto.id) ? 'Piu scelto' : null)
    }))
    .sort(byScoreDesc);
}

export function byScoreDesc(a: Piatto, b: Piatto): number {
  return (b.score ?? 0) - (a.score ?? 0);
}

function normalizeValue(value: number, min: number, max: number): number {
  if (max <= min) {
    return 1;
  }
  return (value - min) / (max - min);
}
