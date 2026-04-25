import React from 'react';
import { Button } from '../../../ui';
import DateFilterBar from '../../../shared/components/DateFilterBar';

/**
 * عنوان الشاشة + فلتر التاريخ + تصدير/طباعة — مستخرج من InvoicesListScreen
 */
export function InvoicesListPageHeader({
  t,
  dateFilter,
  companyId,
  exportBusy,
  displayedTotal,
  onExportExcel,
  onPrintInvoices,
}) {
  return (
    <>
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('invoicesTitle')}</h1>
      </div>

      <div className="noorix-print-hide nx-page-header nx-page-header--filter-row">
        <DateFilterBar filter={dateFilter} />
        {companyId && (
          <div className="nx-toolbar">
            <Button
              type="button"
              size="sm"
              onClick={onExportExcel}
              disabled={exportBusy || displayedTotal === 0}
            >
              {exportBusy ? '…' : t('exportExcel')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onPrintInvoices}
              disabled={exportBusy || displayedTotal === 0}
            >
              {t('print')}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
