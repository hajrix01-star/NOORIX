import Decimal from 'decimal.js';
import {
  type CategoryNode,
  type ExpenseLineNode,
  type ExpenseTreeNode,
  type GeneralRowModel,
  type GroupKey,
} from './reports-general-profit-loss-model.util';

/** بناء شجرة فئات هرمية لأي مجموعة (مبيعات، مشتريات، مصاريف) */
export function buildPlCategoryHierarchy(
  groupKey: GroupKey,
  flatItems: Array<GeneralRowModel & { sortOrder?: number }>,
  categories: Map<string, CategoryNode>,
  expenseLines: ExpenseLineNode[],
  salesMonths: Decimal[],
  totalSales: Decimal,
): ExpenseTreeNode[] {
  const itemMap = new Map(flatItems.map((item) => [item.key, item]));

  const catTypeByGroup: Record<GroupKey, string> = {
    expenses: 'expense',
    purchases: 'purchase',
    sales: 'sale',
  };
  const catType = catTypeByGroup[groupKey];
  /**
   * فئات المجموعة: الجذر type === catType، والفرع يُدرَج إذا كان أبوه من نفس نوع المجموعة
   * ونوع الفرع عام أو فارغ أو مطابق — حتى لا تُستبعد الفئات الفرعية (P1-1…) إذا كان
   * type = general أو قديماً غير متزامن مع الأب، فيختفي التداخل تحت «مواد غذائية» ويبقى السطر الأب فقط.
   */
  const groupCats = Array.from(categories.values()).filter((c) => {
    if (c.type === catType) return true;
    if (!c.parentId) return false;
    const p = categories.get(c.parentId);
    if (!p || p.type !== catType) return false;
    return !c.type || c.type === 'general' || c.type === catType;
  });
  const roots = groupCats.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const childrenByParent = new Map<string, CategoryNode[]>();
  for (const c of groupCats) {
    if (c.parentId) {
      const list = childrenByParent.get(c.parentId) ?? [];
      list.push(c);
      childrenByParent.set(c.parentId, list);
    }
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const linesByCategory = new Map<string, ExpenseLineNode[]>();
  if (groupKey === 'expenses') {
    for (const el of expenseLines) {
      const list = linesByCategory.get(el.categoryId) ?? [];
      list.push(el);
      linesByCategory.set(el.categoryId, list);
    }
  }

  const toNode = (key: string, labelAr: string, labelEn: string, months: string[], total: string, percentOfSalesMonths: string[], percentOfSalesYear: string): ExpenseTreeNode => ({
    key,
    labelAr,
    labelEn,
    months,
    total,
    percentOfSalesMonths,
    percentOfSalesYear,
  });

  const buildCategoryNode = (cat: CategoryNode): ExpenseTreeNode | null => {
    const key = `category:${cat.id}`;
    const direct = itemMap.get(key);
    const childCats = childrenByParent.get(cat.id) ?? [];
    const lines = linesByCategory.get(cat.id) ?? [];
    const childNodes: ExpenseTreeNode[] = [];
    const monthsSum = direct?.months.map((v) => parseFloat(v || '0')) ?? Array(12).fill(0);
    let totalSum = parseFloat(direct?.total || '0');

    for (const child of childCats) {
      const node = buildCategoryNode(child);
      if (node) {
        childNodes.push(node);
        for (let i = 0; i < 12; i++) monthsSum[i] += parseFloat(node.months[i] || '0');
        totalSum += parseFloat(node.total || '0');
      }
    }
    for (const el of lines) {
      const elKey = `expense-line:${el.id}`;
      const elItem = itemMap.get(elKey);
      if (elItem) {
        childNodes.push(toNode(elKey, el.nameAr, el.nameEn || el.nameAr, elItem.months, elItem.total, elItem.percentOfSalesMonths, elItem.percentOfSalesYear));
        for (let i = 0; i < 12; i++) monthsSum[i] += parseFloat(elItem.months[i] || '0');
        totalSum += parseFloat(elItem.total || '0');
      }
    }

    if (totalSum < 0.0001 && childNodes.length === 0) return null;

    const months = monthsSum.map((v) => v.toFixed(2));
    const total = totalSum.toFixed(2);
    const pctMonths = monthsSum.map((v, i) => (parseFloat(salesMonths[i]?.toString() || '0') ? ((v / parseFloat(salesMonths[i].toString())) * 100).toFixed(2) : '0'));
    const pctYear = totalSales.eq(0) ? '0' : new Decimal(total).div(totalSales).mul(100).toFixed(2);

    const node: ExpenseTreeNode = toNode(key, cat.nameAr, cat.nameEn || cat.nameAr, months, total, pctMonths, pctYear);
    if (childNodes.length > 0) node.children = childNodes;
    return node;
  };

  const result: ExpenseTreeNode[] = [];
  for (const root of roots) {
    const node = buildCategoryNode(root);
    if (node) result.push(node);
  }

  const trackedCategoryKeys = new Set(groupCats.map((c) => `category:${c.id}`));
  const trackedLineKeys = new Set(groupKey === 'expenses' ? expenseLines.map((el) => `expense-line:${el.id}`) : []);
  const freeItems = flatItems.filter(
    (i) => !trackedCategoryKeys.has(i.key) && !trackedLineKeys.has(i.key),
  );
  for (const k of freeItems.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.labelAr.localeCompare(b.labelAr))) {
    result.push(toNode(k.key, k.labelAr, k.labelEn, k.months, k.total, k.percentOfSalesMonths, k.percentOfSalesYear));
  }

  return result;
}
