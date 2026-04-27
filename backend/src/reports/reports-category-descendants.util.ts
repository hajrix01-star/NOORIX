import type { CategoryNode } from './reports-general-profit-loss-model.util';

export function getCategoryAndDescendantIds(
  categoryId: string,
  categories: Map<string, CategoryNode>,
): Set<string> {
  const set = new Set<string>([categoryId]);
  for (const cat of categories.values()) {
    if (cat.parentId === categoryId) {
      set.add(cat.id);
      for (const id of getCategoryAndDescendantIds(cat.id, categories)) set.add(id);
    }
  }
  return set;
}

/** هل catId فرع (أو أعمق) تحت ancestorId — للمشتريات: فئة المورد الفرعية تحت فئة سطر الفاتورة */
export function categoryIsDescendantOf(
  catId: string,
  ancestorId: string,
  categories: Map<string, CategoryNode>,
): boolean {
  let c = categories.get(catId);
  while (c?.parentId) {
    if (c.parentId === ancestorId) return true;
    c = categories.get(c.parentId);
  }
  return false;
}
