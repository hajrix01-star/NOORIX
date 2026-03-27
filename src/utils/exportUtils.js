/**
 * exportUtils — تصدير Excel و PDF (Dynamic Imports)
 */
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
