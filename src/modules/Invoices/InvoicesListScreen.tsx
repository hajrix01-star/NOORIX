/**
 * InvoicesListScreen — قائمة الفواتير (عرض فقط؛ المنطق في useInvoicesListScreen)
 */
import React from 'react';
import { ScreenShell, SmartTable } from '../../ui';
import { InvoiceEditModal } from './components/InvoiceEditModal';
import ImportExportModal from '../../components/ImportExportModal';
import DayCloseReportModal from './components/DayCloseReportModal';
import { InvoicesCashReportModal } from './components/InvoicesCashReportModal';
import { InvoiceViewModal } from './components/InvoiceViewModal';
import { InvoicesListExecutiveCards } from './components/InvoicesListExecutiveCards';
import { InvoicesListFiltersToolbar } from './components/InvoicesListFiltersToolbar';
import { InvoicesListPageHeader } from './components/InvoicesListPageHeader';
import { useInvoicesListScreen } from './useInvoicesListScreen';

export default function InvoicesListScreen() {
  const s = useInvoicesListScreen();

  return (
    <ScreenShell>
      <InvoicesListPageHeader
        t={s.t}
        dateFilter={s.dateFilter}
        companyId={s.companyId}
        exportBusy={s.exportBusy}
        displayedTotal={s.displayedTotal}
        onExportExcel={s.handleExportExcel}
        onPrintInvoices={s.handlePrintInvoices}
        onPrintCashReport={s.handlePrintCashReport}
        showExecSummaryActions={s.invoicesViewExecSummary}
      />

      {!s.companyId && (
        <div className="noorix-surface-card nx-empty-state">{s.t('pleaseSelectCompany')}</div>
      )}

      {s.editingInvoice && (
        <InvoiceEditModal
          invoice={s.editingInvoice}
          suppliers={s.suppliers}
          companyId={s.companyId}
          vaultsList={s.paymentVaults}
          onSaved={s.onInvoiceEditSaved}
          onClose={() => s.setEditingInvoice(null)}
        />
      )}
      {s.dayCloseOpen && (
        <DayCloseReportModal
          companyId={s.companyId}
          isOpen={s.dayCloseOpen}
          onClose={() => s.setDayCloseOpen(false)}
          defaultDateYmd={s.dayCloseDefaultYmd}
          compact
        />
      )}
      {s.cashReportOpen && (
        <InvoicesCashReportModal
          companyId={s.companyId}
          isOpen={s.cashReportOpen}
          onClose={() => s.setCashReportOpen(false)}
          invoiceQueryStartDate={s.invoiceQueryStartDate}
          invoiceQueryEndDate={s.invoiceQueryEndDate}
          dateFilterLabel={s.dateFilterLabel}
          fromUrl={s.fromUrl}
          toUrl={s.toUrl}
          vaultsList={s.vaultsList}
          companyName={s.companyName}
          lang={s.lang}
          t={s.t}
          fmt={s.fmt}
        />
      )}
      <ImportExportModal
        isOpen={s.showImportExport}
        onClose={() => s.setShowImportExport(false)}
        entityType="invoices"
        companyId={s.companyId}
        exportFetcher={s.importExportExportFetcher}
        onImportSuccess={s.onImportInvoicesSuccess}
      />

      {s.companyId && (
        <>
          {s.invoicesViewExecSummary && (
            <InvoicesListExecutiveCards
              t={s.t}
              serverInflow={s.serverInflow}
              serverOutflow={s.serverOutflow}
              inflowByVault={s.inflowByVault}
              outflowSummary={s.outflowSummary}
              vaultRowLabel={s.vaultRowLabel}
              isRefreshing={s.isFetching && !s.isLoading && s.isPlaceholderData}
            />
          )}
          <InvoicesListFiltersToolbar
            t={s.t}
            lang={s.lang}
            urlExtra={s.urlExtra}
            setUrlExtra={s.setUrlExtra}
            setPage={s.setPage}
            setDayCloseOpen={s.setDayCloseOpen}
            setShowImportExport={s.setShowImportExport}
            filterHasNotesOnly={s.filterHasNotesOnly}
            setFilterHasNotesOnly={s.setFilterHasNotesOnly}
            showCancelled={s.showCancelled}
            setShowCancelled={s.setShowCancelled}
            filterKind={s.filterKind}
            setFilterKind={s.setFilterKind}
            filterSupplierId={s.filterSupplierId}
            setFilterSupplierId={s.setFilterSupplierId}
            filterSupplierCategoryId={s.filterSupplierCategoryId}
            setFilterSupplierCategoryId={s.setFilterSupplierCategoryId}
            filterCreatedByUserId={s.filterCreatedByUserId}
            setFilterCreatedByUserId={s.setFilterCreatedByUserId}
            filterVaultId={s.filterVaultId}
            setFilterVaultId={s.setFilterVaultId}
            suppliers={s.suppliers}
            supplierCategories={s.supplierCategories}
            creatorUsersForFilter={s.creatorUsersForFilter}
            vaultsList={s.vaultsList}
            showSaleKindFilter={s.canFilterSaleInvoices}
          />
          {s.viewingInvoice && (
            <InvoiceViewModal
              invoice={s.viewingInvoice}
              companyId={s.companyId}
              showToast={s.showToast}
              onClose={() => s.setViewingInvoice(null)}
              t={s.t}
              lang={s.lang}
              fmt={s.fmt}
            />
          )}
          <SmartTable
            compact
            showRowNumbers
            tableLayout="fixed"
            innerPadding={8}
            tableId="invoices-list"
            frameClassName="noorix-invoices-table-frame"
            getRowClassName={(row: any) => (row.status === 'cancelled' ? 'noorix-row-cancelled' : '')}
            columns={s.columns}
            data={s.tableData}
            total={s.displayedTotal}
            page={s.page}
            pageSize={s.PAGE_SIZE}
            onPageChange={s.setPage}
            isLoading={s.isLoading}
            isError={s.isError}
            errorMessage={s.error?.message || s.t('loadInvoicesFailed')}
            footerRow={s.footerRow}
            title={s.t('invoicesTitle')}
            badge={
              <>
                <span className="nx-cell-muted-sm">— {s.dateFilter.label}</span>
                <span className="nx-pill nx-pill--blue nx-pill--sm">{s.t('invoiceCount', s.displayedTotal)}</span>
              </>
            }
            searchValue={s.searchText}
            onSearchChange={s.setSearchText}
            sortKey={s.sortKey}
            sortDir={s.sortDir}
            onSort={s.toggleSort}
            emptyMessage={s.t('noInvoicesInPeriod')}
            renderCompactRow={s.renderCompactRow}
            renderMobileCard={s.renderMobileCard}
            stripeMobileCards
          />
        </>
      )}
    </ScreenShell>
  );
}
