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

/**
 * قالب استيراد أصناف الطلبات — ورقة بيانات + ورقة تعليمات، أعمدة بعرض مناسب
 */
export async function exportOrdersProductsImportTemplate(filename = 'order-products-import-template.xlsx') {
  const XLSX = await import('xlsx');
  const variantsExample = JSON.stringify([
    { size: 'كبير', packaging: 'كرتون', unit: 'piece', lastPrice: '18.5' },
    { size: 'وسط', packaging: 'علبة', unit: 'piece', lastPrice: '12' },
  ]);
  const dataRows = [
    {
      nameAr: ORDER_PRODUCTS_TEMPLATE_MARKER_AR,
      nameEn: 'Example item (delete row)',
      category: 'ألبان',
      variants: variantsExample,
    },
    ...Array.from({ length: 12 }, () => ({ nameAr: '', nameEn: '', category: '', variants: '' })),
  ];
  const wsData = XLSX.utils.json_to_sheet(dataRows);
  setSheetColWidths(wsData, [28, 24, 18, 56]);

  const instructions = [
    ['قالب استيراد الأصناف — Noorix'],
    ['Orders › Manage Items › Products'],
    [''],
    ['■ ترتيب العمل الموصى به'],
    ['1) عرّف الفئات أولاً (تبويب الفئات أو استيراد فئات)، ثم اكتب في العمود category نفس اسم الفئة بالعربي كما في النظام.'],
    ['2) احذف صف المثال بالكامل قبل الاستيراد الفعلي، أو استبدله ببياناتك.'],
    ['3) احفظ الملف بصيغة .xlsx ثم من التطبيق اضغط «استيراد».'],
    [''],
    ['■ معاني الأعمدة (ورقة «أصناف»)'],
    ['• nameAr — اسم الصنف بالعربية (إلزامي).'],
    ['• nameEn — اسم بالإنجليزي (اختياري).'],
    ['• category — اسم الفئة بالعربي للربط (يُفضّل أن تكون الفئة موجودة مسبقاً).'],
    ['• variants — مصفوفة JSON لتركيبات السعر: الحجم، التغليف، الوحدة، آخر سعر.'],
    [''],
    ['■ حقل variants — نسخة جاهزة (سطر واحد في الخلية)'],
    [variantsExample],
    [''],
    ['■ الوحدة unit'],
    ['استخدم واحدة من: piece (حبة) · kg (كيلو) · box (كرتون) · dozen (درزن).'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  setSheetColWidths(wsInstr, [92]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'أصناف');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'تعليمات');
  XLSX.writeFile(wb, filename);
}

/**
 * قالب استيراد فئات الطلبات — ورقة بيانات + ورقة تعليمات
 */
export async function exportOrdersCategoriesImportTemplate(filename = 'order-categories-import-template.xlsx') {
  const XLSX = await import('xlsx');
  const dataRows = [
    {
      nameAr: ORDER_CATEGORIES_TEMPLATE_MARKER_AR,
      nameEn: 'Example category (delete row)',
    },
    ...Array.from({ length: 15 }, () => ({ nameAr: '', nameEn: '' })),
  ];
  const wsData = XLSX.utils.json_to_sheet(dataRows);
  setSheetColWidths(wsData, [32, 28]);

  const instructions = [
    ['قالب استيراد الفئات — Noorix'],
    ['Orders › Manage Items › Categories'],
    [''],
    ['■ الخطوات'],
    ['1) احذف صف المثال أو استبدله بفئاتكم.'],
    ['2) nameAr إلزامي؛ nameEn اختياري.'],
    ['3) بعد الاستيراد يمكن ربط الأصناف بهذه الفئات من عمود category في قالب الأصناف.'],
    [''],
    ['■ الأعمدة'],
    ['• nameAr — اسم الفئة بالعربية.'],
    ['• nameEn — اسم بالإنجليزي (اختياري).'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  setSheetColWidths(wsInstr, [88]);

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
