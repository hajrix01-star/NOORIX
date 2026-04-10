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
  th{background:#2563eb;color:#fff;font-weight:700}
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
