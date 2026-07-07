import { fmt } from '../../../utils/format';
import { toYmd } from '../../../utils/saudiDate';
import { openPrintWindow } from '../../../utils/printUtils';
import type { BankCategoryAgg } from './bankAnalysisUtils';
import type { BankColumnTotals, BankStatementLite, BankTransactionLite } from './bankAnalysisTab.types';

const HEADER_BG = '185FA5';
const HEADER_FONT = { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 };
const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: HEADER_BG } };
const HEADER_ALIGN_R = { horizontal: 'right', vertical: 'center', wrapText: false };

type XlsxModule = typeof import('xlsx-js-style');
type SheetCell = { s?: unknown };
type Worksheet = Record<string, SheetCell | unknown> & {
  '!views'?: Array<Record<string, unknown>>;
  '!cols'?: Array<Record<string, number>>;
};

type BankStatementExportArgs = {
  statement: BankStatementLite | null | undefined;
  companyName?: string;
  filteredTransactions: readonly BankTransactionLite[];
  columnTotals: BankColumnTotals;
  summaryByCategory: Record<string, BankCategoryAgg>;
};

type BankStatementPrintArgs = Omit<BankStatementExportArgs, 'summaryByCategory'>;

type CategoryExportRow = {
  التصنيف: string;
  العدد: number;
  'إجمالي مدين': number;
  'إجمالي دائن': number;
  الصافي: number;
};

function cellAt(ws: Worksheet, address: string): SheetCell | null {
  const cell = ws[address];
  return cell && typeof cell === 'object' ? (cell as SheetCell) : null;
}

function applySheetView(XLSX: XlsxModule, ws: Worksheet, ySplit: number): void {
  if (!ws['!views']) ws['!views'] = [{}];
  ws['!views'][0].rightToLeft = true;
  if (ySplit > 0) {
    ws['!views'][0].state = 'frozen';
    ws['!views'][0].ySplit = ySplit;
    ws['!views'][0].xSplit = 0;
    ws['!views'][0].topLeftCell = XLSX.utils.encode_cell({ r: ySplit, c: 0 });
  }
}

function styleHeaderRow(XLSX: XlsxModule, ws: Worksheet, rowIdx: number, colCount: number): void {
  for (let ci = 0; ci < colCount; ci++) {
    const cell = cellAt(ws, XLSX.utils.encode_cell({ r: rowIdx, c: ci }));
    if (!cell) continue;
    cell.s = { fill: HEADER_FILL, font: HEADER_FONT, alignment: HEADER_ALIGN_R };
  }
}

function styleTitleCell(XLSX: XlsxModule, ws: Worksheet, rowIdx: number): void {
  const cell = cellAt(ws, XLSX.utils.encode_cell({ r: rowIdx, c: 0 }));
  if (cell) cell.s = { font: { bold: true, sz: 13, color: { rgb: '1E3A5F' } } };
}

function styleSummaryCell(XLSX: XlsxModule, ws: Worksheet, rowIdx: number, colCount: number): void {
  for (let ci = 0; ci < colCount; ci++) {
    const cell = cellAt(ws, XLSX.utils.encode_cell({ r: rowIdx, c: ci }));
    if (!cell) continue;
    cell.s = {
      font: { bold: true, sz: 10, color: { rgb: '374151' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'right', vertical: 'center' },
    };
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportBankStatementExcel({
  statement,
  companyName,
  filteredTransactions,
  columnTotals,
  summaryByCategory,
}: BankStatementExportArgs): Promise<void> {
  if (!statement) return;
  const { default: XLSX } = await import('xlsx-js-style');

  const wb = XLSX.utils.book_new();
  const period = `${toYmd(statement.startDate)} -> ${toYmd(statement.endDate)}`;
  const colsCount = 9;
  const dataRowStart = 7;

  const dataAoA = filteredTransactions.map((tx, idx) => [
    idx + 1,
    tx.txDate || '',
    tx.description || '',
    tx.reference || '',
    tx.category?.nameAr || tx.category?.nameEn || '—',
    Number(tx.debit) || 0,
    Number(tx.credit) || 0,
    tx.balance != null ? Number(tx.balance) : '',
    tx.note || tx.notes || '',
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
  ]) as Worksheet;

  const footerRow = dataRowStart + dataAoA.length;
  XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', 'المجموع (المعروض):', columnTotals.debit, columnTotals.credit, '', '']], { origin: `A${footerRow}` });
  ws['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 42 }, { wch: 14 }, { wch: 18 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 22 }];

  applySheetView(XLSX, ws, dataRowStart);
  styleTitleCell(XLSX, ws, 0);
  styleHeaderRow(XLSX, ws, 6, colsCount);
  styleSummaryCell(XLSX, ws, footerRow - 1, colsCount);
  XLSX.utils.book_append_sheet(wb, ws, 'العمليات');

  const catRows: CategoryExportRow[] = Object.entries(summaryByCategory)
    .map(([name, row]) => ({
      التصنيف: name,
      العدد: row.count,
      'إجمالي مدين': row.totalDebit,
      'إجمالي دائن': row.totalCredit,
      الصافي: row.totalCredit - row.totalDebit,
    }))
    .sort((a, b) => b['إجمالي مدين'] - a['إجمالي مدين']);

  const ws2 = XLSX.utils.aoa_to_sheet([[companyName || '—'], ['ملخص التصنيفات'], [`الفترة: ${period}`], []]) as Worksheet;
  XLSX.utils.sheet_add_json(ws2, catRows, { origin: 'A5' });
  ws2['!cols'] = [{ wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

  applySheetView(XLSX, ws2, 5);
  styleTitleCell(XLSX, ws2, 0);
  styleHeaderRow(XLSX, ws2, 4, 5);
  XLSX.utils.book_append_sheet(wb, ws2, 'ملخص التصنيفات');

  const fileName = `كشف_${(statement.bankName || 'bank').replace(/\s+/g, '_')}_${toYmd(statement.startDate).slice(0, 7) || 'export'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function printBankStatement({
  statement,
  companyName,
  filteredTransactions,
  columnTotals,
}: BankStatementPrintArgs): void {
  if (!statement) return;
  const period = `${toYmd(statement.startDate)} — ${toYmd(statement.endDate)}`;
  const rows = filteredTransactions
    .map(
      (tx) => `<tr>
      <td>${escapeHtml(tx.txDate)}</td>
      <td>${escapeHtml(tx.description)}</td>
      <td>${escapeHtml(tx.category?.nameAr || tx.category?.nameEn || '—')}</td>
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
