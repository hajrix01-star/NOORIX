import type { CategoryNode } from './reports-general-profit-loss-model.util';
import { expandCategoryTreeIds } from '../common/utils/category-tree.util';

export function getCategoryAndDescendantIds(
  categoryId: string,
  categories: Map<string, CategoryNode>,
): Set<string> {
  return expandCategoryTreeIds([categoryId], categories.values());
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
