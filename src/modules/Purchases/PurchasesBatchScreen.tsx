/**
 * Batch entry for supplier invoices: table layout, bookmarks, compact summary.
 */
import React, { useMemo } from 'react';
import { ScreenTabs, ScreenShell } from '../../ui';
import { usePrintPreview } from '../../ui';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../ui/date';
import { useIsNarrow700 } from '../../ui';
import { buildPrintTableHtml } from '../../utils/printTableHtml';
import { getPurchaseBatchTabs } from './batch/constants';
import { purchaseBatchDisplayName } from './batch/purchaseBatchDisplayModel';
import { usePurchasesBatchState } from './batch/hooks/usePurchasesBatchState';
import { usePurchasesBatchData } from './batch/hooks/usePurchasesBatchData';
import { usePurchasesBatchActions } from './batch/hooks/usePurchasesBatchActions';
import PurchasesBatchHeader from './batch/components/PurchasesBatchHeader';
import PurchasesBatchToolbar from './batch/components/PurchasesBatchToolbar';
import PurchasesBatchSummary from './batch/components/PurchasesBatchSummary';
import PurchasesBatchFilters from './batch/components/PurchasesBatchFilters';
import PurchasesBatchTable from './batch/components/PurchasesBatchTable';
import PurchasesBatchModals from './batch/components/PurchasesBatchModals';
import PurchaseDebtsTab from './batch/components/PurchaseDebtsTab';
import { createEmptyPurchasesBatchRow } from './batch/constants';
import type { PurchaseDebtRecord } from '../../services/api';

