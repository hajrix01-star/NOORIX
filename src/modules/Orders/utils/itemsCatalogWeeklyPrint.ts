import { buildPrintHtmlTable, type PrintHtmlTableRow } from '../../../utils/printTableHtml';
import { buildPrintDocumentHtml } from '../../../utils/printUtils';
import {
  buildItemsCatalogPrintSubtitle,
  buildProductSpec,
  renderCatalogProductName,
  filterProductsForCatalogPrint,
  groupProductsByCategory,
  sortProductsForCatalogPrint,
  type CategoryPrintGroup,
  type ItemsCatalogOutputOpts,
  type ItemsCatalogPrintFilters,
} from './itemsCatalogPrint';
import type { OrderCategory, OrderSection } from '../../../types/api';

export const WEEKLY_SHEET_DAY_COUNT = 7;
export const WEEKLY_SHEET_TOTAL_COLS = 3 + WEEKLY_SHEET_DAY_COUNT * 2;

const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;

function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emptyDayCells() {
  return DAY_NUMBERS.map(() => ({ value: '', className: 'col-day' }));
}

function buildWeeklyDayHeaderCells() {
  return DAY_NUMBERS.map((day) => ({ value: day, className: 'col-day' }));
}

function buildWeeklyProductRow(num: number, nameAr: string, nameEn: string, spec: string): PrintHtmlTableRow {
  return {
    cells: [
      { value: num, className: 'col-num' },
      { html: renderCatalogProductName(nameAr, nameEn), className: 'col-name' },
      { value: spec, className: 'col-spec' },
      ...emptyDayCells(),
      ...emptyDayCells(),
    ],
  };
}

export function buildItemsCatalogWeeklyPrintHtml(
  groups: CategoryPrintGroup[],
  t: (key: string) => string,
  unitLabel: (u: string) => string,
  groupByCategory: boolean,
) {
  let num = 0;
  const bodyRows: PrintHtmlTableRow[] = [];

  for (const group of groups) {
    if (groupByCategory) {
      bodyRows.push({
        className: 'cat-header',
        cells: [{ value: `${t('category')}: ${group.categoryName}`, colSpan: WEEKLY_SHEET_TOTAL_COLS }],
      });
    }

    for (const product of group.products) {
      num += 1;
      bodyRows.push(
        buildWeeklyProductRow(
          num,
          product.nameAr || '-',
          product.nameEn || '',
          buildProductSpec(product, unitLabel),
        ),
      );
    }
  }

  const tableHtml = buildPrintHtmlTable({
    tableClassName: 'catalog-table weekly-table',
    wrapperClassName: null,
    headerRows: [{
      cells: [
        { value: '#', rowSpan: 2, className: 'col-num' },
        { value: t('productNameAr'), rowSpan: 2, className: 'col-name' },
        { value: t('ordersPrintCatalogSpec'), rowSpan: 2, className: 'col-spec' },
        { value: t('ordersPrintWeeklyStock'), colSpan: WEEKLY_SHEET_DAY_COUNT, className: 'group-stock' },
        { value: t('ordersPrintWeeklyOrder'), colSpan: WEEKLY_SHEET_DAY_COUNT, className: 'group-order' },
      ],
    }, {
      cells: [
        ...buildWeeklyDayHeaderCells(),
        ...buildWeeklyDayHeaderCells(),
      ],
    }],
    bodyRows,
    emptyColSpan: WEEKLY_SHEET_TOTAL_COLS,
  });

  return `<div class="week-meta">
  <span>${esc(t('ordersPrintWeeklyWeekFrom'))}: _______________</span>
  <span>${esc(t('ordersPrintWeeklyWeekTo'))}: _______________</span>
</div>
<p class="print-hint">${esc(t('ordersPrintWeeklyFillHint'))}</p>
${tableHtml}`;
}

