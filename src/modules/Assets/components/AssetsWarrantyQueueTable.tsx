import React from 'react';
import { Button } from '../../../ui';
import { formatMoney } from '../../../utils/money';
import { formatSaudiDate } from '../../../utils/saudiDate';
import type { PendingWarrantyInvoiceRow } from '../types';
import { getExpenseLineLabel, getInvoiceKindLabel, getSupplierDisplayName } from '../utils/assetsRegisterMappers';

export type AssetsWarrantyQueueTableProps = {
  pendingRows: PendingWarrantyInvoiceRow[];
  pendingLoading: boolean;
  canWrite: boolean;
  lang: string;
  t: (k: string) => string;
  onCompleteClick: (row: PendingWarrantyInvoiceRow) => void;
};

function QueueAmount({ value, lang }: { value: PendingWarrantyInvoiceRow['totalAmount']; lang: string }) {
  return (
    <span className="nx-assets-warranty-queue__amount">
      {formatMoney(value, lang)} <span className="nx-sar">SR</span>
    </span>
  );
}

function SupplierCell({ row, lang }: { row: PendingWarrantyInvoiceRow; lang: string }) {
  const supplierName = getSupplierDisplayName(row.supplier, lang);
  const expenseLabel = row.expenseLine ? getExpenseLineLabel(row.expenseLine, lang) : '';

  return (
    <div className="nx-assets-warranty-queue__supplier">
      <span className="nx-assets-warranty-queue__supplier-name" title={supplierName}>
        {supplierName}
      </span>
      {expenseLabel ? (
        <span className="nx-assets-warranty-queue__supplier-sub" title={expenseLabel}>
          {expenseLabel}
        </span>
      ) : null}
    </div>
  );
}

function QueueRow({
  row,
  canWrite,
  lang,
  t,
  onCompleteClick,
}: {
  row: PendingWarrantyInvoiceRow;
  canWrite: boolean;
  lang: string;
  t: (k: string) => string;
  onCompleteClick: (row: PendingWarrantyInvoiceRow) => void;
}) {
  return (
    <div className="nx-assets-warranty-queue__row">
      <div className="nx-assets-warranty-queue__cell nx-assets-warranty-queue__invoice">
        <span className="nx-assets-warranty-queue__invoice-number">{String(row.invoiceNumber ?? '')}</span>
        <span className="nx-assets-warranty-queue__mobile-meta">{getInvoiceKindLabel(row.kind, t)}</span>
      </div>
      <div className="nx-assets-warranty-queue__cell nx-assets-warranty-queue__kind">
        {getInvoiceKindLabel(row.kind, t)}
      </div>
      <div className="nx-assets-warranty-queue__cell nx-assets-warranty-queue__supplier-invoice">
        {row.supplierInvoiceNumber || '—'}
      </div>
      <div className="nx-assets-warranty-queue__cell">
        <SupplierCell row={row} lang={lang} />
      </div>
      <div className="nx-assets-warranty-queue__cell nx-assets-warranty-queue__date">
        {formatSaudiDate(row.transactionDate)}
      </div>
      <div className="nx-assets-warranty-queue__cell nx-assets-warranty-queue__total">
        <QueueAmount value={row.totalAmount} lang={lang} />
      </div>
      <div className="nx-assets-warranty-queue__cell nx-assets-warranty-queue__action">
        {canWrite ? (
          <Button size="sm" variant="primary" className="nx-assets-warranty-queue__button" onClick={() => onCompleteClick(row)}>
            {t('warrantyQueueComplete')}
          </Button>
        ) : (
          <span className="nx-assets-warranty-queue__muted">—</span>
        )}
      </div>
    </div>
  );
}

export function AssetsWarrantyQueueTable({
  pendingRows,
  pendingLoading,
  canWrite,
  lang,
  t,
  onCompleteClick,
}: AssetsWarrantyQueueTableProps) {
  return (
    <section className="nx-assets-warranty-queue">
      <div className="nx-assets-warranty-queue__top">
        <div className="nx-assets-warranty-queue__title-wrap">
          <h3 className="nx-assets-warranty-queue__title">{t('assetsTabWarrantyQueue')}</h3>
          <span className="nx-assets-warranty-queue__badge">{pendingRows.length}</span>
        </div>
      </div>

      <div className="nx-assets-warranty-queue__grid" role="table" aria-label={t('assetsTabWarrantyQueue')}>
        <div className="nx-assets-warranty-queue__header" role="row">
          <div role="columnheader">{t('invoiceNumber')}</div>
          <div role="columnheader">{t('type')}</div>
          <div role="columnheader">{t('supplierInvoiceNumber')}</div>
          <div role="columnheader">{t('assetSupplier')}</div>
          <div role="columnheader">{t('transactionDate')}</div>
          <div role="columnheader">{t('total')}</div>
          <div role="columnheader">{t('actions')}</div>
        </div>

        {pendingLoading ? (
          <div className="nx-assets-warranty-queue__state">{t('loading')}</div>
        ) : pendingRows.length === 0 ? (
          <div className="nx-assets-warranty-queue__state">{t('warrantyQueueEmpty')}</div>
        ) : (
          pendingRows.map((row) => (
            <QueueRow
              key={row.id}
              row={row}
              canWrite={canWrite}
              lang={lang}
              t={t}
              onCompleteClick={onCompleteClick}
            />
          ))
        )}
      </div>
    </section>
  );
}
