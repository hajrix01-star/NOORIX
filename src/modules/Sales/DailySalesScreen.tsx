/**
 * DailySalesScreen — ???? ???????? ??????
 * ????? ???: useDailySalesScreen + SmartTable + utils/saudiDate, utils/format
 * ????: ????? Excel? PDF? ????? ???????? (??? ?????? + ????)
 */
import React, { useMemo, useCallback } from 'react';
import { formatSaudiDate } from '../../utils/saudiDate';
import { Badge, Button, FilterToolbar, ScreenShell, FmtNum, KebabMenu, SmartTable } from '../../ui';
import type { SmartTableColumn } from '../../ui/SmartTable/types';
import { DateFilterBar } from '../../ui/date';
import { SalesActionsCell } from '../../components/common/SalesActionsCell';
import { SalesDayEditModal } from './components/SalesDayEditModal';
import { SalesEntryModal } from './components/SalesEntryModal';
import { DailySalesChannelsChips } from './components/DailySalesChannelsChips';
import { SalesShiftPicker } from './components/SalesShiftPicker';
import { SalesDailyWhatsAppReportBar } from './components/SalesDailyWhatsAppReportBar';
import ImportExportModal from '../../components/ImportExportModal';
import { useDailySalesScreen } from './hooks/useDailySalesScreen';
import type { DailySalesTableRow } from './hooks/useDailySalesScreen';
import { getSalesShiftLabel } from './constants/salesShift';

