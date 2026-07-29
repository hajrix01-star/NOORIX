import { useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Badge, SmartTable } from '../../../../ui';
import type { SmartTableColumn } from '../../../../ui';
import { formatSaudiDate, toYmd } from '../../../../utils/saudiDate';
import { fmt } from '../../../../utils/format';
import { compactBusinessIdentifier } from '../../../../utils/compactDisplay';
import { PAGE_SIZE } from '../constants';
import { formatBatchesFooterLabel } from '../utils/purchasesBatchFormatters';
import type {
  BatchTranslateFn,
  PurchaseBatchSummaryRow,
} from '../purchaseBatchTypes';

type PurchasesBatchDateFilter = {
  startDate: string;
  endDate: string;
  label?: string;
};

type BadgeStatusMap = Record<string, { color: string; label: string }>;

export interface PurchasesBatchTableProps {
  filteredData: PurchaseBatchSummaryRow[];
  displayedTotal: number;
  page: number;
  setPage: (page: number) => void;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  toggleSort: (key: string) => void;
  batchesLoading: boolean;
  batchesError: boolean;
  batchesErrMessage: string;
  batchSearchInput: string;
  setBatchSearchInput: (value: string) => void;
  dateFilter: PurchasesBatchDateFilter;
  t: BatchTranslateFn;
  statusBadgeMap: BadgeStatusMap;
  batchActionLoading: string | null;
  openBatchWithInvoices: (
    row: PurchaseBatchSummaryRow,
    setter: Dispatch<SetStateAction<PurchaseBatchSummaryRow | null>>,
  ) => Promise<void>;
  setPrintingBatch: Dispatch<SetStateAction<PurchaseBatchSummaryRow | null>>;
  activeOnlyLength: number;
  totalNet: Decimal;
  totalTax: Decimal;
  totalAmount: Decimal;
}

