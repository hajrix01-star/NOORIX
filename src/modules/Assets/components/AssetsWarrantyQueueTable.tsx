import React, { useCallback, useMemo } from 'react';
import { SmartTable, Badge, Button, KebabMenu } from '../../../ui';
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

export function AssetsWarrantyQueueTable({
  pendingRows,
  pendingLoading,
  canWrite,
  lang,
  t,
  onCompleteClick,
}: AssetsWarrantyQueueTableProps) {
  const pendingColumns = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        header: t('invoiceNumber'),
        render: (_: unknown, row: PendingWarrantyInvoiceRow) => (
          <span className="font-bold text-noorix-blue ltr nx-font-numbers">{String(row.invoiceNumber ?? '')}</span>
        ),
      },
      {
        key: 'kind',
        header: t('type'),
        render: (_: unknown, row: PendingWarrantyInvoiceRow) => (
          <span className="text-[12px] font-medium text-noorix-muted whitespace-nowrap">
            {getInvoiceKindLabel(row.kind, t)}
          </span>
        ),
      },
      {
        key: 'supplierInvoiceNumber',
        header: t('supplierInvoiceNumber'),
        render: (_: unknown, row: PendingWarrantyInvoiceRow) => (
          <span className="text-[13px] ltr nx-font-numbers">{row.supplierInvoiceNumber || '—'}</span>
        ),
      },
      {
        key: 'supplier',
        header: t('assetSupplier'),
        render: (_: unknown, row: PendingWarrantyInvoiceRow) => (
          <div className="flex flex-col gap-0.5 min-w-0 max-w-[200px]">
            <span className="text-[13px] truncate">{getSupplierDisplayName(row.supplier, lang)}</span>
            {row.expenseLine ? (
              <span className="text-[11px] text-noorix-muted truncate" title={getExpenseLineLabel(row.expenseLine, lang)}>
                {getExpenseLineLabel(row.expenseLine, lang)}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'transactionDate',
        header: t('transactionDate'),
        render: (_: unknown, row: PendingWarrantyInvoiceRow) => (
          <span className="text-[13px] text-noorix-muted ltr">{formatSaudiDate(row.transactionDate)}</span>
        ),
      },
      {
        key: 'totalAmount',
        header: t('total'),
        numeric: true,
        render: (_: unknown, row: PendingWarrantyInvoiceRow) => (
          <span className="ltr font-semibold">
            {formatMoney(row.totalAmount, lang)} <span className="nx-sar">SR</span>
          </span>
        ),
      },
      ...(canWrite
        ? [
            {
              key: 'actions',
              header: '',
              render: (_: unknown, row: PendingWarrantyInvoiceRow) => (
                <Button size="sm" variant="primary" onClick={() => onCompleteClick(row)}>
                  {t('warrantyQueueComplete')}
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canWrite, lang, onCompleteClick, t],
  );

  const renderCompactRow = useCallback(
    (row: PendingWarrantyInvoiceRow) => (
      <div>
        <div className="nx-cr__line1">
          <span className="nx-cr__id text-noorix-blue">{String(row.invoiceNumber)}</span>
          <span className="nx-cr__sub">{getInvoiceKindLabel(row.kind, t)}</span>
          <span className="nx-cr__sub">{getSupplierDisplayName(row.supplier, lang)}</span>
        </div>
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            <span className="nx-cr__meta ltr">{formatSaudiDate(row.transactionDate)}</span>
            {row.expenseLine && <span className="nx-cr__meta">{getExpenseLineLabel(row.expenseLine, lang)}</span>}
          </div>
          <div className="nx-cr__line2-end">
            <span className="nx-cr__amount text-noorix-green">{formatMoney(row.totalAmount, lang)} <span className="nx-sar">SR</span></span>
            {canWrite && (
              <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
                <KebabMenu
                  ariaLabel={t('actions')}
                  items={[{ key: 'complete', label: t('warrantyQueueComplete'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => onCompleteClick(row) }]}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    [canWrite, lang, onCompleteClick, t],
  );

  const renderPendingMobileCard = useCallback(
    (row: PendingWarrantyInvoiceRow) => (
      <div className="flex flex-col gap-2 nx-mc__root">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-noorix-blue ltr nx-font-numbers">{String(row.invoiceNumber)}</div>
            <div className="text-[12px] text-noorix-muted ltr">{row.supplierInvoiceNumber || '—'}</div>
            <div className="text-[11px] text-noorix-muted mt-0.5">{getInvoiceKindLabel(row.kind, t)}</div>
          </div>
          {canWrite ? (
            <Button size="sm" variant="primary" onClick={() => onCompleteClick(row)}>
              {t('warrantyQueueComplete')}
            </Button>
          ) : null}
        </div>
        <div className="text-[13px] text-end break-words">{getSupplierDisplayName(row.supplier, lang)}</div>
        {row.expenseLine ? (
          <div className="text-[12px] text-noorix-muted mt-1">{getExpenseLineLabel(row.expenseLine, lang)}</div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <div className="text-noorix-muted">{t('transactionDate')}</div>
            <div className="ltr font-medium">{formatSaudiDate(row.transactionDate)}</div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('total')}</div>
            <div className="ltr font-bold text-noorix-green">
              {formatMoney(row.totalAmount, lang)} <span className="nx-sar">SR</span>
            </div>
          </div>
        </div>
      </div>
    ),
    [canWrite, lang, onCompleteClick, t],
  );

  return (
    <SmartTable
      tableId="company-assets-pending-warranty"
      title={t('assetsTabWarrantyQueue')}
      columns={pendingColumns}
      data={pendingRows}
      total={pendingRows.length}
      page={1}
      pageSize={Math.max(pendingRows.length, 1)}
      onPageChange={() => {}}
      isLoading={pendingLoading}
      isError={false}
      errorMessage=""
      showSearchInHeader={false}
      emptyMessage={t('warrantyQueueEmpty')}
      renderCompactRow={renderCompactRow}
      renderMobileCard={renderPendingMobileCard}
      tableMinWidth={980}
    />
  );
}
