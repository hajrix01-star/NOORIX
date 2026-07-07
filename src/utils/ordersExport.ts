/**
 * تصدير/استيراد قوالب Excel لأصناف الطلبات وفئاتها
 */
import {
  ORDER_CATEGORIES_TEMPLATE_MARKER_AR,
  getOrderProductsTemplateMarkerAr,
  type OrderCatalogProductType,
} from '../modules/Orders/constants/importTemplate';
import type { OrderCategory, OrderProduct, OrderProductPayload, OrderProductVariant } from '../types/api';

type WorksheetCellLike = { s?: unknown };
type WorksheetLike = Record<string, WorksheetCellLike | unknown> & { '!cols'?: { wch: number }[]; '!views'?: Array<{ rightToLeft?: boolean }> };
type XlsxLike = {
  default?: XlsxLike;
  utils: {
    encode_cell: (cell: { r: number; c: number }) => string;
    aoa_to_sheet: (rows: unknown[][]) => WorksheetLike;
    book_new: () => unknown;
    book_append_sheet: (wb: unknown, ws: WorksheetLike, name: string) => void;
  };
  writeFile: (wb: unknown, filename: string) => void;
};
export type ImportRow = Record<string, unknown>;
export type OrderProductImportGroup =
  | { type: 'legacy'; row: ImportRow }
  | { type: 'flat'; nameAr: string; nameEn: string; category: string; sectionsRaw: string; variantRows: ImportRow[] };

