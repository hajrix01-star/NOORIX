import React, { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Button, Badge, KebabMenu, SmartTable } from '../../../../ui';
import type { SmartTableColumn } from '../../../../ui';
import { formatSaudiDate, toYmd } from '../../../../utils/saudiDate';
import { fmt } from '../../../../utils/format';
import { PAGE_SIZE } from '../constants';
import { formatBatchesFooterLabel } from '../utils/purchasesBatchFormatters';

export interface PurchasesBatchTableProps {
  filteredData: any[];
  displayedTotal: number;
  page: number;
  setPage: (n: number | ((p: number) => number)) => void;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  toggleSort: (key: string) => void;
  batchesLoading: boolean;
  batchesError: boolean;
  batchesErrMessage: string;
  batchSearchInput: string;
  setBatchSearchInput: (v: string) => void;
  dateFilter: { startDate: string; endDate: string; label?: string };
  t: (key: string, ...args: any[]) => string;
  statusBadgeMap: Record<string, any>;
  batchActionLoading: any;
  openBatchWithInvoices: (row: any, setter: any) => void;
  handleCancelBatch: (batch: any, setEditingBatch: (v: any) => void) => void;
  setPrintingBatch: (v: any) => void;
  setEditingBatch: (v: any) => void;
  activeOnlyLength: number;
  totalNet: Decimal;
  totalTax: Decimal;
  totalAmount: Decimal;
}

