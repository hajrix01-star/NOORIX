/**
 * InvoicesListScreen — قائمة الفواتير (عرض فقط؛ المنطق في useInvoicesListScreen)
 */
import React from 'react';
import { ScreenShell, SmartTable } from '../../ui';
import { InvoiceEditModal } from './components/InvoiceEditModal';
import ImportExportModal from '../../components/ImportExportModal';
import DayCloseReportModal from './components/DayCloseReportModal';
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
        />
      )}
      {s.dayCloseOpenV2 && (
        <DayCloseReportModal
          companyId={s.companyId}
          isOpen={s.dayCloseOpenV2}
          onClose={() => s.setDayCloseOpenV2(false)}
          defaultDateYmd={s.dayCloseDefaultYmd}
          compact
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
          <InvoicesListExecutiveCards
            t={s.t}
            serverInflow={s.serverInflow}
            serverOutflow={s.serverOutflow}
            inflowByVault={s.inflowByVault}
            outflowSummary={s.outflowSummary}
            vaultRowLabel={s.vaultRowLabel}
          />
          <InvoicesListFiltersToolbar
            t={s.t}
            lang={s.lang}
            urlExtra={s.urlExtra}
            setUrlExtra={s.setUrlExtra}
            setPage={s.setPage}
            setDayCloseOpen={s.setDayCloseOpen}
            setDayCloseOpenV2={s.setDayCloseOpenV2}
            setShowImportExport={s.setShowImportExport}
            filterHasNotesOnly={s.filterHasNotesOnly}
            setFilterHasNotesOnly={s.setFilterHasNotesOnly}
            showCancelled={s.showCancelled}
            setShowCancelled={s.setShowCancelled}
            filterKind={s.filterKind}
            setFilterKind={s.setFilterKind}
            filterSupplierId={s.filterSupplierId}
            setFilterSupplierId={s.setFilterSupplierId}
            filterCreatedByUserId={s.filterCreatedByUserId}
            setFilterCreatedByUserId={s.setFilterCreatedByUserId}
            filterVaultId={s.filterVaultId}
            setFilterVaultId={s.setFilterVaultId}
            suppliers={s.suppliers}
            creatorUsersForFilter={s.creatorUsersForFilter}
            vaultsList={s.vaultsList}
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
            renderMobileCard={s.renderMobileCard}
            stripeMobileCards
          />
        </>
      )}
    </ScreenShell>
  );
}
