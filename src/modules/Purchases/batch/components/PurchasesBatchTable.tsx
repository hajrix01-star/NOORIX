import { useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Button, Badge, KebabMenu, SmartTable } from '../../../../ui';
import type { SmartTableColumn } from '../../../../ui';
import { formatSaudiDate, toYmd } from '../../../../utils/saudiDate';
import { fmt } from '../../../../utils/format';
import { PAGE_SIZE } from '../constants';
import { formatBatchesFooterLabel } from '../utils/purchasesBatchFormatters';
import type {
  BatchTranslateFn,
  PurchaseBatchStatus,
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
  setEditingBatch: Dispatch<SetStateAction<PurchaseBatchSummaryRow | null>>;
  setCancellingBatch: Dispatch<SetStateAction<PurchaseBatchSummaryRow | null>>;
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

function isCancelableBatch(status: PurchaseBatchStatus) {
  return status === 'active' || status === 'partial';
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
    setEditingBatch,
    setCancellingBatch,
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
        width: '10%',
        render: (value) => (
          <span className="font-bold nx-cell-ellipsis text-noorix-blue nx-font-numbers">
            {String(value ?? '')}
          </span>
        ),
      },
      {
        key: 'transactionDate',
        kind: 'date',
        label: t('transactionDate'),
        sortable: true,
        width: '8%',
        render: (value) => (
          <span className="text-[12px] text-noorix-muted nx-font-numbers">
            {formatSaudiDate(String(value ?? ''))}
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
        width: '20%',
        render: (value) => <span className="nx-cell-ellipsis block">{String(value || '-')}</span>,
      },
      {
        key: 'vaultName',
        kind: 'text',
        label: t('vault'),
        sortable: true,
        width: '13%',
        render: (value) => <span className="nx-cell-ellipsis block">{String(value || '-')}</span>,
      },
      {
        key: 'netAmount',
        kind: 'money',
        label: t('net'),
        numeric: true,
        sortable: true,
        width: '8%',
        render: (value) => <span className="text-noorix-green nx-font-numbers">{fmt(value)}</span>,
      },
      {
        key: 'taxAmount',
        kind: 'money',
        label: t('tax'),
        numeric: true,
        sortable: true,
        width: '7%',
        render: (value) => <span className="text-noorix-amber nx-font-numbers">{fmt(value)}</span>,
      },
      {
        key: 'totalAmount',
        kind: 'money',
        label: t('total'),
        numeric: true,
        sortable: true,
        width: '8%',
        render: (value) => <span className="font-bold nx-font-numbers">{fmt(value)}</span>,
      },
      {
        key: 'status',
        kind: 'status',
        label: t('statusLabel'),
        width: '8%',
        render: (value) => <Badge {...Badge.fromStatus(value, statusBadgeMap)} size="sm" />,
      },
      {
        key: 'actions',
        kind: 'actions',
        label: t('actions'),
        align: 'center',
        width: '48px',
        render: (_value, row) => {
          const loading = batchActionLoading === row.batchId;
          return (
            <KebabMenu
              ariaLabel={t('actions')}
              items={[
                { key: 'print', label: t('print'), onClick: () => openBatchWithInvoices(row, setPrintingBatch), disabled: loading },
                { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => openBatchWithInvoices(row, setEditingBatch), disabled: loading },
                ...(isCancelableBatch(row.status)
                  ? [{ key: 'cancel', label: t('cancel'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => setCancellingBatch(row), disabled: loading }]
                  : []),
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
      dateFilter,
      setPrintingBatch,
      setEditingBatch,
      setCancellingBatch,
    ],
  );

  const renderCompactRow = useCallback(
    (row: PurchaseBatchSummaryRow) => {
      const loading = batchActionLoading === row.batchId;
      return (
        <div>
          <div className="nx-cr__line1">
            <span className="nx-cr__id text-noorix-blue">{row.batchId}</span>
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
              <div className="nx-cr__kebab" onClick={(event) => event.stopPropagation()}>
                <KebabMenu
                  ariaLabel={t('actions')}
                  items={[
                    { key: 'print', label: t('print'), onClick: () => openBatchWithInvoices(row, setPrintingBatch), disabled: loading },
                    { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => openBatchWithInvoices(row, setEditingBatch), disabled: loading },
                    ...(isCancelableBatch(row.status)
                      ? [{ key: 'cancel', label: t('cancel'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => setCancellingBatch(row), disabled: loading }]
                      : []),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      );
    },
    [statusBadgeMap, t, batchActionLoading, openBatchWithInvoices, setPrintingBatch, setEditingBatch, setCancellingBatch],
  );

  const renderBatchMobileCard = useCallback(
    (row: PurchaseBatchSummaryRow) => {
      const loading = batchActionLoading === row.batchId;
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
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button
              size="sm"
              onClick={() => openBatchWithInvoices(row, setPrintingBatch)}
              disabled={loading}
            >
              {t('print')}
            </Button>
            <Button
              size="sm"
              onClick={() => openBatchWithInvoices(row, setEditingBatch)}
              disabled={loading}
            >
              {t('edit')}
            </Button>
            {isCancelableBatch(row.status) ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setCancellingBatch(row)}
                disabled={loading}
              >
                {t('cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      );
    },
    [statusBadgeMap, t, batchActionLoading, openBatchWithInvoices, dateFilter, setPrintingBatch, setEditingBatch, setCancellingBatch],
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
      tableId="purchases-batches"
      tableLayout="fixed"
      tableMinWidth={1100}
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
      stripeMobileCards
      stickyActionColumn={false}
    />
  );
}