export default function DailySalesScreen() {
  const {
    PAGE_SIZE,
    t,
    lang,
    userRole,
    companyId,
    companyName,
    hasCompany,
    salesFullHistory,
    salesViewSummariesList,
    dateFilter,
    showEntryModal,
    setShowEntryModal,
    editingSummary,
    setEditingSummary,
    listPage,
    setListPage,
    searchInput,
    setSearchInput,
    sortKey,
    sortDir,
    toggleSort,
    exportBusy,
    showImportExport,
    setShowImportExport,
    showCancelledSales,
    setShowCancelledSales,
    selectedShift,
    setSelectedShift,
    salesChannels,
    salesChannelsLoading,
    salesChannelsHasError,
    salesChannelsErrorMessage,
    refetchSalesChannels,
    createSummary,
    createSummaryBatch,
    summariesLoading,
    summariesError,
    vatEnabled,
    vatRate,
    openWhatsApp,
    handleEditSave,
    handleDeleteSummary,
    STATUS_MAP,
    tableData,
    activeRowCount,
    displayedTotal,
    totalAmountSum,
    totalCustomers,
    avgPerCustomer,
    handleExportExcel,
    handleExportPdf,
    handlePrint,
    importExportFetcher,
    handleImportSuccess,
    showToast,
  } = useDailySalesScreen();

  const columns = useMemo(() => [
    { key: 'summaryNumber', kind: 'id', label: t('summaryNumber'), sortable: true, width: '12ch',
      render: (_: unknown, row: DailySalesTableRow) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="nx-cell-num nx-cell-accent">{row.summaryNumbersText || row.summaryNumber}</span>
          {row.summaries.length > 1 ? <span className="nx-cell-muted-sm">{row.summaries.length} ???</span> : null}
        </div>
      ) },
    { key: 'transactionDate', kind: 'date', label: t('transactionDate'), sortable: true, width: '13ch',
      render: (v: unknown, row: DailySalesTableRow) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="nx-cell-muted-sm">{formatSaudiDate(v as string)}</span>
          <span className="inline-flex items-center rounded-md bg-noorix-bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-noorix-muted">
            {row.shiftsText || getSalesShiftLabel(row.shift, t)}
          </span>
        </div>
      ) },
    { key: 'channelsText', kind: 'text', label: t('salesChannels'), sortable: false, width: '38%',
      render: (_: unknown, row: DailySalesTableRow) => <DailySalesChannelsChips channels={row.channels} lang={lang} /> },
    { key: 'customerCount', kind: 'number', label: t('customers'), numeric: true, sortable: true, width: '8ch',
      render: (v: unknown) => <span className="nx-cell-num nx-cell-num--blue">{(v as number) ?? 0}</span> },
    { key: 'totalAmount', kind: 'money', label: t('total'), numeric: true, sortable: true, width: '12ch',
      render: (v: unknown) => <FmtNum n={Number(v)} className="nx-cell-num nx-cell-num--green nx-cell-bold" /> },
    { key: 'avgPerCustomer', kind: 'money', label: t('avgPerOrder'), numeric: true, sortable: false, width: '12ch',
      render: (v: unknown) => <FmtNum n={Number(v)} className="nx-cell-num nx-cell-num--violet" /> },
    { key: 'status', kind: 'status', label: t('statusLabel'), width: '9ch',
      render: (v: unknown) => <Badge {...Badge.fromStatus(v as string, STATUS_MAP)} size="sm" /> },
    { key: 'actions', kind: 'actions', label: t('actions'), align: 'center', width: '48px',
      render: (_: unknown, row: DailySalesTableRow) => (
        <SalesActionsCell
          summary={row}
          userRole={userRole}
          onPrint={openWhatsApp}
          onEdit={setEditingSummary}
          onDelete={handleDeleteSummary}
        />
      ),
    },
  ] as SmartTableColumn[], [userRole, t, STATUS_MAP, handleDeleteSummary, lang, openWhatsApp, setEditingSummary]);

  const footerCells = (
    <>
      <td />
      <td colSpan={3} className="nx-tfoot-label">
        {t('totalSummaries', activeRowCount)}
        {displayedTotal > PAGE_SIZE ? (
          <span className="nx-cell-muted-sm me-1.5"> (?????? ?????? ???????)</span>
        ) : null}
      </td>
      <td className="nx-tfoot-num nx-cell-num--blue">{totalCustomers.toLocaleString('en')}</td>
      <td className="nx-tfoot-num nx-cell-num--green"><FmtNum n={totalAmountSum} /></td>
      <td className="nx-tfoot-num nx-cell-num--violet"><FmtNum n={avgPerCustomer} /></td>
      <td colSpan={2} />
    </>
  );

  const renderMobileCard = useCallback((row: DailySalesTableRow) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-noorix-blue ltr">#{row.summaryNumbersText || row.summaryNumber}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.transactionDate)}</span>
          <span className="rounded-md bg-noorix-bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-noorix-muted">
            {row.shiftsText || getSalesShiftLabel(row.shift, t)}
          </span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
      </div>
      <div className="rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/40 p-2">
        <div className="text-[11px] font-bold text-noorix-muted mb-1.5">{t('salesChannels')}</div>
        <DailySalesChannelsChips channels={row.channels} lang={lang} />
      </div>
      <div className="nx-mc__grid nx-mc__grid--3 mt-1">
        <div>
          <div className="nx-mc__stat-label">{t('total')}</div>
          <div className="nx-mc__stat-value text-[13px] font-bold text-noorix-green"><FmtNum n={Number(row.totalAmount)} /></div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('customers')}</div>
          <div className="nx-mc__stat-value text-[13px] font-bold text-noorix-blue">{row.customerCount ?? 0}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('avgPerOrder')}</div>
          <div className="nx-mc__stat-value text-[13px] font-bold text-noorix-violet"><FmtNum n={row.avgPerCustomer} /></div>
        </div>
      </div>
      <div className="flex justify-end mt-1">
        <SalesActionsCell summary={row} userRole={userRole} onPrint={openWhatsApp} onEdit={setEditingSummary} onDelete={handleDeleteSummary} />
      </div>
    </div>
  ), [STATUS_MAP, userRole, t, handleDeleteSummary, lang, openWhatsApp, setEditingSummary]);

  const renderCompactRow = useCallback((row: DailySalesTableRow) => (
    <div className="cursor-pointer" onClick={() => setEditingSummary(row)}>
      <div className="nx-cr__line1">
        <span className="nx-cr__id">#{row.summaryNumbersText || row.summaryNumber}</span>
        <span className="nx-cr__meta">{formatSaudiDate(row.transactionDate)}</span>
        <span className="nx-cr__meta">{row.shiftsText || getSalesShiftLabel(row.shift, t)}</span>
        <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
      </div>
      <div className="nx-cr__line2">
        <div className="nx-cr__line2-start">
          <span className="nx-cr__meta">{row.customerCount ?? 0} {t('customers')}</span>
        </div>
        <div className="nx-cr__line2-end">
          <span className="nx-cr__amount text-noorix-green"><FmtNum n={Number(row.totalAmount)} /> <span className="nx-sar">SR</span></span>
          <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
            <KebabMenu
              ariaLabel={t('actions')}
              items={[
                { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => setEditingSummary(row) },
                ...(row.status !== 'cancelled' ? [{ key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => handleDeleteSummary(row) }] : []),
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  ), [STATUS_MAP, t, handleDeleteSummary, setEditingSummary]);

  return (
    <ScreenShell>
      {editingSummary && (
        <SalesDayEditModal
          day={editingSummary}
          salesChannels={salesChannels}
          salesChannelsLoading={salesChannelsLoading}
          salesChannelsError={salesChannelsErrorMessage}
          vatEnabled={vatEnabled}
          vatRate={vatRate}
          onSaved={handleEditSave}
          onClose={() => setEditingSummary(null)}
        />
      )}

      {showEntryModal && hasCompany && (
        <SalesEntryModal
          companyId={companyId}
          companyName={companyName}
          salesChannels={salesChannels}
          salesChannelsLoading={salesChannelsLoading}
          salesChannelsError={salesChannelsErrorMessage}
          vatEnabled={vatEnabled}
          vatRate={vatRate}
          createSummary={createSummary}
          createSummaryBatch={createSummaryBatch}
          onSuccess={(payload) => {
            const summary = Array.isArray(payload) ? payload[0] : payload;
            showToast(`${t('summarySaved')} — ${t('summaryNumber')}: ${summary?.summaryNumber || ''}`, 'success');
          }}
          onError={(msg: string) => showToast(msg || t('saveFailed'), 'error')}
          onClose={() => setShowEntryModal(false)}
          onWhatsApp={(summary) => {
            if (summary.id) openWhatsApp(summary as Parameters<typeof openWhatsApp>[0]);
          }}
          autoCloseOnSuccess={false}
        />
      )}

      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        entityType="sales"
        companyId={companyId}
        exportFetcher={importExportFetcher}
        onImportSuccess={handleImportSuccess}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('salesDailySummary')}</h1>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {hasCompany && salesViewSummariesList && (
            <SalesShiftPicker mode="filter" value={selectedShift} onChange={setSelectedShift} />
          )}
          {hasCompany && salesViewSummariesList && (
            <Button
              size="sm"
              variant={showCancelledSales ? 'primary' : 'default'}
              aria-pressed={showCancelledSales}
              onClick={() => setShowCancelledSales((v) => !v)}
            >
              {showCancelledSales ? t('hideCancelledSummaries') : t('showCancelledSummaries')}
            </Button>
          )}
          {salesFullHistory && (
            <Button
              size="sm"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
              onClick={() => setShowImportExport(true)}
              disabled={!hasCompany}
            >
              ??????? / ?????
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowEntryModal(true)} disabled={!hasCompany}>
            {t('addDailySummary')}
          </Button>
        </div>
      </div>

      {hasCompany && salesChannelsHasError && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-noorix-red">
          <span className="flex-1">{salesChannelsErrorMessage}</span>
          <Button size="sm" onClick={() => void refetchSalesChannels()}>{t('retryLoadSalesChannels')}</Button>
        </div>
      )}

      {salesFullHistory && (
        <FilterToolbar>
          <DateFilterBar filter={dateFilter} />
        </FilterToolbar>
      )}

      {hasCompany && salesViewSummariesList && (
        <SalesDailyWhatsAppReportBar
          companyId={companyId}
          companyName={companyName}
          disabled={!hasCompany}
        />
      )}

      {!hasCompany && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {hasCompany && !salesViewSummariesList && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('salesSummariesHiddenByRole')}
        </div>
      )}
      {hasCompany && salesViewSummariesList && (
        <SmartTable
          columns={columns}
          data={tableData}
          total={displayedTotal}
          page={listPage}
          pageSize={PAGE_SIZE}
          onPageChange={setListPage}
          isLoading={summariesLoading}
          isError={!!summariesError}
          errorMessage={summariesError?.message || ''}
          footerCells={footerCells}
          title={t('previousSummaries')}
          showRowNumbers
          badge={
            <>
              <span className="text-[12px] text-noorix-muted">— {dateFilter.label}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-noorix-blue text-[12px] font-semibold">
                {t('summaryCount', displayedTotal)}
              </span>
              {salesFullHistory && (
                <span className="flex flex-wrap gap-1.5 print:hidden">
                  <Button size="sm" onClick={handleExportExcel} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : t('exportExcel')}</Button>
                  <Button size="sm" onClick={handleExportPdf} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : '????? / PDF'}</Button>
                  <Button size="sm" onClick={handlePrint} disabled={displayedTotal === 0 || exportBusy}>{exportBusy ? '…' : t('print')}</Button>
                </span>
              )}
            </>
          }
          searchValue={salesFullHistory ? searchInput : undefined}
          onSearchChange={salesFullHistory ? setSearchInput : undefined}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyMessage={t('noSummariesInPeriod')}
          renderCompactRow={renderCompactRow}
          renderMobileCard={renderMobileCard}
        />
      )}
    </ScreenShell>
  );
}
