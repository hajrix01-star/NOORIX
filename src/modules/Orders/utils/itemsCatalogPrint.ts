import { buildPrintDocumentHtml } from '../../../utils/printUtils';
import { buildPrintHtmlTable, type PrintHtmlTableRow } from '../../../utils/printTableHtml';
import type { OrderCategory, OrderProduct, OrderProductType, OrderProductVariant, OrderSection } from '../../../types/api';

export type ItemsCatalogPrintFilters = {
  section: string;
  categoryId: string;
  productType: OrderProductType;
  search?: string;
};

export type PrintRow = {
  num: number;
  nameAr: string;
  nameEn: string;
  category: string;
  sections: string;
  size: string;
  packaging: string;
  unit: string;
  multiplier: string;
  lastPrice: string;
};

export function buildProductSpec(p: OrderProduct, unitLabel: (u: string) => string): string {
  const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
  if (variants) {
    return variants
      .map((v: OrderProductVariant) => {
        const parts = [v.size, v.packaging, unitLabel(v.unit || 'piece')].filter((x) => x && x !== '—');
        if (Number(v.quantityMultiplier ?? 1) !== 1) parts.push(`×${v.quantityMultiplier}`);
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

function buildPrintRow(r: PrintRow): PrintHtmlTableRow {
  return {
    cells: [
      { value: r.num, className: 'col-num' },
      { html: renderCatalogProductName(r.nameAr, r.nameEn), className: 'col-name' },
      { value: r.category, className: 'col-category' },
      { value: r.sections, className: 'col-sections' },
      { value: r.size, className: 'col-size' },
      { value: r.packaging, className: 'col-packaging' },
      { value: r.unit, className: 'col-unit' },
      { value: r.multiplier, className: 'col-multiplier' },
      { value: r.lastPrice, className: 'col-price' },
      { value: '', className: 'col-qty' },
      { value: '', className: 'col-notes' },
    ],
  };
}

export type CategoryPrintGroup = {
  categoryId: string | null;
  categoryName: string;
  products: OrderProduct[];
};

function esc(v: unknown) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function filterProductsForCatalogPrint(products: OrderProduct[], filters: ItemsCatalogPrintFilters) {
  let result = (products || []).filter((p) => (p.productType || 'order') === filters.productType);

  if (filters.categoryId === '__none__') {
    result = result.filter((p) => !p.categoryId);
  } else if (filters.categoryId) {
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

  const query = String(filters.search || '').trim().toLocaleLowerCase();
  if (query) {
    result = result.filter((p) => {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const haystack = [
        p.nameAr,
        p.nameEn,
        p.category?.nameAr,
        p.category?.nameEn,
        ...(p.sections || []),
        ...variants.flatMap((variant) => [
          variant.size,
          variant.packaging,
          variant.unit,
          variant.quantityMultiplier,
          variant.lastPrice,
        ]),
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return haystack.includes(query);
    });
  }

  return sortProductsForCatalogPrint(result, []);
}

export function sortProductsForCatalogPrint(products: OrderProduct[], categories: OrderCategory[]) {
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
  products: OrderProduct[],
  categories: OrderCategory[],
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

export function expandProductsToPrintRows(
  products: OrderProduct[],
  unitLabel: (u: string) => string,
  categories: OrderCategory[] = [],
): PrintRow[] {
  let num = 0;
  return products.flatMap((p) => {
    const variants = Array.isArray(p.variants) && p.variants.length > 0
      ? p.variants
      : [{
          size: p.sizes || '',
          packaging: p.packaging || '',
          unit: p.unit || 'piece',
          quantityMultiplier: 1,
          lastPrice: p.lastPrice,
        }];
    const category = p.category?.nameAr
      || p.category?.nameEn
      || categories.find((item) => item.id === p.categoryId)?.nameAr
      || categories.find((item) => item.id === p.categoryId)?.nameEn
      || '—';
    const sections = Array.isArray(p.sections) && p.sections.length > 0 ? p.sections.join(' · ') : '—';

    return variants.map((variant) => {
      num += 1;
      const multiplier = Number(variant.quantityMultiplier ?? 1);
      const price = Number(variant.lastPrice ?? p.lastPrice ?? 0);
      return {
        num,
        nameAr: p.nameAr || '—',
        nameEn: p.nameEn || '',
        category,
        sections,
        size: variant.size || '—',
        packaging: variant.packaging || '—',
        unit: unitLabel(variant.unit || p.unit || 'piece'),
        multiplier: Number.isFinite(multiplier) ? `×${multiplier}` : '×1',
        lastPrice: Number.isFinite(price) && price > 0 ? String(price) : '—',
      };
    });
  });
}

export function buildItemsCatalogPrintSubtitle(
  filters: ItemsCatalogPrintFilters,
  categories: OrderCategory[],
  sections: OrderSection[],
  t: (key: string) => string,
) {
  const parts: string[] = [];

  if (filters.section === '__none__') {
    parts.push(`${t('ordersPrintCatalogSection')}: ${t('filterNoSection')}`);
  } else if (filters.section) {
    const sec = sections.find((s) => s.nameAr === filters.section);
    parts.push(`${t('ordersPrintCatalogSection')}: ${sec?.nameAr || filters.section}`);
  }

  if (filters.categoryId === '__none__') {
    parts.push(`${t('category')}: ${t('ordersPrintCatalogNoCategory')}`);
  } else if (filters.categoryId) {
    const cat = categories.find((c) => c.id === filters.categoryId);
    parts.push(`${t('category')}: ${cat?.nameAr || cat?.nameEn || ''}`);
  }

  if (filters.search) {
    parts.push(`${t('ordersPrintCatalogSearch')}: ${filters.search}`);
  }

  return parts.join(' · ') || t('ordersPrintCatalogAllItems');
}

export function buildItemsCatalogPrintHtml(
  groups: CategoryPrintGroup[],
  t: (key: string) => string,
  unitLabel: (u: string) => string,
  groupByCategory: boolean,
  categories: OrderCategory[] = [],
) {
  let num = 0;
  const bodyRows: PrintHtmlTableRow[] = [];

  for (const group of groups) {
    if (groupByCategory) {
      bodyRows.push({
        className: 'cat-header',
        cells: [{ value: `${t('category')}: ${group.categoryName}`, colSpan: 11 }],
      });
    }

    const groupRows = expandProductsToPrintRows(group.products, unitLabel, categories);
    groupRows.forEach((row) => {
      num += 1;
      bodyRows.push(buildPrintRow({ ...row, num }));
    });
  }

  const allProducts = groups.flatMap((group) => group.products);
  const variantsCount = allProducts.reduce((total, product) => {
    const count = Array.isArray(product.variants) && product.variants.length > 0 ? product.variants.length : 1;
    return total + count;
  }, 0);
  const missingCategory = allProducts.filter((product) => !product.categoryId).length;
  const missingSection = allProducts.filter((product) => !product.sections?.length).length;
  const missingPrice = allProducts.filter((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) return variants.every((variant) => Number(variant.lastPrice || 0) <= 0);
    return Number(product.lastPrice || 0) <= 0;
  }).length;

  return `<div class="report-summary" aria-label="${esc(t('ordersPrintCatalogCoverage'))}">
  <span><strong>${allProducts.length}</strong> ${esc(t('ordersPrintCatalogItemsCount'))}</span>
  <span><strong>${variantsCount}</strong> ${esc(t('ordersPrintCatalogVariantsCount'))}</span>
  <span><strong>${missingCategory}</strong> ${esc(t('ordersPrintCatalogMissingCategory'))}</span>
  <span><strong>${missingSection}</strong> ${esc(t('ordersPrintCatalogMissingSection'))}</span>
  <span><strong>${missingPrice}</strong> ${esc(t('ordersPrintCatalogMissingPrice'))}</span>
</div>
<p class="print-hint">${esc(t('ordersPrintCatalogFillQty'))}</p>
${buildPrintHtmlTable({
  tableClassName: 'catalog-table',
  wrapperClassName: null,
  headerRows: [{
    cells: [
      { value: '#', className: 'col-num' },
      { value: t('productNameAr'), className: 'col-name' },
      { value: t('category'), className: 'col-category' },
      { value: t('productSections'), className: 'col-sections' },
      { value: t('ordersProductSize'), className: 'col-size' },
      { value: t('ordersProductPackaging'), className: 'col-packaging' },
      { value: t('unit'), className: 'col-unit' },
      { value: t('ordersVariantMultiplier'), className: 'col-multiplier' },
      { value: t('ordersVariantPrice'), className: 'col-price' },
      { value: t('quantity'), className: 'col-qty' },
      { value: t('ordersPrintCatalogNotes'), className: 'col-notes' },
    ],
  }],
  bodyRows,
  emptyColSpan: 11,
})}`;
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
.report-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 7px;
}
.report-summary span {
  padding: 4px 7px;
  border: 1px solid #dbe3ec;
  border-radius: 4px;
  background: #f8fafc;
  color: #475569;
  font-size: 9px;
  white-space: nowrap;
}
.report-summary strong { color: #0f172a; }
.catalog-table { font-size: 11px; }
.catalog-table th,
.catalog-table td {
  padding: 4px 6px !important;
  line-height: 1.35;
  vertical-align: middle;
}
.catalog-table th { font-size: 11px; font-weight: 700; }
.col-num { width: 26px; min-width: 26px; text-align: center; }
.col-name { width: 145px; min-width: 120px; }
.col-category { width: 76px; }
.col-sections { width: 86px; }
.col-size { width: 58px; }
.col-packaging { width: 68px; }
.col-unit { width: 50px; }
.col-multiplier { width: 54px; text-align: center; }
.col-price { width: 56px; text-align: center; direction: ltr; }
.name-ar { font-weight: 600; font-size: 11px; }
.name-en { font-size: 10px; color: #64748b; font-weight: 400; }
.col-qty { width: 52px; min-width: 52px; height: 22px; }
.col-notes { width: 72px; min-width: 64px; height: 22px; }
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
  products: OrderProduct[];
  filters: ItemsCatalogPrintFilters;
  categories: OrderCategory[];
  sections: OrderSection[];
  companyName: string;
  logoUrl?: string;
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
  categories: OrderCategory[],
  sections: OrderSection[],
) {
  const parts = ['items-catalog', filters.productType];

  if (filters.section === '__none__') parts.push('no-section');
  else if (filters.section) {
    const sec = sections.find((s) => s.nameAr === filters.section);
    parts.push(slugPart(sec?.nameAr || sec?.nameEn || filters.section));
  }

  if (filters.categoryId === '__none__') {
    parts.push('no-category');
  } else if (filters.categoryId) {
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
    body: buildItemsCatalogPrintHtml(groups, opts.t, opts.unitLabel, groupByCategory, opts.categories),
    pdfFilename: buildItemsCatalogPdfFilename(opts.filters, opts.categories, opts.sections),
  };
}

export function buildItemsCatalogDocumentHtml(
  opts: ItemsCatalogOutputOpts,
  mode: 'print' | 'pdf',
): { empty: true } | { empty: false; title: string; html: string } {
  const doc = prepareItemsCatalogDocument(opts);
  if (doc.empty) return { empty: true };

  const title = mode === 'pdf' ? doc.pdfFilename.replace(/\.pdf$/i, '') : opts.t('ordersPrintCatalogTitle');
  const html = buildPrintDocumentHtml({
    title,
    companyName: opts.companyName,
    logoUrl: opts.logoUrl || '',
    subtitle: doc.subtitle,
    body: doc.body,
    extraCss: CATALOG_PRINT_EXTRA_CSS,
    landscape: true,
    pageMarginMm: 8,
    showPageCounter: true,
    htmlLang: opts.lang === 'en' ? 'en' : 'ar',
    htmlDir: opts.lang === 'en' ? 'ltr' : 'rtl',
  });

  return { empty: false, title, html };
}