export default function PurchasesBatchTable(props: PurchasesBatchTableProps) {
  const {
    filteredData,
    displayedTotal,
    page,
    setPage,
    sortKey,
    sortDir,
    toggleSort,
    batchesLoading,
    batchesError,
    batchesErrMessage,
    batchSearchInput,
    setBatchSearchInput,
    dateFilter,
    t,
    statusBadgeMap,
    batchActionLoading,
    openBatchWithInvoices,
    handleCancelBatch,
    setPrintingBatch,
    setEditingBatch,
    activeOnlyLength,
    totalNet,
    totalTax,
    totalAmount,
  } = props;

  const batchesColumns = useMemo<SmartTableColumn<any>[]>(
    () => [
      {
        key: 'batchId',
        kind: 'id',
        label: t('batchId'),
        sortable: true,
        width: '10%',
        render: (v: any) => (
          <span className="font-bold nx-cell-ellipsis text-noorix-blue nx-font-numbers">
            {v}
          </span>
        ),
      },
      {
        key: 'transactionDate',
        kind: 'date',
        label: t('transactionDate'),
        sortable: true,
        width: '8%',
        render: (v: any) => (
          <span className="text-[12px] text-noorix-muted nx-font-numbers">
            {formatSaudiDate(v)}
          </span>
        ),
      },
      {
        key: 'invoiceCount',
        kind: 'number',
        label: t('invoicesColHeader'),
        numeric: true,
        sortable: true,
        width: '6%',
        render: (v: any, row: any) => {
          const n = v ?? 0;
          const from = toYmd(dateFilter.startDate);
          const to = toYmd(dateFilter.endDate);
          const href = `/invoices?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&batchId=${encodeURIComponent(row.batchId)}`;
          if (n <= 0) {
            return <span className="font-bold text-noorix-muted tabular-nums nx-font-numbers">{n}</span>;
          }
          return (
            <Link
              to={href}
              className="font-bold text-noorix-blue hover:underline tabular-nums nx-font-numbers focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-noorix-blue rounded"
              title={t('invoicesColHeader')}
              aria-label={`${t('invoicesColHeader')}: ${n}`}
            >
              {n}
            </Link>
          );
        },
      },
      {
        key: 'supplierNames',
        kind: 'text',
        label: t('supplier'),
        sortable: true,
        width: '20%',
        render: (v: any) => <span className="nx-cell-ellipsis block">{v || '—'}</span>,
      },
      {
        key: 'vaultName',
        kind: 'text',
        label: t('vault'),
        sortable: true,
        width: '13%',
        render: (v: any) => <span className="nx-cell-ellipsis block">{v || '—'}</span>,
      },
      {
        key: 'netAmount',
        kind: 'money',
        label: t('net'),
        numeric: true,
        sortable: true,
        width: '8%',
        render: (v: any) => (
          <span className="text-noorix-green nx-font-numbers">
            {fmt(v)}
          </span>
        ),
      },
      {
        key: 'taxAmount',
        kind: 'money',
        label: t('tax'),
        numeric: true,
        sortable: true,
        width: '7%',
        render: (v: any) => (
          <span className="text-noorix-amber nx-font-numbers">
            {fmt(v)}
          </span>
        ),
      },
      {
        key: 'totalAmount',
        kind: 'money',
        label: t('total'),
        numeric: true,
        sortable: true,
        width: '8%',
        render: (v: any) => (
          <span className="font-bold nx-font-numbers">
            {fmt(v)}
          </span>
        ),
      },
      {
        key: 'status',
        kind: 'status',
        label: t('statusLabel'),
        width: '8%',
        render: (v: any) => <Badge {...Badge.fromStatus(v, statusBadgeMap)} size="sm" />,
      },
      {
        key: 'actions',
        kind: 'actions',
        label: t('actions'),
        align: 'center',
        width: '48px',
        render: (_: any, row: any) => {
          const canCancel = row.status === 'active' || row.status === 'partial';
          return (
            <KebabMenu
              ariaLabel={t('actions')}
              items={[
                { key: 'print', label: t('print'), onClick: () => openBatchWithInvoices(row, setPrintingBatch), disabled: batchActionLoading === row.batchId },
                { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => openBatchWithInvoices(row, setEditingBatch), disabled: batchActionLoading === row.batchId },
                ...(canCancel ? [{ key: 'cancel', label: t('cancel'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleCancelBatch(row, setEditingBatch), disabled: batchActionLoading === row.batchId }] : []),
              ]}
            />
          );
        },
      },
    ],
    [
      t,
      statusBadgeMap,
      batchActionLoading,
      openBatchWithInvoices,
      handleCancelBatch,
      dateFilter.startDate,
      dateFilter.endDate,
      setPrintingBatch,
      setEditingBatch,
    ],
  );

  const renderCompactRow = useCallback(
    (row: any) => {
      const canCancel = row.status === 'active' || row.status === 'partial';
      return (
        <div>
          <div className="nx-cr__line1">
            <span className="nx-cr__id text-noorix-blue">{row.batchId}</span>
            <span className="nx-cr__meta">{formatSaudiDate(row.transactionDate)}</span>
            <Badge {...Badge.fromStatus(row.status, statusBadgeMap)} size="sm" />
          </div>
          <div className="nx-cr__line2">
            <div className="nx-cr__line2-start">
              {row.supplierNames && <span className="nx-cr__sub">{row.supplierNames}</span>}
              {row.vaultName && <span className="nx-cr__meta">{row.vaultName}</span>}
            </div>
            <div className="nx-cr__line2-end">
              <span className="nx-cr__amount">{fmt(row.totalAmount)} <span className="nx-sar">SR</span></span>
              <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
                <KebabMenu
                  ariaLabel={t('actions')}
                  items={[
                    { key: 'print', label: t('print'), onClick: () => openBatchWithInvoices(row, setPrintingBatch), disabled: batchActionLoading === row.batchId },
                    { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => openBatchWithInvoices(row, setEditingBatch), disabled: batchActionLoading === row.batchId },
                    ...(canCancel ? [{ key: 'cancel', label: t('cancel'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleCancelBatch(row, setEditingBatch), disabled: batchActionLoading === row.batchId }] : []),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      );
    },
    [statusBadgeMap, t, batchActionLoading, openBatchWithInvoices, handleCancelBatch, dateFilter.startDate, dateFilter.endDate, setPrintingBatch, setEditingBatch],
  );

  const renderBatchMobileCard = useCallback(
    (row: any) => {
      const canCancel = row.status === 'active' || row.status === 'partial';
      return (
        <div>
          <div className="flex mb-1 justify-between items-start">
            <span className="font-bold text-[14px] text-noorix-blue nx-font-numbers">
              {row.batchId}
            </span>
            <Badge {...Badge.fromStatus(row.status, statusBadgeMap)} size="sm" />
          </div>
          <div className="flex gap-2.5 text-[12px] text-noorix-muted mb-1.5">
            <span>{formatSaudiDate(row.transactionDate)}</span>
            {row.invoiceCount > 0 && (
              <Link
                to={`/invoices?from=${encodeURIComponent(toYmd(dateFilter.startDate))}&to=${encodeURIComponent(toYmd(dateFilter.endDate))}&batchId=${encodeURIComponent(row.batchId)}`}
                className="font-bold text-noorix-blue hover:underline"
              >
                {row.invoiceCount} {t('invoices')}
              </Link>
            )}
          </div>
          {row.supplierNames && (
            <div className="text-[13px] mb-1 text-end leading-snug break-words">{row.supplierNames}</div>
          )}
          <div className="text-[12px] mb-2 text-noorix-muted text-end break-words">
            {t('vault')}: {row.vaultName || '—'}
          </div>
          <div className="nx-mc__grid nx-mc__grid--3 mb-2.5">
            <div>
              <div className="nx-mc__stat-label">{t('net')}</div>
              <div className="nx-mc__stat-value text-[13px] text-noorix-green">{fmt(row.netAmount)}</div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('tax')}</div>
              <div className="nx-mc__stat-value text-[13px] text-noorix-amber">{fmt(row.taxAmount)}</div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('total')}</div>
              <div className="nx-mc__stat-value text-[14px] font-extrabold text-noorix-text">{fmt(row.totalAmount)}</div>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button
              size="sm"
              onClick={() => openBatchWithInvoices(row, setPrintingBatch)}
              disabled={batchActionLoading === row.batchId}
            >
              {t('print')}
            </Button>
            <Button
              size="sm"
              onClick={() => openBatchWithInvoices(row, setEditingBatch)}
              disabled={batchActionLoading === row.batchId}
            >
              ✎ {t('edit')}
            </Button>
            {canCancel && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleCancelBatch(row, setEditingBatch)}
                disabled={batchActionLoading === row.batchId}
              >
                × {t('cancel')}
              </Button>
            )}
          </div>
        </div>
      );
    },
    [statusBadgeMap, t, batchActionLoading, openBatchWithInvoices, handleCancelBatch, dateFilter.startDate, dateFilter.endDate, setPrintingBatch, setEditingBatch],
  );

  const batchesFooterRow = useMemo(
    () => [
      {
        keys: ['batchId', 'transactionDate', 'invoiceCount', 'supplierNames', 'vaultName'],
        className: 'nx-tfoot-label text-[12px] text-center',
        content: formatBatchesFooterLabel(t, activeOnlyLength),
      },
      {
        keys: ['netAmount'],
        className: 'nx-tfoot-num nx-cell-num--green text-center',
        content: fmt(totalNet),
      },
      {
        keys: ['taxAmount'],
        className: 'nx-tfoot-num nx-cell-num--amber text-center',
        content: fmt(totalTax),
      },
      {
        keys: ['totalAmount'],
        className: 'nx-tfoot-num nx-cell-num--violet text-center',
        content: fmt(totalAmount),
      },
    ],
    [t, activeOnlyLength, totalNet, totalTax, totalAmount],
  );

  return (
    <SmartTable
      columns={batchesColumns}
      data={filteredData}
      showRowNumbers
      rowNumberWidth={40}
      tableId="purchases-batches"
      tableLayout="fixed"
      tableMinWidth={1100}
      innerPadding={8}
      total={displayedTotal}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      isLoading={batchesLoading}
      isError={!!batchesError}
      errorMessage={batchesErrMessage || ''}
      footerRow={batchesFooterRow}
      title={t('tabSavedBatches')}
      badge={
        <>
          <span className="text-[12px] text-noorix-muted">— {dateFilter.label}</span>
          <Badge color="blue" size="sm">
            {t('batchCount', displayedTotal)}
          </Badge>
        </>
      }
      searchValue={batchSearchInput}
      onSearchChange={(v: any) => {
        setBatchSearchInput(v);
        setPage(1);
      }}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={toggleSort}
      emptyMessage={t('noBatchesInPeriod')}
      renderCompactRow={renderCompactRow}
      renderMobileCard={renderBatchMobileCard}
      stripeMobileCards
      stickyActionColumn={false}
    />
  );
}
