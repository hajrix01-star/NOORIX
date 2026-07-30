/**
 * OrdersScreen — يعرض واجهة الموظف أو المدير حسب الصلاحية
 *
 * STAFF_ORDERS_SUBMIT (بدون ORDERS_MANAGER_DATA_ACCESS) → StaffOrdersView
 * ORDERS_MANAGER_DATA_ACCESS → واجهة المدير الكاملة
 */
import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../ui/date';
import { ScreenShell, ScreenTitle, ScreenTabs } from '../../ui';
import { OrdersTab } from './components/OrdersTab';
import { ItemsReportTab } from './components/ItemsReportTab';
import { ItemsManageTab } from './components/ItemsManageTab';
import { SalesReportTab } from './components/SalesReportTab';
import { ShishaInventoryTab } from './components/ShishaInventoryTab';
import { StaffOrdersView } from './StaffOrdersView';
import { resolveOrdersScreenMode } from './ordersScreenRouting';

const ORDERS_TAB_ALIASES = { sales: 'sales-report' } as const;
type OrdersTabDescriptor = { id: string; labelKey: string; shortLabelKey?: string };

function parseYearMonth(dateStr: unknown) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return Number.isFinite(y) && Number.isFinite(m) ? { year: y, month: m } : null;
}

export default function OrdersScreen() {
  const { activeCompanyId, userRole, userPermissions } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();

  const routing = resolveOrdersScreenMode(userRole, userPermissions);

  if (routing.mode === 'staff') {
    return companyId
      ? <StaffOrdersView companyId={companyId} />
      : (
        <ScreenShell variant="data">
          <ScreenTitle>{t('ordersTitle')}</ScreenTitle>
          <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
        </ScreenShell>
      );
  }

  if (routing.mode === 'forbidden') {
    return (
      <ScreenShell variant="data">
        <ScreenTitle>{t('ordersTitle')}</ScreenTitle>
        <div className="noorix-surface-card nx-empty-state flex flex-col gap-2 text-center py-10">
          <div className="text-[16px] font-bold text-noorix-text">{t('forbidden403Title')}</div>
          <div className="text-[13px] text-noorix-muted">{t('forbidden403Desc')}</div>
        </div>
      </ScreenShell>
    );
  }

  return <ManagerOrdersScreen
    companyId={companyId}
    dateFilter={dateFilter}
    canSubmitStaff={routing.canSubmitStaff}
    canViewSalesReport={routing.canViewSalesReport}
    prefersStaffSalesTab={routing.prefersStaffSalesTab}
  />;
}

function ManagerOrdersScreen({
  companyId,
  dateFilter,
  canSubmitStaff,
  canViewSalesReport,
  prefersStaffSalesTab,
}: {
  companyId: string;
  dateFilter: ReturnType<typeof useDateFilter>;
  canSubmitStaff: boolean;
  canViewSalesReport: boolean;
  prefersStaffSalesTab: boolean;
}) {
  const { t } = useTranslation();

  const TAB_IDS = useMemo(() => {
    const ids: string[] = [];
    if (canSubmitStaff) ids.push('staff-sales');
    ids.push('orders', 'items-report', 'items-manage', 'shisha-inventory');
    if (canViewSalesReport) ids.push('sales-report');
    return ids;
  }, [canViewSalesReport, canSubmitStaff]);

  const defaultTab =
    prefersStaffSalesTab && canSubmitStaff && TAB_IDS.includes('staff-sales')
      ? 'staff-sales'
      : (TAB_IDS[0] ?? 'orders');
  const [activeTab, setActiveTab] = useTabSearchParam(
    TAB_IDS,
    defaultTab,
    'ordersTab',
    'tab',
    ORDERS_TAB_ALIASES,
    { persistDefault: true },
  );

  const { year, month, startDate, endDate } = useMemo(() => {
    const { mode, selYear, selMonth, selDay, rangeStart } = dateFilter;
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

  const tabItems = useMemo(() => {
    const tabs: Array<{ id: string; labelKey: string; shortLabelKey?: string }> = [];
    if (canSubmitStaff) {
      tabs.push({ id: 'staff-sales', labelKey: 'staffSalesRecordTab', shortLabelKey: 'staffSalesRecordTabShort' });
    }
    tabs.push(
      { id: 'orders', labelKey: 'ordersTab', shortLabelKey: 'ordersTabShort' },
      { id: 'items-report', labelKey: 'ordersItemsReportTab', shortLabelKey: 'ordersItemsReportTabShort' },
      { id: 'items-manage', labelKey: 'ordersItemsManageTab', shortLabelKey: 'ordersItemsManageTabShort' },
      { id: 'shisha-inventory', labelKey: 'shishaInventoryTab', shortLabelKey: 'shishaInventoryTabShort' },
    );
    if (canViewSalesReport) {
      tabs.push({ id: 'sales-report', labelKey: 'salesReportTab', shortLabelKey: 'salesReportTabShort' });
    }
    return tabs.map((tab) => {
      const full = t(tab.labelKey);
      const short = tab.shortLabelKey ? t(tab.shortLabelKey) : full;
      const label =
        short === full ? (
          full
        ) : (
          <>
            <span className="hidden sm:inline">{full}</span>
            <span className="sm:hidden">{short}</span>
          </>
        );
      return { id: tab.id, label };
    });
  }, [t, canViewSalesReport, canSubmitStaff]);

  return (
    <ScreenShell variant="data" className="min-w-0">
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
          shellClassName="nx-orders-tabs-shell"
          contentClassName="nx-tab-content nx-orders-tab-content min-h-[200px] px-1 py-2 sm:px-3 sm:py-3"
        >
          {activeTab === 'staff-sales' && canSubmitStaff && (
            <StaffOrdersView companyId={companyId} embedded salesOnly />
          )}
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
          {activeTab === 'shisha-inventory' && (
            <ShishaInventoryTab
              companyId={companyId}
              startDate={startDate}
              endDate={endDate}
              dateFilter={dateFilter}
            />
          )}
          {activeTab === 'sales-report' && canViewSalesReport && (
            <SalesReportTab companyId={companyId} dateFilter={dateFilter} />
          )}
        </ScreenTabs>
      )}
    </ScreenShell>
  );
}
