import { Piatto } from '../models/piatto.model';

export interface DishCategoryOption {
  code: string;
  label: string;
  sortOrder: number;
}

export interface DishCategoryGroup extends DishCategoryOption {
  items: Piatto[];
}

const UNCATEGORIZED_CODE = 'UNCATEGORIZED';
const UNCATEGORIZED_LABEL = 'Senza categoria';
const UNCATEGORIZED_SORT_ORDER = 9999;

export function dishCategoryCode(dish: Pick<Piatto, 'categoriaCode' | 'categoria'>): string {
  const rawCode = dish.categoriaCode ?? dish.categoria;
  if (!rawCode || !rawCode.trim()) {
    return UNCATEGORIZED_CODE;
  }
  return rawCode.trim().toUpperCase();
}

export function dishCategoryLabel(dish: Pick<Piatto, 'categoriaCode' | 'categoria' | 'categoriaLabel'>): string {
  if (dish.categoriaLabel && dish.categoriaLabel.trim()) {
    return dish.categoriaLabel.trim();
  }
  const code = dishCategoryCode(dish);
  if (code === UNCATEGORIZED_CODE) {
    return UNCATEGORIZED_LABEL;
  }
  return code
    .toLowerCase()
    .split('_')
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function dishCategorySortOrder(dish: Pick<Piatto, 'categoriaSortOrder'>): number {
  return typeof dish.categoriaSortOrder === 'number' ? dish.categoriaSortOrder : UNCATEGORIZED_SORT_ORDER;
}

export function categoryOptionsFromDishes(dishes: Piatto[]): DishCategoryOption[] {
  const byCode = new Map<string, DishCategoryOption>();
  for (const dish of dishes) {
    const code = dishCategoryCode(dish);
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        label: dishCategoryLabel(dish),
        sortOrder: dishCategorySortOrder(dish)
      });
    }
  }

  return Array.from(byCode.values()).sort((left, right) =>
    left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
  );
}

export function groupDishesByCategory(
  dishes: Piatto[],
  sortItems: (left: Piatto, right: Piatto) => number
): DishCategoryGroup[] {
  const groups = new Map<string, DishCategoryGroup>();

  for (const dish of dishes) {
    const code = dishCategoryCode(dish);
    if (!groups.has(code)) {
      groups.set(code, {
        code,
        label: dishCategoryLabel(dish),
        sortOrder: dishCategorySortOrder(dish),
        items: []
      });
    }
    groups.get(code)!.items.push(dish);
  }

  return Array.from(groups.values())
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
    .map(group => ({
      ...group,
      items: [...group.items].sort(sortItems)
    }));
}