function invoicesHref(dateFilter: PurchasesBatchDateFilter, batchId: string) {
  const from = toYmd(dateFilter.startDate);
  const to = toYmd(dateFilter.endDate);
  return `/invoices?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&batchId=${encodeURIComponent(batchId)}`;
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
    setPrintingBatch,
    activeOnlyLength,
    totalNet,
    totalTax,
    totalAmount,
  } = props;

  const batchesColumns = useMemo<SmartTableColumn<PurchaseBatchSummaryRow>[]>(
    () => [
      {
        key: 'batchId',
        kind: 'id',
        label: t('batchId'),
        sortable: true,
        size: 'document',
        render: (value, row) => (
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              className="font-bold nx-cell-ellipsis text-noorix-blue nx-font-numbers hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-noorix-blue rounded"
              onClick={() => openBatchWithInvoices(row, setPrintingBatch)}
              disabled={batchActionLoading === row.batchId}
              title={String(value ?? '')}
            >
              {compactBusinessIdentifier(value)}
            </button>
            <span className="text-[12px] text-noorix-muted nx-font-numbers">
              {formatSaudiDate(row.transactionDate)}
            </span>
          </div>
        ),
      },
      {
        key: 'invoiceCount',
        kind: 'number',
        label: t('invoicesColHeader'),
        numeric: true,
        sortable: true,
        size: 'count',
        render: (value, row) => {
          const count = typeof value === 'number' ? value : row.invoiceCount;
          if (count <= 0) {
            return <span className="font-bold text-noorix-muted tabular-nums nx-font-numbers">{count}</span>;
          }
          return (
            <Link
              to={invoicesHref(dateFilter, row.batchId)}
              className="font-bold text-noorix-blue hover:underline tabular-nums nx-font-numbers focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-noorix-blue rounded"
              title={t('invoicesColHeader')}
              aria-label={`${t('invoicesColHeader')}: ${count}`}
            >
              {count}
            </Link>
          );
        },
      },
      {
        key: 'supplierNames',
        kind: 'text',
        label: t('supplier'),
        sortable: true,
        size: 'supplier',
        render: (value) => <span className="nx-cell-ellipsis block">{String(value || '-')}</span>,
      },
      {
        key: 'vaultName',
        kind: 'text',
        label: t('vault'),
        sortable: true,
        size: 'supplier',
        render: (value) => <span className="nx-cell-ellipsis block">{String(value || '-')}</span>,
      },
      {
        key: 'netAmount',
        kind: 'money',
        label: t('net'),
        numeric: true,
        sortable: true,
        size: 'money-sm',
        render: (value) => <span className="text-noorix-green nx-font-numbers">{fmt(value)}</span>,
      },
      {
        key: 'taxAmount',
        kind: 'money',
        label: t('tax'),
        numeric: true,
        sortable: true,
        size: 'tax',
        render: (value) => <span className="text-noorix-amber nx-font-numbers">{fmt(value)}</span>,
      },
      {
        key: 'totalAmount',
        kind: 'money',
        label: t('total'),
        numeric: true,
        sortable: true,
        size: 'money-md',
        render: (value) => <span className="font-bold nx-font-numbers">{fmt(value)}</span>,
      },
      {
        key: 'status',
        kind: 'status',
        label: t('statusLabel'),
        render: (value) => <Badge {...Badge.fromStatus(value, statusBadgeMap)} size="sm" />,
      },
    ],
    [
      t,
      statusBadgeMap,
      batchActionLoading,
      openBatchWithInvoices,
      dateFilter,
      setPrintingBatch,
    ],
  );

  const renderCompactRow = useCallback(
    (row: PurchaseBatchSummaryRow) => {
      return (
        <div>
          <div className="nx-cr__line1">
            <button
              type="button"
              className="nx-cr__id text-noorix-blue hover:underline"
              onClick={() => openBatchWithInvoices(row, setPrintingBatch)}
              disabled={batchActionLoading === row.batchId}
              title={row.batchId}
            >
              {compactBusinessIdentifier(row.batchId)}
            </button>
            <span className="nx-cr__meta">{formatSaudiDate(row.transactionDate)}</span>
            <Badge {...Badge.fromStatus(row.status, statusBadgeMap)} size="sm" />
          </div>
          <div className="nx-cr__line2">
            <div className="nx-cr__line2-start">
              {row.supplierNames ? <span className="nx-cr__sub">{row.supplierNames}</span> : null}
              {row.vaultName ? <span className="nx-cr__meta">{row.vaultName}</span> : null}
            </div>
            <div className="nx-cr__line2-end">
              <span className="nx-cr__amount">{fmt(row.totalAmount)} <span className="nx-sar">SR</span></span>
            </div>
          </div>
        </div>
      );
    },
    [statusBadgeMap, batchActionLoading, openBatchWithInvoices, setPrintingBatch],
  );

  const renderBatchMobileCard = useCallback(
    (row: PurchaseBatchSummaryRow) => {
      return (
        <div>
          <div className="flex mb-1 justify-between items-start">
            <button
              type="button"
              className="font-bold text-[14px] text-noorix-blue nx-font-numbers hover:underline"
              onClick={() => openBatchWithInvoices(row, setPrintingBatch)}
              disabled={batchActionLoading === row.batchId}
              title={row.batchId}
            >
              {compactBusinessIdentifier(row.batchId)}
            </button>
            <Badge {...Badge.fromStatus(row.status, statusBadgeMap)} size="sm" />
          </div>
          <div className="flex gap-2.5 text-[12px] text-noorix-muted mb-1.5">
            <span>{formatSaudiDate(row.transactionDate)}</span>
            {row.invoiceCount > 0 ? (
              <Link
                to={invoicesHref(dateFilter, row.batchId)}
                className="font-bold text-noorix-blue hover:underline"
              >
                {row.invoiceCount} {t('invoices')}
              </Link>
            ) : null}
          </div>
          {row.supplierNames ? (
            <div className="text-[13px] mb-1 text-end leading-snug break-words">{row.supplierNames}</div>
          ) : null}
          <div className="text-[12px] mb-2 text-noorix-muted text-end break-words">
            {t('vault')}: {row.vaultName || '-'}
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
        </div>
      );
    },
    [statusBadgeMap, t, batchActionLoading, openBatchWithInvoices, dateFilter, setPrintingBatch],
  );

  const batchesFooterRow = useMemo(
    () => [
      {
        keys: ['batchId', 'invoiceCount', 'supplierNames', 'vaultName'],
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
      tableId="purchases-batches"
      tableLayout="fixed"
      tableMinWidth={980}
      innerPadding={8}
      total={displayedTotal}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      isLoading={batchesLoading}
      isError={batchesError}
      errorMessage={batchesErrMessage}
      footerRow={batchesFooterRow}
      title={t('tabSavedBatches')}
      badge={
        <>
          <span className="text-[12px] text-noorix-muted">- {dateFilter.label}</span>
          <Badge color="blue" size="sm">
            {t('batchCount', displayedTotal)}
          </Badge>
        </>
      }
      searchValue={batchSearchInput}
      onSearchChange={(value) => {
        setBatchSearchInput(value);
        setPage(1);
      }}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={toggleSort}
      emptyMessage={t('noBatchesInPeriod')}
      renderCompactRow={renderCompactRow}
      renderMobileCard={renderBatchMobileCard}
      mobileMode="table"
      stripeMobileCards
      stickyActionColumn={false}
    />
  );
}
