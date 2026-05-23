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
  spec: string;
};

export function buildProductSpec(p: any, unitLabel: (u: string) => string): string {
  const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
  if (variants) {
    return variants
      .map((v: any) => {
        const parts = [v.size, v.packaging, unitLabel(v.unit || 'piece')].filter((x) => x && x !== '—');
        return parts.join(' / ') || '—';
      })
      .join(' · ');
  }
  const unit = unitLabel(p.unit || 'piece');
  return unit || '—';
}

export function renderCatalogProductName(nameAr: string, nameEn: string) {
  if (nameEn) {
    return `<span class="name-ar">${esc(nameAr)}</span> <span class="name-en">(${esc(nameEn)})</span>`;
  }
  return `<span class="name-ar">${esc(nameAr)}</span>`;
}

function renderPrintRow(r: PrintRow) {
  return `<tr>
  <td class="col-num">${r.num}</td>
  <td class="col-name">${renderCatalogProductName(r.nameAr, r.nameEn)}</td>
  <td class="col-spec">${esc(r.spec)}</td>
  <td class="col-qty"></td>
  <td class="col-notes"></td>
</tr>`;
}

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
  return products.map((p, idx) => ({
    num: idx + 1,
    nameAr: p.nameAr || '—',
    nameEn: p.nameEn || '',
    spec: buildProductSpec(p, unitLabel),
  }));
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
        `<tr class="cat-header"><td colspan="5">${esc(t('category'))}: ${esc(group.categoryName)}</td></tr>`,
      );
    }

    const groupRows = group.products.map((p) => ({
      nameAr: p.nameAr || '—',
      nameEn: p.nameEn || '',
      spec: buildProductSpec(p, unitLabel),
    }));

    groupRows.forEach((row) => {
      num += 1;
      bodyParts.push(renderPrintRow({ num, ...row }));
    });
  }

  return `<p class="print-hint">${esc(t('ordersPrintCatalogFillQty'))}</p>
<table class="catalog-table">
<thead>
<tr>
  <th class="col-num">#</th>
  <th class="col-name">${esc(t('productNameAr'))}</th>
  <th class="col-spec">${esc(t('ordersPrintCatalogSpec'))}</th>
  <th class="col-qty">${esc(t('quantity'))}</th>
  <th class="col-notes">${esc(t('ordersPrintCatalogNotes'))}</th>
</tr>
</thead>
<tbody>${bodyParts.join('')}</tbody>
</table>`;
}

const CATALOG_PRINT_EXTRA_CSS = `
body { font-size: 11px; line-height: 1.35; }
.print-header { padding-bottom: 8px; margin-bottom: 10px; border-bottom-width: 1px; }
.print-header h1 { font-size: 17px; margin-bottom: 3px; }
.print-header .sub { font-size: 11px; line-height: 1.35; }
.print-footer { margin-top: 10px; padding-top: 6px; font-size: 10px; }
.print-hint {
  margin: 0 0 8px;
  padding: 6px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 10px;
  color: #475569;
  line-height: 1.35;
}
.catalog-table { font-size: 11px; }
.catalog-table th,
.catalog-table td {
  padding: 4px 6px !important;
  line-height: 1.35;
  vertical-align: middle;
}
.catalog-table th { font-size: 11px; font-weight: 700; }
.col-num { width: 26px; min-width: 26px; text-align: center; }
.col-name { min-width: 110px; }
.col-spec { font-size: 10px; color: #334155; }
.name-ar { font-weight: 600; font-size: 11px; }
.name-en { font-size: 10px; color: #64748b; font-weight: 400; }
.col-qty { width: 52px; min-width: 52px; height: 22px; }
.col-notes { width: 64px; min-width: 64px; height: 22px; }
tr.cat-header td {
  background: #e8f0fa;
  color: #185FA5;
  font-weight: 700;
  font-size: 11px;
  border-color: #b8cfe8;
  padding: 5px 8px !important;
}
tr.cat-header + tr td { border-top: 1px solid #185FA5; }
tr:nth-child(even) td { background: #fafbfc; }
thead { display: table-header-group; }
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
    landscape: false,
    pageMarginMm: 8,
    showPageCounter: false,
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
