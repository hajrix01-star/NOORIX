import React from 'react';
import { Button, FilterToolbar } from '../../../ui';
import { DateFilterBar, type DateFilterController } from '../../../ui/date';

type Translate = (key: string, ...args: unknown[]) => string;

export type InvoicesListPageHeaderProps = {
  t: Translate;
  dateFilter: DateFilterController;
  companyId: string;
  exportBusy: boolean;
  displayedTotal: number;
  onExportExcel: () => void;
  onPrintInvoices: () => void;
  onPrintCashReport: () => void;
  showExecSummaryActions?: boolean;
};

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
}: InvoicesListPageHeaderProps) {
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
