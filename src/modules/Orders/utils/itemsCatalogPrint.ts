import { openPrintWindow } from '../../../utils/printUtils';

export type ItemsCatalogPrintFilters = {
  section: string;
  categoryId: string;
  productType: 'order' | 'sale';
};

type PrintRow = {
  num: number;
  nameAr: string;
  nameEn: string;
  size: string;
  packaging: string;
  unit: string;
};

export type CategoryPrintGroup = {
  categoryId: string | null;
  categoryName: string;
  products: any[];
};

function esc(v: unknown) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function filterProductsForCatalogPrint(products: any[], filters: ItemsCatalogPrintFilters) {
  let result = (products || []).filter((p) => (p.productType || 'order') === filters.productType);

  if (filters.categoryId) {
    result = result.filter((p) => p.categoryId === filters.categoryId);
  }

  if (filters.section === '__none__') {
    result = result.filter((p) => !p.sections || (p.sections as string[]).length === 0);
  } else if (filters.section) {
    result = result.filter((p) => {
      const secs = p.sections as string[] | null;
      return secs && secs.includes(filters.section);
    });
  }

  return sortProductsForCatalogPrint(result, []);
}

export function sortProductsForCatalogPrint(products: any[], categories: any[]) {
  const catOrder = new Map(categories.map((c, i) => [c.id, c.sortOrder ?? i]));
  const catName = new Map(categories.map((c) => [c.id, c.nameAr || c.nameEn || '']));

  return [...products].sort((a, b) => {
    const orderA = a.categoryId ? (catOrder.get(a.categoryId) ?? 9999) : 99999;
    const orderB = b.categoryId ? (catOrder.get(b.categoryId) ?? 9999) : 99999;
    if (orderA !== orderB) return orderA - orderB;

    const nameA = a.categoryId ? (catName.get(a.categoryId) || '') : '';
    const nameB = b.categoryId ? (catName.get(b.categoryId) || '') : '';
    if (nameA !== nameB) return nameA.localeCompare(nameB, 'ar');

    return String(a.nameAr || '').localeCompare(String(b.nameAr || ''), 'ar');
  });
}

export function groupProductsByCategory(
  products: any[],
  categories: any[],
  noCategoryLabel: string,
): CategoryPrintGroup[] {
  const sorted = sortProductsForCatalogPrint(products, categories);
  const groups: CategoryPrintGroup[] = [];

  for (const p of sorted) {
    const catId = p.categoryId || null;
    const last = groups[groups.length - 1];

    if (last && last.categoryId === catId) {
      last.products.push(p);
      continue;
    }

    const cat = categories.find((c) => c.id === catId);
    groups.push({
      categoryId: catId,
      categoryName: cat?.nameAr || cat?.nameEn || noCategoryLabel,
      products: [p],
    });
  }

  return groups;
}

export function expandProductsToPrintRows(products: any[], unitLabel: (u: string) => string): PrintRow[] {
  const rows: PrintRow[] = [];
  let num = 0;

  for (const p of products) {
    const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;

    if (variants) {
      variants.forEach((v: any, i: number) => {
        num += 1;
        rows.push({
          num,
          nameAr: i === 0 ? (p.nameAr || '—') : '',
          nameEn: i === 0 ? (p.nameEn || '') : '',
          size: v.size || '—',
          packaging: v.packaging || '—',
          unit: unitLabel(v.unit || 'piece'),
        });
      });
    } else {
      num += 1;
      rows.push({
        num,
        nameAr: p.nameAr || '—',
        nameEn: p.nameEn || '',
        size: '—',
        packaging: '—',
        unit: unitLabel(p.unit || 'piece'),
      });
    }
  }

  return rows;
}

function renderPrintRow(r: PrintRow) {
  const nameCell = r.nameEn
    ? `<strong>${esc(r.nameAr)}</strong><br><span style="font-size:11px;color:#64748b">${esc(r.nameEn)}</span>`
    : esc(r.nameAr);
  return `<tr>
  <td class="col-num">${r.num}</td>
  <td>${nameCell}</td>
  <td>${esc(r.size)}</td>
  <td>${esc(r.packaging)}</td>
  <td class="col-unit">${esc(r.unit)}</td>
  <td class="col-qty"></td>
  <td class="col-notes"></td>
</tr>`;
}

export function buildItemsCatalogPrintSubtitle(
  filters: ItemsCatalogPrintFilters,
  categories: any[],
  sections: any[],
  t: (key: string) => string,
) {
  const parts: string[] = [];

  if (filters.section === '__none__') {
    parts.push(`${t('ordersPrintCatalogSection')}: ${t('filterNoSection')}`);
  } else if (filters.section) {
    const sec = sections.find((s) => s.nameAr === filters.section);
    parts.push(`${t('ordersPrintCatalogSection')}: ${sec?.nameAr || filters.section}`);
  }

  if (filters.categoryId) {
    const cat = categories.find((c) => c.id === filters.categoryId);
    parts.push(`${t('category')}: ${cat?.nameAr || cat?.nameEn || ''}`);
  }

  return parts.join(' · ') || t('ordersPrintCatalogAllItems');
}

