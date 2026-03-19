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
 * @returns {Promise<Object[]>}
 */
export async function importFromExcel(file) {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
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
