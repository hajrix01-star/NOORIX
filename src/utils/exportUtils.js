/**
 * exportUtils — تصدير Excel و PDF (Dynamic Imports)
 */
import {
  ORDER_PRODUCTS_TEMPLATE_MARKER_AR,
  ORDER_CATEGORIES_TEMPLATE_MARKER_AR,
} from '../modules/Orders/constants/importTemplate';

function setSheetColWidths(ws, widths) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

/** رؤوس أعمدة أصناف الطلبات — خلية لكل قيمة (بدون JSON في خلية واحدة) */
export const ORDER_PRODUCTS_EXCEL_HEADERS = ['nameAr', 'nameEn', 'category', 'size', 'packaging', 'unit', 'lastPrice'];

/** رؤوس أعمدة فئات الطلبات */
export const ORDER_CATEGORIES_EXCEL_HEADERS = ['nameAr', 'nameEn'];

/**
 * صفوف مصفوفة لـ Excel: صف عناوين + بيانات؛ تركيبات متعددة = صفوف لاحقة بـ nameAr فارغ
 */
export function flattenOrderProductsToAoA(products) {
  const aoa = [ORDER_PRODUCTS_EXCEL_HEADERS];
  for (const p of products || []) {
    const cat = p.category?.nameAr || p.category?.nameEn || '';
    const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
    if (variants) {
      variants.forEach((v, i) => {
        aoa.push([
          i === 0 ? (p.nameAr ?? '') : '',
          i === 0 ? (p.nameEn ?? '') : '',
          i === 0 ? cat : '',
          v.size ?? '',
          v.packaging ?? '',
          v.unit ?? 'piece',
          String(v.lastPrice ?? 0),
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
        String(p.lastPrice ?? 0),
      ]);
    }
  }
  return aoa;
}

export function flattenOrderCategoriesToAoA(categories) {
  return [ORDER_CATEGORIES_EXCEL_HEADERS, ...(categories || []).map((c) => [c.nameAr ?? '', c.nameEn ?? ''])];
}

export async function exportOrderProductsWorkbook(products, filename = 'order-products.xlsx') {
  const XLSX = await import('xlsx');
  const aoa = flattenOrderProductsToAoA(products);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(ws, [26, 22, 20, 16, 16, 11, 12]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'أصناف');
  XLSX.writeFile(wb, filename);
}

export async function exportOrderCategoriesWorkbook(categories, filename = 'order-categories.xlsx') {
  const XLSX = await import('xlsx');
  const aoa = flattenOrderCategoriesToAoA(categories);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(ws, [32, 28]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'فئات');
  XLSX.writeFile(wb, filename);
}

function rowHasOrderProductVariantData(r) {
  const lp = parseFloat(String(r.lastPrice ?? r.last_price ?? '').replace(',', '.'), 10);
  return Boolean(
    String(r.size ?? '').trim()
    || String(r.packaging ?? '').trim()
    || String(r.unit ?? '').trim()
    || (Number.isFinite(lp) && lp > 0),
  );
}

/** يتخطى صف المثال وصفوف التركيبة التابعة له فقط؛ صف فارغ ينهي تخطي المثال */
export function filterOrderProductsTemplateRows(rows, markerAr = ORDER_PRODUCTS_TEMPLATE_MARKER_AR) {
  const out = [];
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

export function filterOrderCategoriesTemplateRows(rows, markerAr = ORDER_CATEGORIES_TEMPLATE_MARKER_AR) {
  return rows.filter((r) => String(r.nameAr ?? r.name_ar ?? '').trim() !== markerAr);
}

function looksLikeLegacyVariantsCell(val) {
  const s = String(val ?? '').trim();
  if (!s || s[0] !== '[') return false;
  try {
    const j = JSON.parse(s);
    return Array.isArray(j);
  } catch {
    return false;
  }
}

/**
 * تجميع صفوف الاستيراد: مجموعة «مسطّحة» (أعمدة منفصلة) أو «legacy» (عمود variants JSON)
 * @returns {Array<{ type: 'flat', nameAr: string, nameEn: string, category: string, variantRows: object[] } | { type: 'legacy', row: object }>}
 */
export function groupOrderProductImportRows(rows) {
  const groups = [];
  let flat = null;
  for (const r of rows) {
    if (looksLikeLegacyVariantsCell(r.variants)) {
      if (flat) {
        groups.push({ type: 'flat', ...flat });
        flat = null;
      }
      groups.push({ type: 'legacy', row: r });
      continue;
    }
    const nameAr = String(r.nameAr ?? r.name_ar ?? '').trim();
    if (nameAr) {
      if (flat) groups.push({ type: 'flat', ...flat });
      flat = {
        nameAr,
        nameEn: String(r.nameEn ?? r.name_en ?? '').trim(),
        category: String(r.category ?? r.categoryName ?? '').trim(),
        variantRows: [r],
      };
    } else if (flat) {
      flat.variantRows.push(r);
    }
  }
  if (flat) groups.push({ type: 'flat', ...flat });
  return groups;
}

/**
 * تحويل المجموعات إلى payload للـ API (createProductsBatch)
 * @param {Map<string,string>} catByName — مفتاح اسم الفئة بالعربي (حروف صغيرة)
 */
export function orderProductImportGroupsToPayload(groups, catByName) {
  const out = [];
  for (const g of groups) {
    if (g.type === 'legacy') {
      const r = g.row;
      const nameAr = String(r.nameAr ?? r.name_ar ?? '').trim();
      if (!nameAr) continue;
      const catName = String(r.category ?? r.categoryName ?? '').trim().toLowerCase();
      const categoryId = catName ? catByName.get(catName) : undefined;
      let variants;
      try {
        const parsed = JSON.parse(String(r.variants).trim());
        if (Array.isArray(parsed)) {
          variants = parsed.map((v) => ({
            size: v.size || '',
            packaging: v.packaging || '',
            unit: v.unit || 'piece',
            lastPrice: String(v.lastPrice ?? 0),
          }));
        }
      } catch {
        variants = undefined;
      }
      out.push({
        nameAr,
        nameEn: String(r.nameEn ?? r.name_en ?? '').trim() || undefined,
        categoryId: categoryId || undefined,
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
      (v) => v.size || v.packaging || (v.unit && v.unit !== 'piece') || parseFloat(v.lastPrice) > 0,
    );
    const finalVariants = nonEmpty.length > 0 ? nonEmpty : [{ size: '', packaging: '', unit: 'piece', lastPrice: variants[0] ? variants[0].lastPrice : '0' }];
    out.push({
      nameAr: g.nameAr,
      nameEn: g.nameEn || undefined,
      categoryId: categoryId || undefined,
      variants: finalVariants,
    });
  }
  return out.filter((p) => p.nameAr);
}

/**
 * قالب استيراد أصناف الطلبات — صف عناوين + خلايا منفصلة؛ مثال بتركيبتين على صفّين
 */
export async function exportOrdersProductsImportTemplate(filename = 'order-products-import-template.xlsx') {
  const XLSX = await import('xlsx');
  const emptyRow = () => ['', '', '', '', '', '', ''];
  const aoa = [
    ORDER_PRODUCTS_EXCEL_HEADERS,
    [ORDER_PRODUCTS_TEMPLATE_MARKER_AR, 'Example item (delete row)', 'ألبان', 'كبير', 'كرتون', 'piece', '18.5'],
    ['', '', '', 'وسط', 'علبة', 'piece', '12'],
    ...Array.from({ length: 12 }, emptyRow),
  ];
  const wsData = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(wsData, [26, 22, 20, 16, 16, 11, 12]);

  const instructions = [
    ['البند', 'الشرح'],
    ['قالب استيراد الأصناف — Noorix', ''],
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
    ['lastPrice', 'آخر سعر رقمي.'],
    ['', ''],
    ['تركيبات متعددة', 'لنفس الصنف: اترك nameAr وnameEn وcategory فارغة في الصف التالي واملأ size/packaging/unit/lastPrice فقط.'],
    ['ملفات قديمة', 'عمود variants كنص JSON لا يزال مدعوماً إن وُجد.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  setSheetColWidths(wsInstr, [28, 62]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'أصناف');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'تعليمات');
  XLSX.writeFile(wb, filename);
}

/**
 * قالب استيراد فئات الطلبات — صف عناوين + خلايا منفصلة
 */
export async function exportOrdersCategoriesImportTemplate(filename = 'order-categories-import-template.xlsx') {
  const XLSX = await import('xlsx');
  const aoa = [
    ORDER_CATEGORIES_EXCEL_HEADERS,
    [ORDER_CATEGORIES_TEMPLATE_MARKER_AR, 'Example category (delete row)'],
    ...Array.from({ length: 15 }, () => ['', '']),
  ];
  const wsData = XLSX.utils.aoa_to_sheet(aoa);
  setSheetColWidths(wsData, [32, 28]);

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

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'فئات');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'تعليمات');
  XLSX.writeFile(wb, filename);
}

export async function exportToExcel(data, filename = 'export.xlsx') {
  const XLSX = await import('xlsx');
  const rows = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

export async function exportToPdf(content, filename = 'export.pdf') {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text(typeof content === 'string' ? content : 'PDF Export', 10, 10);
  doc.save(filename);
}

/**
 * exportTableToPdf — تصدير جدول إلى PDF باستخدام jspdf-autotable
 * @param {{ columns?: string[], data: Object[]|any[][], title?: string, filename?: string }} opts
 * - data: array of objects (keys = columns) or array of arrays
 * - columns: optional; if data is objects, derived from first row keys
 */
/**
 * importFromExcel — قراءة ملف Excel وإرجاع صفوف كـ JSON
 * @param {File} file
 * @param {{ headerRow?: number }} opts - headerRow: صف العناوين (0=الأول، 1=الثاني، ...)
 * @returns {Promise<Object[]>}
 */
export async function importFromExcel(file, opts = {}) {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array', dateNF: 'yyyy-mm-dd' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { headerRow = 0 } = opts;

  if (headerRow > 0) {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!raw.length || raw.length <= headerRow) return [];
    const headers = raw[headerRow].map((h, i) => String(h || '').trim() || `العمود_${i + 1}`);
    return raw.slice(headerRow + 1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
      return obj;
    });
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  if (rows.length && typeof rows[0] === 'object') {
    const keys = Object.keys(rows[0]);
    const badKeys = keys.filter((k) => !k || k.startsWith('__') || /^[A-Z]+$/.test(k));
    if (badKeys.length === keys.length && keys.length > 0) {
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (raw.length >= 2) {
        const headers = raw[0].map((h, i) => String(h || '').trim() || `العمود_${i + 1}`);
        return raw.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });
      }
    }
  }
  return rows;
}

/**
 * importExcelRaw — قراءة Excel كصفوف خام (مصفوفة مصفوفات) بدون افتراض عناوين
 * @param {File} file
 * @returns {Promise<{ raw: any[][], colCount: number }>}
 */
/**
 * اختيار الورقة ذات أكثر صفوف بيانات (مثل readExcelToJson في Base44) + cellDates للتواريخ
 */
export async function importExcelRaw(file) {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
  let bestRows = [];
  let maxDataRows = 0;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const rows = json.map((r) => (Array.isArray(r) ? r : []));
    const dataRows = rows.filter((row) => row?.filter((c) => c !== '' && c != null).length >= 2);
    if (dataRows.length > maxDataRows) {
      maxDataRows = dataRows.length;
      bestRows = rows;
    }
  }
  const colCount = bestRows.length ? Math.max(...bestRows.map((r) => r.length)) : 0;
  const normalized = bestRows.map((r) => {
    const arr = [...r];
    while (arr.length < colCount) arr.push('');
    return arr;
  });
  return { raw: normalized, colCount };
}

/**
 * importBankStatementFile — قراءة Excel أو CSV كصفوف خام لتحليل الكشف
 */
export async function importBankStatementFile(file) {
  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (ext === 'csv') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const raw = lines.map((line) => {
      const parts = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQ = !inQ;
        else if ((c === ',' || c === ';' || c === '\t') && !inQ) {
          parts.push(String(cur).replace(/^"|"$/g, '').trim());
          cur = '';
        } else cur += c;
      }
      parts.push(String(cur).replace(/^"|"$/g, '').trim());
      return parts;
    });
    const colCount = raw.length ? Math.max(...raw.map((r) => r.length)) : 0;
    const normalized = raw.map((r) => {
      const arr = [...r];
      while (arr.length < colCount) arr.push('');
      return arr;
    });
    return { raw: normalized, colCount };
  }
  return importExcelRaw(file);
}

export async function exportTableToPdf({ columns, data, title = '', filename = 'export.pdf' }) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  let y = 10;
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, y);
    y += 10;
  }
  const cols = columns || (data[0] && typeof data[0] === 'object' && !Array.isArray(data[0]) ? Object.keys(data[0]) : []);
  const head = [cols];
  const body = data.map((row) =>
    Array.isArray(row) ? row.map((c) => String(c ?? '')) : cols.map((c) => String(row[c] ?? '')),
  );
  autoTable(doc, {
    head,
    body: body.length ? body : [['لا توجد بيانات']],
    startY: y,
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(filename);
}