export function buildItemsCatalogPrintHtml(
  groups: CategoryPrintGroup[],
  t: (key: string) => string,
  unitLabel: (u: string) => string,
  groupByCategory: boolean,
) {
  let num = 0;
  const bodyParts: string[] = [];

  for (const group of groups) {
    if (groupByCategory) {
      bodyParts.push(
        `<tr class="cat-header"><td colspan="7">${esc(t('category'))}: ${esc(group.categoryName)}</td></tr>`,
      );
    }

    const groupRows: PrintRow[] = [];
    for (const p of group.products) {
      const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
      if (variants) {
        variants.forEach((v: any, i: number) => {
          num += 1;
          groupRows.push({
            num,
            nameAr: i === 0 ? (p.nameAr || '—') : '',
            nameEn: i === 0 ? (p.nameEn || '') : '',
            size: v.size || '—',
            packaging: v.packaging || '—',
            unit: unitLabel(v.unit || 'piece'),
          });
        });
      } else {
        num += 1;
        groupRows.push({
          num,
          nameAr: p.nameAr || '—',
          nameEn: p.nameEn || '',
          size: '—',
          packaging: '—',
          unit: unitLabel(p.unit || 'piece'),
        });
      }
    }

    bodyParts.push(...groupRows.map(renderPrintRow));
  }

  return `<p class="print-hint">${esc(t('ordersPrintCatalogFillQty'))}</p>
<table>
<thead>
<tr>
  <th class="col-num">#</th>
  <th>${esc(t('productNameAr'))}</th>
  <th>${esc(t('ordersProductSize'))}</th>
  <th>${esc(t('ordersProductPackaging'))}</th>
  <th>${esc(t('ordersUnit'))}</th>
  <th class="col-qty">${esc(t('quantity'))}</th>
  <th class="col-notes">${esc(t('ordersPrintCatalogNotes'))}</th>
</tr>
</thead>
<tbody>${bodyParts.join('')}</tbody>
</table>`;
}

const CATALOG_PRINT_EXTRA_CSS = `
.print-hint {
  margin: 0 0 14px;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 12px;
  color: #475569;
}
.col-num { width: 32px; min-width: 32px; text-align: center; }
.col-unit { width: 56px; min-width: 56px; text-align: center; }
.col-qty { width: 72px; min-width: 72px; height: 28px; }
.col-notes { width: 90px; min-width: 90px; }
tbody td { vertical-align: middle; }
tr.cat-header td {
  background: #e8f0fa;
  color: #185FA5;
  font-weight: 700;
  font-size: 13px;
  border-color: #b8cfe8;
  padding: 10px 12px;
}
tr.cat-header + tr td { border-top: 2px solid #185FA5; }
`.trim();

export type ItemsCatalogOutputOpts = {
  products: any[];
  filters: ItemsCatalogPrintFilters;
  categories: any[];
  sections: any[];
  companyName: string;
  productTypeLabel: string;
  t: (key: string) => string;
  unitLabel: (u: string) => string;
  lang: string;
};

function slugPart(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildItemsCatalogPdfFilename(
  filters: ItemsCatalogPrintFilters,
  categories: any[],
  sections: any[],
) {
  const parts = ['items-catalog', filters.productType];

  if (filters.section === '__none__') parts.push('no-section');
  else if (filters.section) {
    const sec = sections.find((s) => s.nameAr === filters.section);
    parts.push(slugPart(sec?.nameAr || sec?.nameEn || filters.section));
  }

  if (filters.categoryId) {
    const cat = categories.find((c) => c.id === filters.categoryId);
    parts.push(slugPart(cat?.nameAr || cat?.nameEn || 'category'));
  }

  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.filter(Boolean).join('-')}.pdf`;
}

function prepareItemsCatalogDocument(opts: ItemsCatalogOutputOpts) {
  const filtered = filterProductsForCatalogPrint(opts.products, opts.filters);
  if (filtered.length === 0) return { empty: true as const };

  const groupByCategory = !opts.filters.categoryId;
  const groups = groupByCategory
    ? groupProductsByCategory(filtered, opts.categories, opts.t('ordersPrintCatalogNoCategory'))
    : [{
        categoryId: opts.filters.categoryId,
        categoryName: '',
        products: sortProductsForCatalogPrint(filtered, opts.categories),
      }];

  const filterSubtitle = buildItemsCatalogPrintSubtitle(
    opts.filters,
    opts.categories,
    opts.sections,
    opts.t,
  );
  const subtitle = [opts.productTypeLabel, filterSubtitle].filter(Boolean).join(' — ');

  return {
    empty: false as const,
    subtitle,
    body: buildItemsCatalogPrintHtml(groups, opts.t, opts.unitLabel, groupByCategory),
    pdfFilename: buildItemsCatalogPdfFilename(opts.filters, opts.categories, opts.sections),
  };
}

function openItemsCatalogDocument(
  opts: ItemsCatalogOutputOpts,
  mode: 'print' | 'pdf',
): { empty: boolean } {
  const doc = prepareItemsCatalogDocument(opts);
  if (doc.empty) return { empty: true };

  openPrintWindow({
    title: mode === 'pdf' ? doc.pdfFilename.replace(/\.pdf$/i, '') : opts.t('ordersPrintCatalogTitle'),
    companyName: opts.companyName,
    subtitle: doc.subtitle,
    body: doc.body,
    extraCss: CATALOG_PRINT_EXTRA_CSS,
    htmlLang: opts.lang === 'en' ? 'en' : 'ar',
    htmlDir: opts.lang === 'en' ? 'ltr' : 'rtl',
  });

  return { empty: false };
}

export function printItemsCatalog(opts: ItemsCatalogOutputOpts): { empty: boolean } {
  return openItemsCatalogDocument(opts, 'print');
}

export function exportItemsCatalogToPdf(opts: ItemsCatalogOutputOpts): { empty: boolean } {
  return openItemsCatalogDocument(opts, 'pdf');
}
