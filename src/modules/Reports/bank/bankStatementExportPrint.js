/**
 * تصدير Excel وطباعة كشف الحساب
 */
import XLSXmod from 'xlsx-js-style';
import { fmt } from '../../../utils/format';

const XLSX = XLSXmod;

/** لون رأس الأعمدة (أزرق Noorix) */
const HEADER_BG = '185FA5';
const HEADER_FONT = { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 };
const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: HEADER_BG } };
const HEADER_ALIGN_R = { horizontal: 'right', vertical: 'center', wrapText: false };

/** تطبيق تنسيق RTL وتجميد الصفوف على ورقة */
function applySheetView(ws, ySplit) {
  if (!ws['!views']) ws['!views'] = [{}];
  ws['!views'][0].rightToLeft = true;
  if (ySplit > 0) {
    ws['!views'][0].state = 'frozen';
    ws['!views'][0].ySplit = ySplit;
    ws['!views'][0].xSplit = 0;
    ws['!views'][0].topLeftCell = XLSX.utils.encode_cell({ r: ySplit, c: 0 });
  }
}

/** تنسيق خلايا صف رأس الأعمدة (rowIdx: 0-indexed) */
function styleHeaderRow(ws, rowIdx, colCount) {
  for (let ci = 0; ci < colCount; ci++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
    if (!ws[addr]) continue;
    ws[addr].s = {
      fill: HEADER_FILL,
      font: HEADER_FONT,
      alignment: HEADER_ALIGN_R,
    };
  }
}

/** تنسيق صف عنوان رئيسي (كبير + غامق) */
function styleTitleCell(ws, rowIdx) {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
  if (!ws[addr]) return;
  ws[addr].s = { font: { bold: true, sz: 13, color: { rgb: '1E3A5F' } } };
}

/** تنسيق صف ملخص/إحصاء (غامق بخلفية خفيفة) */
function styleSummaryCell(ws, rowIdx, colCount) {
  for (let ci = 0; ci < colCount; ci++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, sz: 10, color: { rgb: '374151' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'right', vertical: 'center' },
    };
  }
}

