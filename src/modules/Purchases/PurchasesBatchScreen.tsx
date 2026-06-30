/**
 * Batch entry for supplier invoices: table layout, bookmarks, compact summary.
 */
import React, { useMemo } from 'react';
import { ScreenTabs, ScreenShell } from '../../ui';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../shared/components/DateFilterBar';
import { useIsNarrow700 } from '../../hooks/useMediaQuery';
import { getPurchaseBatchTabs } from './batch/constants';
import { usePurchasesBatchState } from './batch/hooks/usePurchasesBatchState';
import { usePurchasesBatchData } from './batch/hooks/usePurchasesBatchData';
import { usePurchasesBatchActions } from './batch/hooks/usePurchasesBatchActions';
import PurchasesBatchHeader from './batch/components/PurchasesBatchHeader';
import PurchasesBatchToolbar from './batch/components/PurchasesBatchToolbar';
import PurchasesBatchSummary from './batch/components/PurchasesBatchSummary';
import PurchasesBatchFilters from './batch/components/PurchasesBatchFilters';
import PurchasesBatchTable from './batch/components/PurchasesBatchTable';
import PurchasesBatchModals from './batch/components/PurchasesBatchModals';

export default function PurchasesBatchScreen() {
  const { activeCompanyId, language } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();

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
    () => getPurchaseBatchTabs(t).map((tab: any) => ({ id: tab.id, label: tab.icon ? <>{tab.icon} {tab.label}</> : tab.label })),
    [t],
  );

  const hasCompany = !!companyId;

  return (
    <ScreenShell className="w-full">
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
                handleCancelBatch={actions.handleCancelBatch}
                setPrintingBatch={state.setPrintingBatch}
                setEditingBatch={state.setEditingBatch}
                activeOnlyLength={data.activeOnly.length}
                totalNet={data.totalNet}
                totalTax={data.totalTax}
                totalAmount={data.totalAmount}
              />
            </div>
          )}
        </ScreenTabs>
      )}

      <PurchasesBatchModals
        printingBatch={state.printingBatch}
        editingBatch={state.editingBatch}
        suppliers={data.suppliers}
        companyId={companyId}
        vatRateDecimal={data.vatRateDecimal}
        onClosePrint={() => state.setPrintingBatch(null)}
        onCloseEdit={() => state.setEditingBatch(null)}
        onSaveInvoice={actions.saveInvoiceEdit}
      />
    </ScreenShell>
  );
}
