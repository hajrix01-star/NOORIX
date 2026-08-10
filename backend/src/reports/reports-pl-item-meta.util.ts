import {
  GROUP_LABELS,
  KIND_LABELS,
  type CategoryNode,
  type GroupKey,
  type ItemMeta,
  type ReportInvoice,
  type ReportRowKey,
} from './reports-general-profit-loss-model.util';

export function resolvePlCategoryMeta(cat: CategoryNode, categories: Map<string, CategoryNode>): ItemMeta {
  const parent = cat.parentId ? categories.get(cat.parentId) : null;
  return {
    key: `category:${cat.id}`,
    labelAr: parent ? `${parent.nameAr} / ${cat.nameAr}` : cat.nameAr,
    labelEn: parent
      ? `${parent.nameEn || parent.nameAr} / ${cat.nameEn || cat.nameAr}`
      : (cat.nameEn || cat.nameAr),
    sortOrder: (parent?.sortOrder ?? 0) * 1000 + cat.sortOrder,
  };
}

export function resolvePlItemMeta(
  invoice: ReportInvoice,
  groupKey: GroupKey,
  categories: Map<string, CategoryNode>,
): ItemMeta {
  if (groupKey === 'sales') {
    const channel = invoice.dailySalesSummary?.channels?.[0]?.vault;
    if (channel) {
      return {
        key: `sales-channel:${channel.id}`,
        labelAr: channel.nameAr,
        labelEn: channel.nameEn || channel.nameAr,
        sortOrder: 0,
      };
    }
    return {
      key: 'kind:sale',
      labelAr: 'المبيعات',
      labelEn: 'Sales',
      sortOrder: 0,
    };
  }

  // The invoice category is the accounting decision captured for this document.
  // Supplier categories are only entry defaults, so they must never override it
  // in historical reporting.
  const invoiceCategory = invoice.categoryId ? categories.get(invoice.categoryId) : null;
  if (invoiceCategory) {
    return resolvePlCategoryMeta(invoiceCategory, categories);
  }

  if (invoice.expenseLine) {
    const category = categories.get(invoice.expenseLine.categoryId);
    const parent = category?.parentId ? categories.get(category.parentId) : null;
    return {
      key: `expense-line:${invoice.expenseLine.id}`,
      labelAr: parent
        ? `${parent.nameAr} / ${invoice.expenseLine.nameAr}`
        : invoice.expenseLine.nameAr,
      labelEn: parent
        ? `${parent.nameEn || parent.nameAr} / ${invoice.expenseLine.nameEn || invoice.expenseLine.nameAr}`
        : (invoice.expenseLine.nameEn || invoice.expenseLine.nameAr),
      sortOrder: (parent?.sortOrder ?? category?.sortOrder ?? 0) * 1000 + 10,
    };
  }

  if ((groupKey === 'purchases' || groupKey === 'expenses') && invoice.supplier?.supplierCategoryId != null) {
    const supCat = categories.get(invoice.supplier.supplierCategoryId);
    if (supCat) {
      return resolvePlCategoryMeta(supCat, categories);
    }
  }

  const kindLabel = KIND_LABELS[invoice.kind] || { ar: invoice.kind, en: invoice.kind };
  return {
    key: `kind:${invoice.kind}`,
    labelAr: kindLabel.ar,
    labelEn: kindLabel.en,
    sortOrder: 999999,
  };
}

export function resolvePlDetailTitle(
  groupKey: ReportRowKey,
  itemKey: string | undefined,
  categories: Map<string, CategoryNode>,
): { labelAr: string; labelEn: string } {
  if (!itemKey) {
    return { labelAr: GROUP_LABELS[groupKey].ar, labelEn: GROUP_LABELS[groupKey].en };
  }

  if (itemKey.startsWith('account:')) {
    return { labelAr: 'تفاصيل الحساب', labelEn: 'Account details' };
  }

  if (itemKey.startsWith('expense-line:')) {
    return { labelAr: 'تفاصيل البند', labelEn: 'Item details' };
  }
  if (itemKey.startsWith('sales-channel:')) {
    return { labelAr: 'تفاصيل قناة البيع', labelEn: 'Sales channel details' };
  }
  if (itemKey.startsWith('category:')) {
    const categoryId = itemKey.replace('category:', '');
    const category = categories.get(categoryId);
    const parent = category?.parentId ? categories.get(category.parentId) : null;
    if (category) {
      return {
        labelAr: parent ? `${parent.nameAr} / ${category.nameAr}` : category.nameAr,
        labelEn: parent
          ? `${parent.nameEn || parent.nameAr} / ${category.nameEn || category.nameAr}`
          : (category.nameEn || category.nameAr),
      };
    }
  }
  if (itemKey.startsWith('kind:')) {
    const kind = itemKey.replace('kind:', '');
    return { labelAr: KIND_LABELS[kind]?.ar || kind, labelEn: KIND_LABELS[kind]?.en || kind };
  }

  return { labelAr: GROUP_LABELS[groupKey].ar, labelEn: GROUP_LABELS[groupKey].en };
}
