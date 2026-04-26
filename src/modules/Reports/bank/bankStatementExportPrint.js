/**
 * تصدير Excel وطباعة كشف الحساب — تحميل xlsx-js-style فقط عند التصدير (توفير الـ bundle).
 */
import { fmt } from '../../../utils/format';
import { openPrintWindow } from '../../../utils/printUtils';

/** لون رأس الأعمدة (أزرق Noorix) */
const HEADER_BG = '185FA5';
const HEADER_FONT = { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 };
const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: HEADER_BG } };
const HEADER_ALIGN_R = { horizontal: 'right', vertical: 'center', wrapText: false };

/** @param {import('xlsx-js-style').default} XLSX */
function applySheetView(XLSX, ws, ySplit) {
  if (!ws['!views']) ws['!views'] = [{}];
  ws['!views'][0].rightToLeft = true;
  if (ySplit > 0) {
    ws['!views'][0].state = 'frozen';
    ws['!views'][0].ySplit = ySplit;
    ws['!views'][0].xSplit = 0;
    ws['!views'][0].topLeftCell = XLSX.utils.encode_cell({ r: ySplit, c: 0 });
  }
}

/** @param {import('xlsx-js-style').default} XLSX */
function styleHeaderRow(XLSX, ws, rowIdx, colCount) {
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

function styleTitleCell(XLSX, ws, rowIdx) {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
  if (!ws[addr]) return;
  ws[addr].s = { font: { bold: true, sz: 13, color: { rgb: '1E3A5F' } } };
}

function styleSummaryCell(XLSX, ws, rowIdx, colCount) {
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

/**
 * @returns {Promise<void>}
 */
export async function exportBankStatementExcel({
  statement,
  companyName,
  filteredTransactions,
  columnTotals,
  summaryByCategory,
}) {
  if (!statement) return;
  const { default: XLSX } = await import('xlsx-js-style');

  const wb = XLSX.utils.book_new();
  const period = `${statement.startDate?.slice(0, 10) || ''} → ${statement.endDate?.slice(0, 10) || ''}`;

  // ─── ورقة العمليات ───────────────────────────────────────────────────────
  const COLS = 9;
  const DATA_ROW_START = 7;

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
    [companyName || '—'],
    [`${statement.bankName || ''} — ${statement.fileName || ''}`],
    [`الفترة: ${period}`],
    [`إجمالي إيداعات الكشف: ${fmt(Number(statement.totalDeposits) || 0)} SR`],
    [`إجمالي سحوبات الكشف: ${fmt(Number(statement.totalWithdrawals) || 0)} SR`],
    [],
    ['#', 'التاريخ', 'الوصف', 'المرجع', 'التصنيف', 'مدين', 'دائن', 'الرصيد', 'ملاحظة'],
    ...dataAoA,
  ]);

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

  applySheetView(XLSX, ws, DATA_ROW_START);
  styleTitleCell(XLSX, ws, 0);
  styleHeaderRow(XLSX, ws, 6, COLS);
  styleSummaryCell(XLSX, ws, footerRow - 1, COLS);

  XLSX.utils.book_append_sheet(wb, ws, 'العمليات');

  // ─── ورقة ملخص التصنيفات ─────────────────────────────────────────────────
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
    [companyName || '—'],
    ['ملخص التصنيفات'],
    [`الفترة: ${period}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(ws2, catRows, { origin: 'A5' });

  ws2['!cols'] = [{ wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

  applySheetView(XLSX, ws2, 5);
  styleTitleCell(XLSX, ws2, 0);
  styleHeaderRow(XLSX, ws2, 4, catHeaders.length);

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
  const period = `${statement.startDate?.slice(0, 10) || ''} — ${statement.endDate?.slice(0, 10) || ''}`;
  const rows = filteredTransactions
    .map(
      (tx) => `<tr>
      <td>${tx.txDate || ''}</td>
      <td>${(tx.description || '').replace(/</g, '&lt;')}</td>
      <td>${tx.category?.nameAr || tx.category?.nameEn || '—'}</td>
      <td>${fmt(Number(tx.debit) || 0)}</td>
      <td>${fmt(Number(tx.credit) || 0)}</td>
    </tr>`,
    )
    .join('');
  openPrintWindow({
    title: `كشف حساب — ${companyName || ''}`,
    companyName: companyName || '',
    subtitle: `${statement.bankName || ''} — ${period} | الملف: ${statement.fileName || ''}`,
    body: `<table>
<thead><tr><th>التاريخ</th><th>الوصف</th><th>التصنيف</th><th>مدين</th><th>دائن</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="3">مجموع المعروض</td><td>${fmt(columnTotals.debit)}</td><td>${fmt(columnTotals.credit)}</td></tr></tfoot>
</table>`,
  });
}
