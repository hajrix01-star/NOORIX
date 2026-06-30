import React from 'react';
import { Button } from '../../../ui';
import DateFilterBar from '../../../shared/components/DateFilterBar';
import FilterToolbar from '../../../shared/components/FilterToolbar';

export function InvoicesListPageHeader({
  t,
  dateFilter,
  companyId,
  exportBusy,
  displayedTotal,
  onExportExcel,
  onPrintInvoices,
  onPrintCashReport,
  showExecSummaryActions = true,
}: any) {
  return (
    <>
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('invoicesTitle')}</h1>
      </div>

      <FilterToolbar
        className="nx-page-header nx-page-header--filter-row"
        actions={companyId && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={onExportExcel}
              disabled={exportBusy || displayedTotal === 0}
            >
              {exportBusy ? '...' : t('exportExcel')}
            </Button>
            {showExecSummaryActions && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={onPrintCashReport}
                disabled={exportBusy}
              >
                {t('invoicesCashReportBtn')}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onPrintInvoices}
              disabled={exportBusy || displayedTotal === 0}
            >
              {t('print')}
            </Button>
          </>
        )}
      >
        <DateFilterBar filter={dateFilter} />
      </FilterToolbar>
    </>
  );
}