const WEEKLY_PRINT_EXTRA_CSS = `
body { font-size: 10px; line-height: 1.3; }
.print-header { padding-bottom: 6px; margin-bottom: 8px; border-bottom-width: 1px; }
.print-header h1 { font-size: 15px; margin-bottom: 2px; }
.print-header .sub { font-size: 10px; line-height: 1.3; }
.print-footer { margin-top: 8px; padding-top: 4px; font-size: 9px; }
.week-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0 0 6px;
  font-size: 10px;
  font-weight: 600;
}
.print-hint {
  margin: 0 0 6px;
  padding: 4px 6px;
  background: #f1f5f9;
  border-radius: 3px;
  font-size: 9px;
  color: #475569;
  line-height: 1.3;
}
.weekly-table { font-size: 10px; table-layout: fixed; width: 100%; }
.weekly-table th,
.weekly-table td {
  padding: 2px 3px !important;
  line-height: 1.25;
  vertical-align: middle;
}
.weekly-table th { font-size: 9px; font-weight: 700; }
.col-num { width: 22px; min-width: 22px; text-align: center; }
.col-name { width: 22%; }
.col-spec { width: 16%; font-size: 9px; color: #334155; }
.col-day {
  width: calc((61% - 22px) / 14);
  min-width: 14px;
  max-width: 22px;
  text-align: center;
  height: 18px;
}
.group-stock { background: #1e5a96 !important; }
.group-order { background: #2d6a4f !important; }
.name-ar { font-weight: 600; font-size: 10px; }
.name-en { font-size: 9px; color: #64748b; font-weight: 400; }
tr.cat-header td {
  background: #e8f0fa;
  color: #185FA5;
  font-weight: 700;
  font-size: 10px;
  border-color: #b8cfe8;
  padding: 3px 6px !important;
}
tr.cat-header + tr td { border-top: 1px solid #185FA5; }
tr:nth-child(even) td { background: #fafbfc; }
thead { display: table-header-group; }
`.trim();

function slugPart(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildItemsCatalogWeeklyPdfFilename(
  filters: ItemsCatalogPrintFilters,
  categories: OrderCategory[],
  sections: OrderSection[],
) {
  const parts = ['items-weekly', filters.productType];

  if (filters.section === '__none__') parts.push('no-section');
  else if (filters.section) {
    const section = sections.find((item) => item.nameAr === filters.section);
    parts.push(slugPart(section?.nameAr || section?.nameEn || filters.section));
  }

  if (filters.categoryId) {
    const category = categories.find((item) => item.id === filters.categoryId);
    parts.push(slugPart(category?.nameAr || category?.nameEn || 'category'));
  }

  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.filter(Boolean).join('-')}.pdf`;
}

function prepareItemsCatalogWeeklyDocument(opts: ItemsCatalogOutputOpts) {
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
  const subtitle = [opts.productTypeLabel, filterSubtitle].filter(Boolean).join(' - ');

  return {
    empty: false as const,
    subtitle,
    body: buildItemsCatalogWeeklyPrintHtml(groups, opts.t, opts.unitLabel, groupByCategory),
    pdfFilename: buildItemsCatalogWeeklyPdfFilename(opts.filters, opts.categories, opts.sections),
  };
}

export function buildItemsCatalogWeeklyDocumentHtml(
  opts: ItemsCatalogOutputOpts,
  mode: 'print' | 'pdf',
): { empty: true } | { empty: false; title: string; html: string } {
  const doc = prepareItemsCatalogWeeklyDocument(opts);
  if (doc.empty) return { empty: true };

  const title = mode === 'pdf'
      ? doc.pdfFilename.replace(/\.pdf$/i, '')
      : opts.t('ordersPrintWeeklySheetTitle');
  const html = buildPrintDocumentHtml({
    title,
    companyName: opts.companyName,
    logoUrl: opts.logoUrl || '',
    subtitle: doc.subtitle,
    body: doc.body,
    extraCss: WEEKLY_PRINT_EXTRA_CSS,
    landscape: true,
    pageMarginMm: 6,
    showPageCounter: false,
    htmlLang: opts.lang === 'en' ? 'en' : 'ar',
    htmlDir: opts.lang === 'en' ? 'ltr' : 'rtl',
  });

  return { empty: false, title, html };
}
