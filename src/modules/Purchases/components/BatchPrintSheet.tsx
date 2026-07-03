/**
 * BatchPrintSheet — طباعة احترافية لدفعة الفواتير
 * عند الطباعة: يعرض الجدول والملخص فقط — بدون أزرار أو عناصر خارجية
 */
import React, { useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Modal, FmtNum } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';

export function BatchPrintSheet({ batch, onClose }: any) {
  const { t, lang } = useTranslation();
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);

  const invList = batch?.invoices || [];
  const activeInvoices = invList.filter((i: any) => i.status !== 'cancelled');
  const net = sumAmounts(activeInvoices, 'netAmount');
  const tax = sumAmounts(activeInvoices, 'taxAmount');
  const total = sumAmounts(activeInvoices, 'totalAmount');
  const dateStr = invList[0]?.transactionDate
    ? formatSaudiDate(invList[0].transactionDate)
    : '—';

  return (
    <Modal open={true} onClose={onClose} size="xl" closeOnBackdrop={false} hideClose>
      <style>{`
        @media print {
          body > *:not(.nx-modal-backdrop) { display: none !important; }
          .nx-modal-backdrop {
            position: fixed !important;
            inset: 0 !important;
            background: #fff !important;
            padding: 16px !important;
            overflow: visible !important;
            display: block !important;
          }
          .nx-modal {
            max-width: 100% !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="batch-print-actions no-print">
        <span className="batch-print-title">{t('batchLabel', batch?.batchId)}</span>
        <Button onClick={onClose}>إغلاق</Button>
      </div>

      <div id="batch-print-content" className="batch-print-content">
        <div className="batch-print-header">
          <h2>{t('batchLabel', batch?.batchId)}</h2>
          <p className="batch-print-subtitle">
            {t('batchPrintSubtitle', dateStr, activeInvoices.length)}
          </p>
        </div>

        <div className="noorix-table-frame batch-print-table-frame">
          <table className="noorix-table batch-print-table">
            <thead>
              <tr className="batch-print-table-head-row">
                <th className="batch-print-row-number">#</th>
                <th className="batch-print-min-100">رقم السند</th>
                <th className="batch-print-min-100">رقم فاتورة المورد</th>
                <th className="batch-print-min-140">المورد</th>
                <th className="batch-print-w-90">النوع</th>
                <th className="batch-print-w-100 text-center">الصافي</th>
                <th className="batch-print-w-80 text-center">ضريبة</th>
                <th className="batch-print-w-110 text-center">الإجمالي</th>
                <th className="batch-print-w-90">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {activeInvoices.map((inv: any, i: any) => (
                <tr key={inv.id}>
                  <td className="text-center">{i + 1}</td>
                  <td className="font-semibold">{inv.invoiceNumber}</td>
                  <td className="batch-print-muted">{inv.supplierInvoiceNumber || '—'}</td>
                  <td>{(lang === 'en' ? inv.supplier?.nameEn || inv.supplier?.nameAr : inv.supplier?.nameAr || inv.supplier?.nameEn) || '—'}</td>
                  <td>{inv.kind === 'purchase' ? t('purchaseType') : t('expenseType')}</td>
                  <td className="batch-print-num"><FmtNum n={inv.netAmount} /></td>
                  <td className="batch-print-num"><FmtNum n={inv.taxAmount} /></td>
                  <td className="batch-print-num font-bold"><FmtNum n={inv.totalAmount} /></td>
                  <td className="batch-print-date-cell">{formatSaudiDate(inv.transactionDate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="font-bold">{t('totalSum', activeInvoices.length)}</td>
                <td className="batch-print-num"><FmtNum n={net.toNumber()} /></td>
                <td className="batch-print-num"><FmtNum n={tax.toNumber()} /></td>
                <td className="batch-print-num font-extrabold"><FmtNum n={total.toNumber()} /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
}
