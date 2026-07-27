import React from 'react';
import { Badge, FmtNum, cn } from '../../ui';
import type { SmartTableColumn } from '../../ui';
import InvoiceActionsCell from '../../components/common/InvoiceActionsCell';
import { PAGE_SIZE } from './invoicesListScreenHelpers';
import {
  asInvoiceTableNumber,
  asInvoiceTableText,
  compactInvoiceDocumentNumber,
  formatInvoiceTableDate,
  getInvoiceTableAmountToneClass,
  getInvoiceTableDocumentToneClass,
  getInvoiceTableEmptyValue,
  getInvoiceTableVaultName,
  hasInvoiceTableVaultChips,
  mapInvoiceTableVaultChips,
  type InvoiceTableLang,
  type InvoiceTableRow,
} from './invoiceTableRowModel';

type Translate = (key: string, ...args: unknown[]) => string;
type StatusMap = Record<string, unknown>;
type UserRole = string | undefined;
type InvoiceRowSetter = (row: InvoiceTableRow | null) => void;
type InvoiceRowAction = (row: InvoiceTableRow) => void;

type InvoiceListColumnsParams = {
  t: Translate;
  lang: InvoiceTableLang;
  fmt: (value: number) => string;
  STATUS_MAP: StatusMap;
  KIND_MAP: StatusMap;
  userRole: UserRole;
  companyId?: string;
  setViewingInvoice: InvoiceRowSetter;
  setEditingInvoice: InvoiceRowSetter;
  printInvoice: InvoiceRowAction;
  confirmAndDeleteInvoice: InvoiceRowAction;
};

type InvoiceFooterTotals = {
  count: number;
  net: number | string;
  tax: number | string;
  total: number | string;
};

type InvoiceFooterParams = {
  t: Translate;
  serverAll: InvoiceFooterTotals;
  total: number;
};

type InvoiceRowRendererParams = {
  t: Translate;
  lang?: InvoiceTableLang;
  STATUS_MAP: StatusMap;
  KIND_MAP: StatusMap;
  userRole: UserRole;
  companyId?: string;
  setViewingInvoice?: InvoiceRowSetter;
  setEditingInvoice: InvoiceRowSetter;
  printInvoice: InvoiceRowAction;
  confirmAndDeleteInvoice: InvoiceRowAction;
};

function renderTextCell(value: unknown, className = 'nx-cell-ellipsis') {
  const text = asInvoiceTableText(value);
  return (
    <span className={className} title={text}>
      {text}
    </span>
  );
}

function renderDocumentCell(row: InvoiceTableRow, onView: InvoiceRowSetter) {
  const fullNumber = asInvoiceTableText(row.invoiceNumber);
  const compactNumber = compactInvoiceDocumentNumber(row.invoiceNumber);
  const date = formatInvoiceTableDate(row.transactionDate);
  const title = date === getInvoiceTableEmptyValue() ? fullNumber : `${fullNumber} - ${date}`;

  return (
    <button
      type="button"
      className="mx-auto flex min-w-0 flex-col items-center justify-center gap-0.5 leading-tight rounded-md px-2 py-1 text-center transition hover:bg-noorix-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noorix-blue"
      title={title}
      onClick={() => onView(row)}
    >
      <span className={cn('nx-cell-num max-w-full truncate font-bold', getInvoiceTableDocumentToneClass(row))}>
        {compactNumber}
      </span>
      <span className="nx-cell-muted-sm whitespace-nowrap">{date}</span>
    </button>
  );
}

