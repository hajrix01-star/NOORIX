/**
 * تصدير Excel وطباعة كشف الحساب
 */
import * as XLSX from 'xlsx';
import { fmt } from '../../../utils/format';

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
    [`إجمالي إيداعات الكشف: ${fmt(Number(statement.totalDeposits) || 0)}`],
    [`إجمالي سحوبات الكشف: ${fmt(Number(statement.totalWithdrawals) || 0)}`],
    [],
    ['#', 'التاريخ', 'الوصف', 'المرجع', 'التصنيف', 'مدين', 'دائن', 'الرصيد', 'ملاحظة'],
    ...dataAoA,
  ]);
  const footerRow = 8 + dataAoA.length;
  XLSX.utils.sheet_add_aoa(
    ws,
    [['', '', '', '', 'المجموع (المعروض):', columnTotals.debit, columnTotals.credit, '', '']],
    { origin: `A${footerRow}` },
  );
  ws['!cols'] = [
    { wch: 4 },
    { wch: 12 },
    { wch: 42 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'العمليات');

  const catRows = Object.entries(summaryByCategory)
    .map(([name, d]) => ({
      التصنيف: name,
      العدد: d.count,
      'إجمالي مدين': d.totalDebit,
      'إجمالي دائن': d.totalCredit,
      الصافي: d.totalCredit - d.totalDebit,
    }))
    .sort((a, b) => b['إجمالي مدين'] - a['إجمالي مدين']);

  const ws2 = XLSX.utils.aoa_to_sheet([[companyName || '—'], ['ملخص التصنيفات'], [`الفترة: ${period}`], []]);
  XLSX.utils.sheet_add_json(ws2, catRows, { origin: 'A5' });
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
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>كشف</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:16px;}
    h1{font-size:18px} table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid #ccc;padding:6px} th{background:#f0f0f0}
  </style></head><body>
  <h1>${companyName || ''}</h1>
  <p>${statement.bankName || ''} — ${period}</p>
  <p>الملف: ${statement.fileName || ''}</p>
  <table><thead><tr><th>التاريخ</th><th>الوصف</th><th>التصنيف</th><th>مدين</th><th>دائن</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><th colspan="3">مجموع المعروض</th><th>${fmt(columnTotals.debit)}</th><th>${fmt(columnTotals.credit)}</th></tr></tfoot>
  </table>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  w.document.close();
}
