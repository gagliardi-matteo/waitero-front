import { Piatto } from '../models/piatto.model';

export function rankDishes(piatti: Piatto[]): Piatto[] {
  if (!piatti.length) {
    return [];
  }

  const orderValues = piatti
    .map(piatto => piatto.numeroOrdini ?? 0);
  const cartRateValues = piatti
    .map(piatto => piatto.viewToCartRate ?? 0);
  const orderRateValues = piatti
    .map(piatto => piatto.viewToOrderRate ?? 0);
  const viewValues = piatti
    .map(piatto => piatto.views ?? 0);
  const priceValues = piatti.map(piatto => piatto.prezzo ?? 0);

  const minOrders = Math.min(...orderValues);
  const maxOrders = Math.max(...orderValues);
  const minCartRate = Math.min(...cartRateValues);
  const maxCartRate = Math.max(...cartRateValues);
  const minOrderRate = Math.min(...orderRateValues);
  const maxOrderRate = Math.max(...orderRateValues);
  const minViews = Math.min(...viewValues);
  const maxViews = Math.max(...viewValues);
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);

  const ranked = piatti.map(piatto => {
    const orders = piatto.numeroOrdini ?? 0;
    const views = piatto.views ?? 0;
    const normalizedOrders = normalizeValue(orders, minOrders, maxOrders);
    const normalizedCartRate = normalizeValue(piatto.viewToCartRate ?? 0, minCartRate, maxCartRate);
    const normalizedOrderRate = normalizeValue(piatto.viewToOrderRate ?? 0, minOrderRate, maxOrderRate);
    const normalizedViews = normalizeValue(views, minViews, maxViews);
    const normalizedPrice = normalizeValue(piatto.prezzo ?? 0, minPrice, maxPrice);

    const score = (0.38 * normalizedOrders)
      + (0.26 * normalizedOrderRate)
      + (0.18 * normalizedCartRate)
      + (0.10 * normalizedViews)
      + (0.08 * normalizedPrice)
      + (piatto.consigliato ? 0.06 : 0);

    return {
      ...piatto,
      numeroOrdini: orders,
      views,
      score,
      badge: resolveBadge(piatto, orders, views)
    };
  });

  const topCount = Math.max(1, Math.ceil(ranked.length * 0.2));
  const topIds = new Set(ranked
    .slice()
    .sort(byScoreDesc)
    .slice(0, topCount)
    .map(piatto => piatto.id));

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

function resolveBadge(piatto: Piatto, orders: number, views: number): string | null {
  switch (piatto.performanceLabel) {
    case 'top_performer':
      return 'Top performer';
    case 'high_interest_low_conversion':
      return 'Da ottimizzare';
    case 'cart_abandonment':
      return 'Molto nel carrello';
    default:
      if (orders === 0 && views === 0) {
        return 'Novita';
      }
      return null;
  }
}

function normalizeValue(value: number, min: number, max: number): number {
  if (max <= min) {
    return value > 0 ? 1 : 0;
  }
  return (value - min) / (max - min);
}