function renderVaultChips(row: InvoiceTableRow, lang: InvoiceTableLang, fmt: (value: number) => string) {
  const chips = mapInvoiceTableVaultChips({ row, lang, fmt });
  return (
    <div className="flex flex-nowrap gap-1.5 justify-center overflow-hidden">
      {chips.map((chip) => (
        <div
          key={chip.key}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-noorix-border',
            'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
          )}
          title={chip.title}
        >
          <span className="truncate text-[11px] font-semibold text-noorix-text max-w-[60px]">
            {chip.label}
          </span>
          <span dir="ltr" className="shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums text-nx-sales">
            <FmtNum n={chip.amount} /> <span className="nx-sar">SR</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function renderVaultCell(row: InvoiceTableRow, lang: InvoiceTableLang, fmt: (value: number) => string) {
  if (hasInvoiceTableVaultChips(row)) return renderVaultChips(row, lang, fmt);
  const vaultName = getInvoiceTableVaultName(row, lang);
  return (
    <span className="nx-cell-ellipsis text-[12px] text-center" title={vaultName}>
      {vaultName}
    </span>
  );
}

function renderMobileVaults(row: InvoiceTableRow, lang: InvoiceTableLang, fmt: (value: number) => string) {
  if (hasInvoiceTableVaultChips(row)) {
    const chips = mapInvoiceTableVaultChips({ row, lang, fmt });
    return (
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <div
            key={chip.key}
            className={cn(
              'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-noorix-border',
              'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
            )}
          >
            <span className="min-w-0 truncate text-[11px] font-semibold text-noorix-text">{chip.label}</span>
            <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-sales">
              <FmtNum n={chip.amount} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  return <div className="text-[12px] text-noorix-muted">{getInvoiceTableVaultName(row, lang)}</div>;
}

export function buildInvoiceListColumns({
  t,
  lang,
  fmt,
  STATUS_MAP,
  KIND_MAP,
  setViewingInvoice,
}: InvoiceListColumnsParams): SmartTableColumn<InvoiceTableRow>[] {
  return [
    {
      key: 'invoiceNumber',
      kind: 'id',
      size: 'document',
      label: t('documentNumber'),
      align: 'center',
      shrink: true,
      width: '10ch',
      sortable: true,
      render: (_value: unknown, row: InvoiceTableRow) => renderDocumentCell(row, setViewingInvoice),
    },
    {
      key: 'supplierInvoiceNumber',
      kind: 'id',
      label: t('supplierInvoiceNumber'),
      align: 'center',
      shrink: true,
      width: '11ch',
      render: (value: unknown) => renderTextCell(value, 'nx-cell-num nx-cell-muted nx-cell-ellipsis'),
    },
    {
      key: 'supplierName',
      kind: 'text',
      label: t('supplier'),
      align: 'center',
      width: '15ch',
      render: (value: unknown) => renderTextCell(value),
    },
    {
      key: 'createdByDisplayName',
      kind: 'text',
      label: t('invoiceUserColumn'),
      align: 'center',
      width: '14ch',
      render: (value: unknown) => renderTextCell(value),
    },
    {
      key: 'notesOrEmployee',
      kind: 'text',
      label: t('invoiceNotesColumn') || 'Notes',
      align: 'center',
      width: '18ch',
      render: (_: unknown, row: InvoiceTableRow) => renderTextCell(row.notes),
    },
    {
      key: 'kind',
      kind: 'status',
      label: t('type'),
      align: 'center',
      shrink: true,
      width: '9ch',
      render: (value: unknown) => <Badge {...Badge.fromStatus(value, KIND_MAP)} size="sm" />,
    },
    {
      key: 'vaultLabel',
      kind: 'text',
      label: t('invoiceVaultColumn'),
      align: 'center',
      width: '18ch',
      render: (_: unknown, row: InvoiceTableRow) => renderVaultCell(row, lang, fmt),
    },
    {
      key: 'netAmount',
      kind: 'money',
      size: 'money-sm',
      label: t('net'),
      align: 'center',
      numeric: true,
      shrink: true,
      width: '11ch',
      sortable: true,
      render: (value: unknown) => <FmtNum n={asInvoiceTableNumber(value)} className="nx-cell-num nx-cell-num--green" />,
    },
    {
      key: 'taxAmount',
      kind: 'money',
      size: 'tax',
      label: t('tax'),
      align: 'center',
      numeric: true,
      shrink: true,
      width: '10ch',
      render: (value: unknown) => <FmtNum n={asInvoiceTableNumber(value)} className="nx-cell-num nx-cell-num--amber" />,
    },
    {
      key: 'totalAmount',
      kind: 'money',
      size: 'money-md',
      label: t('total'),
      align: 'center',
      numeric: true,
      shrink: true,
      width: '11ch',
      sortable: true,
      render: (value: unknown) => <FmtNum n={asInvoiceTableNumber(value)} className="nx-cell-num nx-cell-bold" />,
    },
    {
      key: 'status',
      kind: 'status',
      label: t('statusLabel'),
      align: 'center',
      shrink: true,
      width: '9ch',
      render: (value: unknown) => <Badge {...Badge.fromStatus(value, STATUS_MAP)} size="sm" />,
    },
  ];
}

export function buildInvoiceListFooterRow({ t, serverAll, total }: InvoiceFooterParams) {
  return [
    {
      keys: ['invoiceNumber', 'supplierInvoiceNumber', 'supplierName', 'createdByDisplayName', 'notesOrEmployee', 'kind', 'vaultLabel'],
      className: 'nx-tfoot-label text-[12px] text-center',
      content: (
        <>
          {t('totalInvoices', serverAll.count)}
          {total > PAGE_SIZE && (
            <span className="text-[11px] opacity-[0.65]">
              {' '}
              ({t('allPages')})
            </span>
          )}
        </>
      ),
    },
    {
      keys: ['netAmount'],
      className: 'nx-tfoot-num nx-cell-num--green text-center',
      content: <FmtNum n={asInvoiceTableNumber(serverAll.net)} />,
    },
    {
      keys: ['taxAmount'],
      className: 'nx-tfoot-num nx-cell-num--amber text-center',
      content: <FmtNum n={asInvoiceTableNumber(serverAll.tax)} />,
    },
    {
      keys: ['totalAmount'],
      className: 'nx-tfoot-num nx-cell-num--violet text-center',
      content: <FmtNum n={asInvoiceTableNumber(serverAll.total)} />,
    },
  ];
}

export function createInvoiceCompactRowRenderer({
  t,
  STATUS_MAP,
  KIND_MAP,
  userRole,
  companyId,
  setViewingInvoice,
  setEditingInvoice,
  printInvoice,
  confirmAndDeleteInvoice,
}: InvoiceRowRendererParams) {
  return (row: InvoiceTableRow) => {
    const amountToneClass = getInvoiceTableAmountToneClass(row);
    return (
      <div className="cursor-pointer" onClick={() => setViewingInvoice?.(row)}>
        <div className="nx-cr__line1">
          <span className={`nx-cr__id ${amountToneClass}`} title={asInvoiceTableText(row.invoiceNumber)}>
            {compactInvoiceDocumentNumber(row.invoiceNumber)}
          </span>
          <Badge {...Badge.fromStatus(row.kind, KIND_MAP)} size="sm" />
          <span className="nx-cr__sub flex-1">{asInvoiceTableText(row.supplierName)}</span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            <span className="nx-cr__meta">{formatInvoiceTableDate(row.transactionDate)}</span>
          </div>
          <div className="nx-cr__line2-end">
            <span className={`nx-cr__amount ${amountToneClass}`}>
              <FmtNum n={asInvoiceTableNumber(row.totalAmount)} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        </div>
      </div>
    );
  };
}

export function createInvoiceListMobileCardRenderer({
  t,
  lang = 'ar',
  STATUS_MAP,
  KIND_MAP,
  userRole,
  companyId,
  setEditingInvoice,
  printInvoice,
  confirmAndDeleteInvoice,
}: InvoiceRowRendererParams) {
  return (row: InvoiceTableRow) => (
    <div>
      <div className="nx-mc__header">
        <span className="nx-cell-num nx-cell-accent text-[14px]" title={asInvoiceTableText(row.invoiceNumber)}>
          {compactInvoiceDocumentNumber(row.invoiceNumber)}
        </span>
        <div className="nx-mc__meta">
          <span className="nx-cell-muted-sm">{formatInvoiceTableDate(row.transactionDate)}</span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-1.5 items-stretch text-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge {...Badge.fromStatus(row.kind, KIND_MAP)} size="sm" />
        </div>
        {row.supplierName ? (
          <div className="text-[13px] text-noorix-muted leading-snug break-words">{row.supplierName}</div>
        ) : null}
        {row.createdByDisplayName ? (
          <div className="text-[12px] text-noorix-text leading-snug break-words">
            <span className="text-noorix-muted font-semibold">{t('invoiceUserColumn')}: </span>
            {row.createdByDisplayName}
          </div>
        ) : null}
      </div>
      <div className="mb-2">
        <div className="text-[12px] font-bold text-noorix-muted mb-1 text-end">{t('invoiceVaultColumn')}</div>
        {renderMobileVaults(row, lang, (value) => String(value))}
      </div>
      <div className="nx-mc__grid nx-mc__grid--3">
        <div>
          <div className="nx-mc__stat-label">{t('total')}</div>
          <div className="nx-mc__stat-value">
            <FmtNum n={asInvoiceTableNumber(row.totalAmount)} />
          </div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('net')}</div>
          <div className="nx-mc__stat-value nx-cell-num--green text-[13px]">
            <FmtNum n={asInvoiceTableNumber(row.netAmount)} />
          </div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('tax')}</div>
          <div className="nx-mc__stat-value nx-cell-num--amber text-[13px]">
            <FmtNum n={asInvoiceTableNumber(row.taxAmount)} />
          </div>
        </div>
      </div>
      <div className="nx-mc__actions">
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onPrint={printInvoice}
          onEdit={(invoiceRow: InvoiceTableRow) => setEditingInvoice(invoiceRow)}
          onDelete={confirmAndDeleteInvoice}
        />
      </div>
    </div>
  );
}