export default function PurchasesBatchScreen() {
  const { activeCompanyId, language, companies } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const activeCompany = companies?.find((company) => company.id === activeCompanyId);
  const companyName = lang === 'en'
    ? (activeCompany?.nameEn || activeCompany?.nameAr || '')
    : (activeCompany?.nameAr || activeCompany?.nameEn || '');
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('print'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });

  const state = usePurchasesBatchState();
  const data = usePurchasesBatchData({
    companyId,
    lang,
    activeTab: state.activeTab,
    dateFilter,
    debouncedBatchQ: state.debouncedBatchQ,
    showCancelledBatches: state.showCancelledBatches,
    rows: state.rows,
    batchNotes: state.batchNotes,
    setBatchVaultId: state.setBatchVaultId,
    batchVaultId: state.batchVaultId,
    t,
  });

  const actions = usePurchasesBatchActions({
    companyId,
    t,
    rows: state.rows,
    setRows: state.setRows,
    setBatchNotes: state.setBatchNotes,
    batchNotes: state.batchNotes,
    batchDate: state.batchDate,
    batchVaultId: state.batchVaultId,
    prevBatchDateRef: state.prevBatchDateRef,
    setBatchDate: state.setBatchDate,
    dateFilter,
    bookmarks: data.bookmarks,
    setBatchActionLoading: state.setBatchActionLoading,
  });

  const batchEntryNarrow = useIsNarrow700();

  const purchaseBatchTabItems = useMemo(
    () =>
      getPurchaseBatchTabs(t).map((tab) => ({
        id: tab.id,
        label: tab.icon ? (
          <>
            {tab.icon} {tab.label}
          </>
        ) : (
          tab.label
        ),
      })),
    [t],
  );

  const hasCompany = !!companyId;
  const handleImportDebts = (records: PurchaseDebtRecord[]) => {
    state.setRows((currentRows) => {
      const existing = new Set(currentRows.map((row) => row.legacyDebtId).filter(Boolean));
      const imported = records
        .filter((record) => !existing.has(record.id))
        .map((record) => ({
          ...createEmptyPurchasesBatchRow(),
          legacyDebtId: record.id,
          legacyDebtSupplierName: lang === 'en'
            ? (record.supplier.nameEn || record.supplier.nameAr)
            : (record.supplier.nameAr || record.supplier.nameEn || ''),
          supplierId: record.supplierId,
          invoiceNumber: record.supplierInvoiceNumber,
          totalInclusive: String(record.totalAmount),
          invoiceDate: String(record.invoiceDate).slice(0, 10),
          kind: 'purchase' as const,
          isTaxable: record.isTaxable,
          notes: record.notes || '',
        }));
      const meaningful = currentRows.filter((row) =>
        row.legacyDebtId || row.supplierId || row.invoiceNumber || row.totalInclusive || row.notes,
      );
      return [...meaningful, ...imported];
    });
    state.setActiveTab('entry');
  };
  const handlePrintCurrentDraftBatch = () => {
    if (data.summary.count === 0) return;
    const supplierById = new Map(data.suppliers.map((supplier) => [supplier.id, supplier]));
    openPrintDocumentPreview({
      title: t('print'),
      companyName,
      logoUrl: String(activeCompany?.logoUrl || '').trim(),
      subtitle: dateFilter.label,
      landscape: true,
      body: buildPrintTableHtml({
        columns: [
          { key: 'index', header: '#' },
          { key: 'invoiceNumber', header: t('documentNumber') },
          { key: 'supplier', header: t('supplier') },
          { key: 'kind', header: t('kind') },
          { key: 'total', header: t('total') },
          { key: 'date', header: t('date') },
          { key: 'notes', header: t('notes') },
        ],
        rows: state.rows
          .filter((row) => row.invoiceNumber || row.supplierId || row.totalInclusive)
          .map((row, index) => ({
            index: index + 1,
            invoiceNumber: row.invoiceNumber || '-',
            supplier: purchaseBatchDisplayName(supplierById.get(row.supplierId) || null, lang),
            kind: row.kind === 'purchase' ? t('purchaseType') : t('expenseType'),
            total: row.totalInclusive || '0',
            date: row.invoiceDate || state.batchDate,
            notes: row.notes || '',
          })),
        footerRows: [[
          { value: t('totalSum', data.summary.count), colSpan: 4 },
          { value: `${data.summary.total.toNumber().toLocaleString('en', { maximumFractionDigits: 0 })} SR` },
          { value: '' },
          { value: '' },
        ]],
      }),
    });
  };

  return (
    <ScreenShell variant="data" className="w-full">
      {printPreviewModal}
      <PurchasesBatchHeader />

      {!hasCompany && (
        <div className="noorix-surface-card text-center text-noorix-muted text-[14px] p-6">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {hasCompany && (
        <ScreenTabs
          items={purchaseBatchTabItems}
          value={state.activeTab}
          onChange={state.setActiveTab}
          contentClassName="nx-tab-content p-0 min-h-0"
          animateContent={false}
        >
          {state.activeTab === 'entry' && (
            <div>
              <PurchasesBatchToolbar
                language={language}
                batchDate={state.batchDate}
                onBatchDateChange={actions.handleBatchDateChange}
                batchVaultId={state.batchVaultId}
                onBatchVaultChange={state.setBatchVaultId}
                batchNotes={state.batchNotes}
                onBatchNotesChange={state.setBatchNotes}
                activeVaults={data.activeVaults}
                vaultsLoading={data.vaultsLoading}
                batchEntryNarrow={batchEntryNarrow}
                rows={state.rows}
                suppliers={data.suppliers}
                flatCategories={data.flatCategories}
                bookmarks={data.bookmarks}
                onUpdateRow={state.updateRow}
                onRemoveRow={state.removeRow}
                onBookmark={actions.toggleBookmark}
                onAddRow={state.addRow}
                t={t}
                vatRateDecimal={data.vatRateDecimal}
              >
                <PurchasesBatchSummary
                  count={data.summary.count}
                  net={data.summary.net.toNumber()}
                  tax={data.summary.tax.toNumber()}
                  total={data.summary.total.toNumber()}
                  savePending={actions.saveMutation.isPending}
                  saveDisabled={
                    actions.saveMutation.isPending
                    || data.summary.count === 0
                    || !state.batchVaultId
                    || data.activeVaults.length === 0
                  }
                  onSave={() => actions.saveMutation.mutate(undefined)}
                  onPrint={handlePrintCurrentDraftBatch}
                  t={t}
                />
              </PurchasesBatchToolbar>
            </div>
          )}

          {state.activeTab === 'history' && (
            <div className="flex flex-col gap-4 p-4">
              <PurchasesBatchFilters
                dateFilter={dateFilter}
                showCancelledBatches={state.showCancelledBatches}
                onToggleCancelled={() => state.setShowCancelledBatches((v: boolean) => !v)}
                t={t}
              />
              <PurchasesBatchTable
                filteredData={data.filteredData}
                displayedTotal={data.displayedTotal}
                page={data.page}
                setPage={data.setPage}
                sortKey={data.sortKey}
                sortDir={data.sortDir}
                toggleSort={data.toggleSort}
                batchesLoading={data.batchesLoading}
                batchesError={!!data.batchesError}
                batchesErrMessage={data.batchesErr?.message || ''}
                batchSearchInput={state.batchSearchInput}
                setBatchSearchInput={state.setBatchSearchInput}
                dateFilter={dateFilter}
                t={t}
                statusBadgeMap={data.statusBadgeMap}
                batchActionLoading={state.batchActionLoading}
                openBatchWithInvoices={actions.openBatchWithInvoices}
                setPrintingBatch={state.setPrintingBatch}
                activeOnlyLength={data.activeOnly.length}
                totalNet={data.totalNet}
                totalTax={data.totalTax}
                totalAmount={data.totalAmount}
              />
            </div>
          )}

          {state.activeTab === 'debts' && (
            <PurchaseDebtsTab
              companyId={companyId}
              lang={lang}
              suppliers={data.suppliers}
              onImport={handleImportDebts}
            />
          )}
        </ScreenTabs>
      )}

      <PurchasesBatchModals
        printingBatch={state.printingBatch}
        editingBatch={state.editingBatch}
        cancellingBatch={state.cancellingBatch}
        suppliers={data.suppliers}
        companyId={companyId}
        vatRateDecimal={data.vatRateDecimal}
        onClosePrint={() => state.setPrintingBatch(null)}
        onCloseEdit={() => state.setEditingBatch(null)}
        onCloseCancel={() => state.setCancellingBatch(null)}
        onEditPrintedBatch={(batch) => {
          state.setPrintingBatch(null);
          state.setEditingBatch(batch);
        }}
        onCancelPrintedBatch={(batch) => {
          state.setPrintingBatch(null);
          state.setCancellingBatch(batch);
        }}
        onSaveInvoice={actions.saveInvoiceEdit}
        onConfirmCancel={() => {
          if (!state.cancellingBatch) return Promise.resolve();
          return actions.handleCancelBatch(state.cancellingBatch, state.setEditingBatch)
            .then(() => state.setCancellingBatch(null));
        }}
      />
    </ScreenShell>
  );
}
