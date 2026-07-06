import { useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Modal, FmtNum } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { sumAmounts } from '../../../utils/format';
import { purchaseBatchDisplayName } from '../batch/purchaseBatchDisplayModel';
import { toPurchaseBatchFiniteNumber } from '../batch/purchaseBatchNumberModel';
import { printCurrentPurchaseBatchWindowAfterDelay } from '../batch/purchaseBatchPrintModel';
import type { PurchaseBatchInvoice, PurchaseBatchSummaryRow } from '../batch/purchaseBatchTypes';

export type BatchPrintSheetProps = {
  batch: PurchaseBatchSummaryRow;
  onClose: () => void;
};

function invoiceKindLabel(invoice: PurchaseBatchInvoice, t: (key: string, ...args: unknown[]) => string) {
  return invoice.kind === 'purchase' ? t('purchaseType') : t('expenseType');
}

export function BatchPrintSheet({ batch, onClose }: BatchPrintSheetProps) {
  const { t, lang } = useTranslation();

  useEffect(() => {
    const timer = printCurrentPurchaseBatchWindowAfterDelay();
    return () => clearTimeout(timer);
  }, []);

  const invoices = batch.invoices;
  const activeInvoices = invoices.filter((invoice) => invoice.status !== 'cancelled');
  const net = sumAmounts(activeInvoices, 'netAmount');
  const tax = sumAmounts(activeInvoices, 'taxAmount');
  const total = sumAmounts(activeInvoices, 'totalAmount');
  const dateStr = invoices[0]?.transactionDate ? formatSaudiDate(invoices[0].transactionDate) : '-';

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
        <span className="batch-print-title">{t('batchLabel', batch.batchId)}</span>
        <Button onClick={onClose}>{t('close')}</Button>
      </div>

      <div id="batch-print-content" className="batch-print-content">
        <div className="batch-print-header">
          <h2>{t('batchLabel', batch.batchId)}</h2>
          <p className="batch-print-subtitle">
            {t('batchPrintSubtitle', dateStr, activeInvoices.length)}
          </p>
        </div>

        <div className="noorix-table-frame batch-print-table-frame">
          <table className="noorix-table batch-print-table">
            <thead>
              <tr className="batch-print-table-head-row">
                <th className="batch-print-row-number">#</th>
                <th className="batch-print-min-100">{t('documentNumber')}</th>
                <th className="batch-print-min-100">{t('supplierInvoiceNumber')}</th>
                <th className="batch-print-min-140">{t('supplier')}</th>
                <th className="batch-print-w-90">{t('kind')}</th>
                <th className="batch-print-w-100 text-center">{t('net')}</th>
                <th className="batch-print-w-80 text-center">{t('tax')}</th>
                <th className="batch-print-w-110 text-center">{t('total')}</th>
                <th className="batch-print-w-90">{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {activeInvoices.map((invoice, index) => (
                <tr key={invoice.id}>
                  <td className="text-center">{index + 1}</td>
                  <td className="font-semibold">{invoice.invoiceNumber}</td>
                  <td className="batch-print-muted">{invoice.supplierInvoiceNumber || '-'}</td>
                  <td>{purchaseBatchDisplayName(invoice.supplier, lang)}</td>
                  <td>{invoiceKindLabel(invoice, t)}</td>
                  <td className="batch-print-num"><FmtNum n={toPurchaseBatchFiniteNumber(invoice.netAmount)} /></td>
                  <td className="batch-print-num"><FmtNum n={toPurchaseBatchFiniteNumber(invoice.taxAmount)} /></td>
                  <td className="batch-print-num font-bold"><FmtNum n={toPurchaseBatchFiniteNumber(invoice.totalAmount)} /></td>
                  <td className="batch-print-date-cell">{formatSaudiDate(invoice.transactionDate)}</td>
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
