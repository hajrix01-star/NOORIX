import React from 'react';
import InvoiceActionsCell from '../../components/common/InvoiceActionsCell';
import { Badge, FmtNum, cn } from '../../ui';
import {
  asInvoiceTableNumber,
  asInvoiceTableText,
  compactInvoiceDocumentNumber,
  formatInvoiceTableDate,
  getInvoiceTableAmountToneClass,
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

function renderMobileVaults(row: InvoiceTableRow, lang: InvoiceTableLang) {
  if (hasInvoiceTableVaultChips(row)) {
    const chips = mapInvoiceTableVaultChips({ row, lang, fmt: (value) => String(value) });
    return (
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <div key={chip.key} className={cn('inline-flex max-w-full min-w-0 items-center gap-1.5 px-1 py-0.5')}>
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

export function createInvoiceCompactRowRenderer({
  STATUS_MAP,
  KIND_MAP,
  setViewingInvoice,
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
        {renderMobileVaults(row, lang)}
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
