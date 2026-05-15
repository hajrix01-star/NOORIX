/** Orders section: orders | product reports | product admin */
import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { ScreenShell, ScreenTitle, ScreenTabs } from '../../ui';
import { OrdersTab } from './components/OrdersTab';
import { ItemsReportTab } from './components/ItemsReportTab';
import { ItemsManageTab } from './components/ItemsManageTab';

function parseYearMonth(dateStr: any) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return Number.isFinite(y) && Number.isFinite(m) ? { year: y, month: m } : null;
}

const ORDER_TAB_IDS = ['orders', 'items-report', 'items-manage'];

export default function OrdersScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const [activeTab, setActiveTab] = useTabSearchParam(ORDER_TAB_IDS, 'orders');

  const { year, month, startDate, endDate } = useMemo(() => {
    const { mode, selYear, selMonth, selDay, rangeStart, rangeEnd } = dateFilter;
    if (mode === 'month') {
      return { year: selYear, month: selMonth, startDate: dateFilter.startDate, endDate: dateFilter.endDate };
    }
    if (mode === 'day' && selDay) {
      const pm = parseYearMonth(selDay);
      return pm ? { year: pm.year, month: pm.month, startDate: dateFilter.startDate, endDate: dateFilter.endDate } : { year: selYear, month: selMonth, startDate: dateFilter.startDate, endDate: dateFilter.endDate };
    }
    if (mode === 'range' && rangeStart) {
      const pm = parseYearMonth(rangeStart);
      return pm ? { year: pm.year, month: pm.month, startDate: dateFilter.startDate, endDate: dateFilter.endDate } : { year: selYear, month: selMonth, startDate: dateFilter.startDate, endDate: dateFilter.endDate };
    }
    return { year: selYear, month: selMonth, startDate: dateFilter.startDate, endDate: dateFilter.endDate };
  }, [dateFilter.mode, dateFilter.selYear, dateFilter.selMonth, dateFilter.selDay, dateFilter.rangeStart, dateFilter.rangeEnd, dateFilter.startDate, dateFilter.endDate]);

  const tabItems = useMemo(() => [
    { id: 'orders', label: t('ordersTab') },
    { id: 'items-report', label: t('ordersItemsReportTab') },
    { id: 'items-manage', label: t('ordersItemsManageTab') },
  ], [t]);

  return (
    <ScreenShell className="min-w-0">
      <div>
        <ScreenTitle>{t('ordersTitle')}</ScreenTitle>
      </div>

      {!companyId && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {companyId && (
        <ScreenTabs
          items={tabItems}
          value={activeTab}
          onChange={setActiveTab}
          contentClassName="nx-tab-content"
        >
          {activeTab === 'orders' && (
            <OrdersTab
              companyId={companyId}
              year={year}
              month={month}
              startDate={startDate}
              endDate={endDate}
              dateFilter={dateFilter}
            />
          )}
          {activeTab === 'items-report' && (
            <ItemsReportTab
              companyId={companyId}
              year={year}
              month={month}
              startDate={startDate}
              endDate={endDate}
              dateFilter={dateFilter}
            />
          )}
          {activeTab === 'items-manage' && <ItemsManageTab companyId={companyId} />}
        </ScreenTabs>
      )}
    </ScreenShell>
  );
}