export function exportBankStatementExcel({
  statement,
  companyName,
  filteredTransactions,
  columnTotals,
  summaryByCategory,
}) {
  if (!statement) return;
  const wb = XLSX.utils.book_new();
  const period = `${statement.startDate?.slice(0, 10) || ''} → ${statement.endDate?.slice(0, 10) || ''}`;

  // ─── ورقة العمليات ───────────────────────────────────────────────────────
  const COLS = 9;
  const DATA_ROW_START = 7; // 1-indexed (row index 6 = header)

  const dataAoA = filteredTransactions.map((tx, idx) => [
    idx + 1,
    tx.txDate || '',
    tx.description || '',
    tx.reference || '',
    tx.category?.nameAr || tx.category?.nameEn || '—',
    Number(tx.debit) || 0,
    Number(tx.credit) || 0,
    tx.balance != null ? Number(tx.balance) : '',
    tx.note || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [companyName || '—'],                                                               // row 0
    [`${statement.bankName || ''} — ${statement.fileName || ''}`],                     // row 1
    [`الفترة: ${period}`],                                                              // row 2
    [`إجمالي إيداعات الكشف: ${fmt(Number(statement.totalDeposits) || 0)} SR`],        // row 3
    [`إجمالي سحوبات الكشف: ${fmt(Number(statement.totalWithdrawals) || 0)} SR`],      // row 4
    [],                                                                                  // row 5
    ['#', 'التاريخ', 'الوصف', 'المرجع', 'التصنيف', 'مدين', 'دائن', 'الرصيد', 'ملاحظة'], // row 6 ← header
    ...dataAoA,
  ]);

  // صف المجموع
  const footerRow = DATA_ROW_START + dataAoA.length;
  XLSX.utils.sheet_add_aoa(
    ws,
    [['', '', '', '', 'المجموع (المعروض):', columnTotals.debit, columnTotals.credit, '', '']],
    { origin: `A${footerRow}` },
  );

  ws['!cols'] = [
    { wch: 4 }, { wch: 12 }, { wch: 42 }, { wch: 14 }, { wch: 18 },
    { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 22 },
  ];

  // RTL + تجميد الصفوف فوق رأس الأعمدة (6 صفوف معلومات + 1 رأس = 7)
  applySheetView(ws, DATA_ROW_START);

  // تنسيق صف العنوان الرئيسي
  styleTitleCell(ws, 0);

  // تنسيق صف الرأس (row index 6)
  styleHeaderRow(ws, 6, COLS);

  // تنسيق صف المجموع
  styleSummaryCell(ws, footerRow - 1, COLS);

  XLSX.utils.book_append_sheet(wb, ws, 'العمليات');

  // ─── ورقة ملخص التصنيفات ─────────────────────────────────────────────────
  const catHeaders = ['التصنيف', 'العدد', 'إجمالي مدين', 'إجمالي دائن', 'الصافي'];
  const catRows = Object.entries(summaryByCategory)
    .map(([name, d]) => ({
      التصنيف: name,
      العدد: d.count,
      'إجمالي مدين': d.totalDebit,
      'إجمالي دائن': d.totalCredit,
      الصافي: d.totalCredit - d.totalDebit,
    }))
    .sort((a, b) => b['إجمالي مدين'] - a['إجمالي مدين']);

  const ws2 = XLSX.utils.aoa_to_sheet([
    [companyName || '—'],        // row 0
    ['ملخص التصنيفات'],          // row 1
    [`الفترة: ${period}`],       // row 2
    [],                           // row 3
  ]);
  XLSX.utils.sheet_add_json(ws2, catRows, { origin: 'A5' }); // header row at row index 4

  ws2['!cols'] = [{ wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

  applySheetView(ws2, 5); // تجميد 5 صفوف (3 info + 1 فارغ + 1 رأس)
  styleTitleCell(ws2, 0);
  styleHeaderRow(ws2, 4, catHeaders.length); // row index 4 = A5

  XLSX.utils.book_append_sheet(wb, ws2, 'ملخص التصنيفات');

  const fname = `كشف_${(statement.bankName || 'bank').replace(/\s+/g, '_')}_${statement.startDate?.slice(0, 7) || 'export'}.xlsx`;
  XLSX.writeFile(wb, fname);
}

export function printBankStatement({
  statement,
  companyName,
  filteredTransactions,
  columnTotals,
}) {
  if (!statement) return;
  const w = window.open('', '_blank');
  if (!w) return;
  const period = `${statement.startDate?.slice(0, 10) || ''} — ${statement.endDate?.slice(0, 10) || ''}`;
  const rows = filteredTransactions
    .map(
      (tx) => `<tr>
      <td>${tx.txDate || ''}</td>
      <td>${(tx.description || '').replace(/</g, '&lt;')}</td>
      <td>${tx.category?.nameAr || tx.category?.nameEn || '—'}</td>
      <td style="text-align:left">${fmt(Number(tx.debit) || 0)}</td>
      <td style="text-align:left">${fmt(Number(tx.credit) || 0)}</td>
    </tr>`,
    )
    .join('');
  const printDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب - ${(companyName || '').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:15mm 15mm 20mm;@bottom-center{content:"صفحة " counter(page) " من " counter(pages);font-family:'Cairo',Arial,sans-serif;font-size:10px;color:#555}}
  *{box-sizing:border-box}
  body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:13px;color:#1a1a1a;line-height:1.6}
  .header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:20px}
  .header h1{margin:0 0 4px;font-size:20px;font-weight:800}
  .header .sub{font-size:12px;color:#555;margin:2px 0}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ddd;padding:6px 10px;text-align:right}
  th{background:#185FA5;color:#fff;font-weight:700}
  tfoot tr{font-weight:700;background:#f1f5f9}
  .print-footer{margin-top:20px;padding-top:8px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#777}
  @media print{body{padding:0}}
</style></head><body>
<div class="header">
  <h1>${(companyName || '').replace(/</g, '&lt;')}</h1>
  <div class="sub">${(statement.bankName || '').replace(/</g, '&lt;')} — ${period}</div>
  <div class="sub">الملف: ${(statement.fileName || '').replace(/</g, '&lt;')}</div>
</div>
<table><thead><tr><th>التاريخ</th><th>الوصف</th><th>التصنيف</th><th>مدين</th><th>دائن</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="3">مجموع المعروض</td><td>${fmt(columnTotals.debit)}</td><td>${fmt(columnTotals.credit)}</td></tr></tfoot>
</table>
<div class="print-footer">طُبع بتاريخ: ${printDate}</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  w.document.close();
}
