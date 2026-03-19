/**
 * BatchPrintSheet — طباعة احترافية لدفعة الفواتير
 * عند الطباعة: يعرض الجدول والملخص فقط — بدون أزرار أو عناصر خارجية
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';

export function BatchPrintSheet({ batch, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);

  const invList = batch?.invoices || [];
  const activeInvoices = invList.filter((i) => i.status !== 'cancelled');
  const net = sumAmounts(activeInvoices, 'netAmount');
  const tax = sumAmounts(activeInvoices, 'taxAmount');
  const total = sumAmounts(activeInvoices, 'totalAmount');
  const dateStr = invList[0]?.transactionDate
    ? formatSaudiDate(invList[0].transactionDate)
    : '—';

  const content = (
    <div
      className="batch-print-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="batch-print-dialog"
        style={{
          background: 'var(--noorix-bg-surface)', borderRadius: 12, maxWidth: 700, width: '100%',
          maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="batch-print-actions no-print" style={{ padding: '12px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{t('batchLabel', batch?.batchId)}</span>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)', cursor: 'pointer', fontSize: 13 }}>
            إغلاق
          </button>
        </div>

        <div id="batch-print-content" className="batch-print-content" style={{ padding: 20 }}>
          <div className="batch-print-header" style={{ marginBottom: 16, textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{t('batchLabel', batch?.batchId)}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>
              {t('batchPrintSubtitle', dateStr, activeInvoices.length)}
            </p>
          </div>

          <div className="noorix-table-frame noorix-surface-card" style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table className="noorix-table" style={{ minWidth: 500 }}>
              <thead>
                <tr style={{ textAlign: 'right' }}>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ minWidth: 100 }}>رقم السند</th>
                  <th style={{ minWidth: 100 }}>رقم فاتورة المورد</th>
                  <th style={{ minWidth: 140 }}>المورد</th>
                  <th style={{ width: 90 }}>النوع</th>
                  <th style={{ width: 100, textAlign: 'right' }}>الصافي</th>
                  <th style={{ width: 80, textAlign: 'right' }}>ضريبة</th>
                  <th style={{ width: 110, textAlign: 'right' }}>الإجمالي</th>
                  <th style={{ width: 90 }}>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {activeInvoices.map((inv, i) => (
                  <tr key={inv.id}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ color: 'var(--noorix-text-muted)' }}>{inv.supplierInvoiceNumber || '—'}</td>
                    <td>{inv.supplier?.nameAr || '—'}</td>
                    <td>{inv.kind === 'purchase' ? t('purchaseType') : t('expenseType')}</td>
                    <td style={{ fontFamily: 'var(--noorix-font-numbers)', textAlign: 'left' }}>{fmt(inv.netAmount)}</td>
                    <td style={{ fontFamily: 'var(--noorix-font-numbers)', textAlign: 'left' }}>{fmt(inv.taxAmount)}</td>
                    <td style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, textAlign: 'left' }}>{fmt(inv.totalAmount)}</td>
                    <td style={{ fontSize: 12 }}>{formatSaudiDate(inv.transactionDate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ fontWeight: 700 }}>{t('totalSum', activeInvoices.length)}</td>
                  <td style={{ fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right' }}>{fmt(net, 2)}</td>
                  <td style={{ fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right' }}>{fmt(tax, 2)}</td>
                  <td style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 800, textAlign: 'right' }}>{fmt(total, 2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(.batch-print-overlay) { display: none !important; }
          .batch-print-overlay {
            position: fixed !important;
            inset: 0 !important;
            background: #fff !important;
            padding: 16px !important;
            overflow: visible !important;
            display: block !important;
          }
          .batch-print-dialog {
            max-width: 100% !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