function setSheetColWidths(ws: WorksheetLike, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

function setSheetRTL(ws: WorksheetLike) {
  if (!ws['!views']) ws['!views'] = [{}];
  ws['!views'][0].rightToLeft = true;
}

function styleHeaderRow(XLSXmod: XlsxLike, ws: WorksheetLike, rowIdx: number, colCount: number) {
  const XLSX = XLSXmod.default ?? XLSXmod;
  const HEADER_S = {
    fill: { patternType: 'solid', fgColor: { rgb: '185FA5' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    alignment: { horizontal: 'right', vertical: 'center' },
  };
  for (let ci = 0; ci < colCount; ci++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
    const cell = ws[addr];
    if (!cell || typeof cell !== 'object') continue;
    (cell as WorksheetCellLike).s = HEADER_S;
  }
}

export const ORDER_PRODUCTS_EXCEL_HEADERS = [
  'nameAr',
  'nameEn',
  'category',
  'size',
  'packaging',
  'unit',
  'lastPrice',
  'sections',
];

/** يطابق أسماء الأقسام من النظام (فاصلة عربية/إنجليزية) */
export function parseOrderProductSectionsCell(
  raw: unknown,
  knownSectionNames: string[],
  fallback: string[] = [],
): string[] {
  const fromCell = String(raw ?? '')
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const knownLower = new Map(knownSectionNames.map((n) => [n.trim().toLowerCase(), n.trim()]));
  const resolved = fromCell
    .map((s) => knownLower.get(s.toLowerCase()))
    .filter((s): s is string => Boolean(s));
  const picked = resolved.length > 0 ? resolved : fallback.filter((s) => knownLower.has(s.toLowerCase()));
  return [...new Set(picked)];
}

export const ORDER_CATEGORIES_EXCEL_HEADERS = ['nameAr', 'nameEn'];

export function flattenOrderProductsToAoA(products: OrderProduct[]) {
  const aoa: unknown[][] = [ORDER_PRODUCTS_EXCEL_HEADERS];
  for (const p of products || []) {
    const cat = p.category?.nameAr || p.category?.nameEn || '';
    const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
    if (variants) {
      (variants as OrderProductVariant[]).forEach((v, i) => {
        aoa.push([
          i === 0 ? (p.nameAr ?? '') : '',
          i === 0 ? (p.nameEn ?? '') : '',
          i === 0 ? cat : '',
          v.size ?? '',
          v.packaging ?? '',
          v.unit ?? 'piece',
          parseFloat(String(v.lastPrice ?? 0)) || 0,
          i === 0 && Array.isArray(p.sections) && p.sections.length ? (p.sections as string[]).join('، ') : '',
        ]);
      });
    } else {
      aoa.push([
        p.nameAr ?? '',
        p.nameEn ?? '',
        cat,
        '',
        '',
        p.unit ?? 'piece',
        parseFloat(String(p.lastPrice ?? 0)) || 0,
        Array.isArray(p.sections) && p.sections.length ? (p.sections as string[]).join('، ') : '',
      ]);
    }
  }
  return aoa;
}

export function flattenOrderCategoriesToAoA(categories: OrderCategory[]) {
  return [ORDER_CATEGORIES_EXCEL_HEADERS, ...(categories || []).map((c) => [c.nameAr ?? '', c.nameEn ?? ''])];
}

export async function exportOrderProductsWorkbook(products: OrderProduct[], filename = 'order-products.xlsx') {
  const XLSXmod = await import('xlsx-js-style') as XlsxLike;
  const XLSX = XLSXmod.default ?? XLSXmod;
  const aoa = flattenOrderProductsToAoA(products);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(ws, [26, 22, 20, 16, 16, 11, 12, 22]);
  setSheetRTL(ws);
  styleHeaderRow(XLSXmod, ws, 0, ORDER_PRODUCTS_EXCEL_HEADERS.length);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'أصناف');
  XLSX.writeFile(wb, filename);
}

export async function exportOrderCategoriesWorkbook(categories: OrderCategory[], filename = 'order-categories.xlsx') {
  const XLSXmod = await import('xlsx-js-style') as XlsxLike;
  const XLSX = XLSXmod.default ?? XLSXmod;
  const aoa = flattenOrderCategoriesToAoA(categories);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(ws, [32, 28]);
  setSheetRTL(ws);
  styleHeaderRow(XLSXmod, ws, 0, ORDER_CATEGORIES_EXCEL_HEADERS.length);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'فئات');
  XLSX.writeFile(wb, filename);
}

function rowHasOrderProductVariantData(r: ImportRow) {
  const lp = parseFloat(String(r.lastPrice ?? r.last_price ?? '').replace(',', '.'));
  return Boolean(
    String(r.size ?? '').trim()
    || String(r.packaging ?? '').trim()
    || String(r.unit ?? '').trim()
    || (Number.isFinite(lp) && lp > 0),
  );
}

export function filterOrderProductsTemplateRows(
  rows: ImportRow[],
  productTypeOrMarker: OrderCatalogProductType | string = 'order',
) {
  const markerAr =
    productTypeOrMarker === 'order' || productTypeOrMarker === 'sale'
      ? getOrderProductsTemplateMarkerAr(productTypeOrMarker)
      : productTypeOrMarker;
  const out: ImportRow[] = [];
  let afterMarker = false;
  for (const r of rows) {
    const nameAr = String(r.nameAr ?? r.name_ar ?? '').trim();
    if (nameAr === markerAr) {
      afterMarker = true;
      continue;
    }
    if (afterMarker) {
      if (nameAr) {
        afterMarker = false;
      } else if (rowHasOrderProductVariantData(r)) {
        continue;
      } else {
        afterMarker = false;
      }
    }
    out.push(r);
  }
  return out;
}

export function filterOrderCategoriesTemplateRows(rows: ImportRow[], markerAr: string = ORDER_CATEGORIES_TEMPLATE_MARKER_AR) {
  return rows.filter((r) => String(r.nameAr ?? r.name_ar ?? '').trim() !== markerAr);
}

function looksLikeLegacyVariantsCell(val: unknown) {
  const s = String(val ?? '').trim();
  if (!s || s[0] !== '[') return false;
  try {
    const j = JSON.parse(s);
    return Array.isArray(j);
  } catch {
    return false;
  }
}

export function groupOrderProductImportRows(rows: ImportRow[]): OrderProductImportGroup[] {
  const groups: OrderProductImportGroup[] = [];
  let flat: Extract<OrderProductImportGroup, { type: 'flat' }> | null = null;
  for (const r of rows) {
    if (looksLikeLegacyVariantsCell(r.variants)) {
      if (flat) {
        groups.push(flat);
        flat = null;
      }
      groups.push({ type: 'legacy', row: r });
      continue;
    }
    const nameAr = String(r.nameAr ?? r.name_ar ?? '').trim();
    if (nameAr) {
      if (flat) groups.push(flat);
      flat = {
        type: 'flat',
        nameAr,
        nameEn: String(r.nameEn ?? r.name_en ?? '').trim(),
        category: String(r.category ?? r.categoryName ?? '').trim(),
        sectionsRaw: String(r.sections ?? r.section ?? '').trim(),
        variantRows: [r],
      };
    } else if (flat) {
      flat.variantRows.push(r);
    }
  }
  if (flat) groups.push(flat);
  return groups;
}

export function orderProductImportGroupsToPayload(
  groups: OrderProductImportGroup[],
  catByName: Map<string, string>,
  productType: OrderCatalogProductType = 'order',
  opts: { knownSectionNames?: string[]; defaultSections?: string[] } = {},
): OrderProductPayload[] {
  const knownSectionNames = opts.knownSectionNames ?? [];
  const defaultSections = opts.defaultSections ?? [];
  const out: OrderProductPayload[] = [];
  for (const g of groups) {
    if (g.type === 'legacy') {
      const r = g.row;
      const nameAr = String(r.nameAr ?? r.name_ar ?? '').trim();
      if (!nameAr) continue;
      const catName = String(r.category ?? r.categoryName ?? '').trim().toLowerCase();
      const categoryId = catName ? catByName.get(catName) : undefined;
      let variants: OrderProductVariant[] | undefined;
      try {
        const parsed = JSON.parse(String(r.variants).trim());
        if (Array.isArray(parsed)) {
          variants = (parsed as ImportRow[]).map((v) => ({
            size: String(v.size ?? ''),
            packaging: String(v.packaging ?? ''),
            unit: String(v.unit ?? 'piece') || 'piece',
            lastPrice: String(v.lastPrice ?? 0),
          }));
        }
      } catch {
        variants = undefined;
      }
      const sections = parseOrderProductSectionsCell(
        r.sections ?? r.section,
        knownSectionNames,
        defaultSections,
      );
      out.push({
        nameAr,
        nameEn: String(r.nameEn ?? r.name_en ?? '').trim() || undefined,
        categoryId: categoryId || undefined,
        productType,
        ...(sections.length ? { sections } : {}),
        variants,
      });
      continue;
    }
    const catName = g.category.trim().toLowerCase();
    const categoryId = catName ? catByName.get(catName) : undefined;
    const variants = g.variantRows.map((r) => ({
      size: String(r.size ?? '').trim(),
      packaging: String(r.packaging ?? '').trim(),
      unit: String(r.unit ?? 'piece').trim() || 'piece',
      lastPrice: String(r.lastPrice ?? r.last_price ?? 0),
    }));
    const nonEmpty = variants.filter(
      (v) => v.size || v.packaging || (v.unit && v.unit !== 'piece') || Number.parseFloat(v.lastPrice) > 0,
    );
    const finalVariants = nonEmpty.length > 0 ? nonEmpty : [{ size: '', packaging: '', unit: 'piece', lastPrice: variants[0] ? variants[0].lastPrice : '0' }];
    const sections = parseOrderProductSectionsCell(g.sectionsRaw, knownSectionNames, defaultSections);
    out.push({
      nameAr: g.nameAr,
      nameEn: g.nameEn || undefined,
      categoryId: categoryId || undefined,
      productType,
      ...(sections.length ? { sections } : {}),
      variants: finalVariants,
    });
  }
  return out.filter((p) => p.nameAr);
}

export async function exportOrdersProductsImportTemplate(
  filename = 'order-products-import-template.xlsx',
  productType: OrderCatalogProductType = 'order',
) {
  const XLSXmod = await import('xlsx-js-style') as XlsxLike;
  const XLSX = XLSXmod.default ?? XLSXmod;
  const markerAr = getOrderProductsTemplateMarkerAr(productType);
  const typeLabelAr = productType === 'sale' ? 'مبيعات' : 'طلبات';
  const typeLabelEn = productType === 'sale' ? 'sales' : 'orders';
  const emptyRow = () => ['', '', '', '', '', '', '', ''];
  const exampleSections = productType === 'sale' ? 'شيشة' : '';
  const aoa = [
    ORDER_PRODUCTS_EXCEL_HEADERS,
    [markerAr, `Example ${typeLabelEn} item (delete row)`, 'ألبان', 'كبير', 'كرتون', 'piece', 18.5, exampleSections],
    ['', '', '', 'وسط', 'علبة', 'piece', 12, ''],
    ...Array.from({ length: 12 }, emptyRow),
  ];
  const wsData = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(wsData, [26, 22, 20, 16, 16, 11, 12, 22]);
  setSheetRTL(wsData);
  styleHeaderRow(XLSXmod, wsData, 0, ORDER_PRODUCTS_EXCEL_HEADERS.length);

  const instructions = [
    ['البند', 'الشرح'],
    [`قالب استيراد أصناف ${typeLabelAr} — Noorix`, ''],
    ['نوع الصنف', `يُستورد كأصناف ${typeLabelAr} (${productType}) من تبويبة «أصناف ${typeLabelAr}».`],
    ['الورقة الأولى «أصناف»', 'صف 1 = عناوين الأعمدة؛ كل قيمة في خلية منفصلة.'],
    ['', ''],
    ['ترتيب العمل', '1) أنشئ الفئات أولاً  2) احذف صفوف المثال (المحددة بعلامة)  3) استورد من التطبيق'],
    ['', ''],
    ['nameAr', 'اسم الصنف بالعربية — إلزامي في أول صف لكل صنف.'],
    ['nameEn', 'اسم إنجليزي اختياري.'],
    ['category', 'اسم الفئة بالعربي كما في النظام.'],
    ['size', 'الحجم أو وصف الوحدة المعروض (خلية منفصلة).'],
    ['packaging', 'التغليف (خلية منفصلة).'],
    ['unit', 'piece | kg | box | dozen'],
    ['lastPrice', 'آخر سعر — رقم (يُصدَّر كرقم وليس نص).'],
    ['sections', 'أسماء الأقسام من النظام (بار، شيشة، مطبخ…) مفصولة بفاصلة — اختياري في الملف إن اخترت القسم عند الاستيراد.'],
    ['', ''],
    ['تركيبات متعددة', 'لنفس الصنف: اترك nameAr وnameEn وcategory وsections فارغة في الصف التالي واملأ size/packaging/unit/lastPrice فقط.'],
    ['ملفات قديمة', 'عمود variants كنص JSON لا يزال مدعوماً إن وُجد.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  setSheetColWidths(wsInstr, [28, 62]);
  setSheetRTL(wsInstr);
  styleHeaderRow(XLSXmod, wsInstr, 0, 2);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'أصناف');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'تعليمات');
  XLSX.writeFile(wb, filename);
}

export async function exportOrdersCategoriesImportTemplate(filename = 'order-categories-import-template.xlsx') {
  const XLSXmod = await import('xlsx-js-style') as XlsxLike;
  const XLSX = XLSXmod.default ?? XLSXmod;
  const aoa = [
    ORDER_CATEGORIES_EXCEL_HEADERS,
    [ORDER_CATEGORIES_TEMPLATE_MARKER_AR, 'Example category (delete row)'],
    ...Array.from({ length: 15 }, () => ['', '']),
  ];
  const wsData = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(wsData, [32, 28]);
  setSheetRTL(wsData);
  styleHeaderRow(XLSXmod, wsData, 0, ORDER_CATEGORIES_EXCEL_HEADERS.length);

  const instructions = [
    ['البند', 'الشرح'],
    ['قالب استيراد الفئات — Noorix', ''],
    ['الورقة «فئات»', 'صف 1: nameAr | nameEn — كل قيمة في خلية.'],
    ['nameAr', 'اسم الفئة بالعربية (إلزامي).'],
    ['nameEn', 'اسم إنجليزي اختياري.'],
    ['', ''],
    ['بعد الاستيراد', 'اربط الأصناف من عمود category في ملف الأصناف.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  setSheetColWidths(wsInstr, [22, 58]);
  setSheetRTL(wsInstr);
  styleHeaderRow(XLSXmod, wsInstr, 0, 2);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'فئات');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'تعليمات');
  XLSX.writeFile(wb, filename);
}
