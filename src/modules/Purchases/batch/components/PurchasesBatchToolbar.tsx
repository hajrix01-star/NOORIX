import React from 'react';
import { Button, Input, SearchableOptionsPicker, TransactionDatePicker } from '../../../../ui';
import { vaultDisplayName } from '../../../../utils/vaultDisplay';
import { BatchRow } from '../../components/BatchRow';
import type {
  BatchTranslateFn,
  PurchaseBatchEntryRow,
  PurchaseBatchSupplier,
  PurchaseBatchSupplierCategory,
  PurchaseBatchUpdateRow,
  PurchaseBatchVault,
} from '../purchaseBatchTypes';

type PurchasesBatchHeaderCell = {
  label: string;
  align: React.CSSProperties['textAlign'];
  title?: string;
};

export interface PurchasesBatchToolbarProps {
  language: string;
  batchDate: string;
  onBatchDateChange: (value: string) => void;
  batchVaultId: string;
  onBatchVaultChange: (v: string) => void;
  batchNotes: string;
  onBatchNotesChange: (v: string) => void;
  activeVaults: PurchaseBatchVault[];
  vaultsLoading: boolean;
  batchEntryNarrow: boolean;
  rows: PurchaseBatchEntryRow[];
  suppliers: PurchaseBatchSupplier[];
  flatCategories: PurchaseBatchSupplierCategory[];
  bookmarks: string[];
  onUpdateRow: PurchaseBatchUpdateRow;
  onRemoveRow: (i: number) => void;
  onBookmark: (id: string) => void;
  onAddRow: () => void;
  t: BatchTranslateFn;
  vatRateDecimal?: number;
  children?: React.ReactNode;
}

export default function PurchasesBatchToolbar(props: PurchasesBatchToolbarProps) {
  const {
    language,
    batchDate,
    onBatchDateChange,
    batchVaultId,
    onBatchVaultChange,
    batchNotes,
    onBatchNotesChange,
    activeVaults,
    vaultsLoading,
    batchEntryNarrow,
    rows,
    suppliers,
    flatCategories,
    bookmarks,
    onUpdateRow,
    onRemoveRow,
    onBookmark,
    onAddRow,
    t,
    vatRateDecimal,
    children,
  } = props;
  const vaultOptions = activeVaults.map((vault) => ({
    value: vault.id,
    label: vaultDisplayName(vault, language),
  }));
  const tableHeaderCells: PurchasesBatchHeaderCell[] = [
    { label: '#', align: 'center' },
    { label: t('supplier'), align: 'right' },
    { label: t('supplierInvoiceNumber'), align: 'center' },
    { label: t('total'), align: 'center' },
    { label: `${t('net')} / ${t('tax')}`, align: 'center' },
    { label: t('date'), align: 'center' },
    { label: t('type'), align: 'center' },
    { label: t('warrantyFollowUpCol'), align: 'center', title: t('warrantyFollowUpColHint') },
    { label: t('category'), align: 'center' },
    { label: t('taxPct'), align: 'center', title: t('taxPctTitle') },
    { label: t('notes'), align: 'right' },
    { label: t('invoiceReceiptCol'), align: 'center', title: t('invoiceReceiptAttachment') },
    { label: '', align: 'center' },
  ];

  return (
    <div>
      <div className="batch-purchases-entry-toolbar border-b border-noorix-border bg-noorix-bg">
        <div className="batch-purchases-entry-toolbar__control">
          <label className="text-[12px] font-bold text-noorix-muted whitespace-nowrap" htmlFor="batch-purchase-date">
            {t('transactionDateLabel')}
          </label>
          <TransactionDatePicker
            id="batch-purchase-date"
            value={batchDate}
            onValueChange={onBatchDateChange}
            className="nx-font-numbers"
          />
        </div>
        <div className="batch-purchases-entry-toolbar__control">
          <label className="text-[12px] font-bold text-noorix-muted whitespace-nowrap" htmlFor="batch-purchase-vault">
            {t('batchPurchasesPayVault')}
          </label>
          <SearchableOptionsPicker
            id="batch-purchase-vault"
            mode="single"
            value={batchVaultId}
            onChange={onBatchVaultChange}
            options={vaultOptions}
            allowEmpty
            emptyValue=""
            emptyLabel={t('batchPurchasesVaultPlaceholder')}
            disabled={vaultsLoading}
            size="md"
          />
        </div>
        <div className="batch-purchases-entry-toolbar__control batch-purchases-entry-toolbar__control--grow min-w-0 flex-1 basis-[min(100%,280px)]">
          <label className="text-[12px] font-bold text-noorix-muted whitespace-nowrap" htmlFor="batch-purchase-batch-notes">
            {t('batchPurchasesBatchNotes')}
          </label>
          <Input
            id="batch-purchase-batch-notes"
            type="text"
            multiline
            rows={2}
            value={batchNotes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onBatchNotesChange(e.target.value)}
            className="w-full min-w-0"
          />
        </div>
      </div>

      {!vaultsLoading && activeVaults.length === 0 && (
        <div className="text-[13px] border-b border-noorix-border py-[10px] px-4 text-noorix-amber bg-[var(--noorix-yellow-12)]">
          {t('batchPurchasesNoVaults')}
        </div>
      )}

      <div className="px-3 pb-4">
        {batchEntryNarrow ? (
          <div className="flex flex-col gap-3 min-w-0">
            {rows.map((row, index) => (
              <BatchRow
                key={row.key}
                layout="stack"
                row={row}
                index={index}
                suppliers={suppliers}
                categories={flatCategories}
                bookmarkedIds={bookmarks}
                onUpdate={onUpdateRow}
                onRemove={onRemoveRow}
                onBookmark={onBookmark}
                maxInvoiceDate={batchDate}
                vatRateDecimal={vatRateDecimal}
              />
            ))}
          </div>
        ) : (
          <div className="noorix-table-frame batch-purchases-table w-full overflow-x-auto">
            <table className="noorix-table w-full table-fixed min-w-[1040px]">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[9%]" />
                <col className="w-[5%]" />
                <col className="w-[11%]" />
                <col className="w-[5%]" />
                <col className="w-[3%]" />
              </colgroup>
              <thead>
                <tr>
                  {tableHeaderCells.map(({ label, align, title }, hi) => (
                    <th
                      key={hi}
                      title={title}
                      className="text-[11px] font-bold text-noorix-muted overflow-hidden whitespace-nowrap py-2 px-1.5"
                      style={{ textAlign: align }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <BatchRow
                    key={row.key}
                    layout="table"
                    row={row}
                    index={index}
                    suppliers={suppliers}
                    categories={flatCategories}
                    bookmarkedIds={bookmarks}
                    onUpdate={onUpdateRow}
                    onRemove={onRemoveRow}
                    onBookmark={onBookmark}
                    maxInvoiceDate={batchDate}
                    vatRateDecimal={vatRateDecimal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Button size="sm" onClick={onAddRow} className="mt-3">
          {t('addRow')}
        </Button>

        {children}
      </div>
    </div>
  );
}
