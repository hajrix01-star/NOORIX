import React from 'react';
import { Badge, FmtNum, cn } from '../../ui';
import type { SmartTableColumn } from '../../ui';
import { PAGE_SIZE } from './invoicesListScreenHelpers';
import {
  asInvoiceTableNumber,
  asInvoiceTableText,
  compactInvoiceDocumentNumber,
  formatInvoiceTableDate,
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

export { createInvoiceCompactRowRenderer, createInvoiceListMobileCardRenderer } from './invoicesListMobileRenderers';

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
            'inline-flex shrink-0 items-center gap-1.5 px-1 py-0.5',
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

function renderUserStatusCell(row: InvoiceTableRow, statusMap: StatusMap) {
  const userName = asInvoiceTableText(row.createdByDisplayName);
  return (
    <div className="mx-auto flex min-w-0 flex-col items-center justify-center gap-1 text-center">
      <span className="nx-cell-ellipsis max-w-full" title={userName}>
        {userName}
      </span>
      <Badge {...Badge.fromStatus(row.status, statusMap)} size="sm" />
    </div>
  );
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
      label: `${t('invoiceUserColumn')} / ${t('statusLabel')}`,
      align: 'center',
      width: '13ch',
      render: (_value: unknown, row: InvoiceTableRow) => renderUserStatusCell(row, STATUS_MAP),
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
      key: 'notesOrEmployee',
      kind: 'text',
      label: t('invoiceNotesColumn') || 'Notes',
      align: 'center',
      width: '18ch',
      render: (_: unknown, row: InvoiceTableRow) => renderTextCell(row.notes),
    },
  ];
}

export function buildInvoiceListFooterRow({ t, serverAll, total }: InvoiceFooterParams) {
  return [
    {
      keys: ['invoiceNumber', 'supplierInvoiceNumber', 'supplierName', 'createdByDisplayName', 'kind', 'vaultLabel'],
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
    {
      keys: ['notesOrEmployee'],
      className: 'nx-tfoot-label text-[12px] text-center',
      content: '',
    },
  ];
}
