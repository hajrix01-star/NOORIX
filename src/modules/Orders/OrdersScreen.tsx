/**
 * OrdersScreen — يعرض واجهة الموظف أو المدير حسب الصلاحية
 *
 * STAFF_ORDERS_SUBMIT فقط (بدون VIEW_ORDERS) → StaffOrdersView (جوال مبسّط)
 * VIEW_ORDERS → واجهة المدير الكاملة + تبويب «طلبات الأقسام» إن كان STAFF_ORDERS_DIGEST
 */
import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { PERMISSIONS } from '../../constants/permissions';
import { ScreenShell, ScreenTitle, ScreenTabs } from '../../ui';
import { OrdersTab } from './components/OrdersTab';
import { ItemsReportTab } from './components/ItemsReportTab';
import { ItemsManageTab } from './components/ItemsManageTab';
import { StaffDigestTab } from './components/StaffDigestTab';
import { StaffOrdersView } from './StaffOrdersView';

function parseYearMonth(dateStr: any) {
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

  const role = String(userRole || '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'super_admin';

  const canViewOrders = isAdmin || userPermissions.includes(PERMISSIONS.VIEW_ORDERS);
  const canSubmitStaff = isAdmin || userPermissions.includes(PERMISSIONS.STAFF_ORDERS_SUBMIT);
  const canDigest = isAdmin || userPermissions.includes(PERMISSIONS.STAFF_ORDERS_DIGEST);

  // الموظف البسيط — يرى واجهة مبسّطة فقط
  if (!canViewOrders && canSubmitStaff) {
    return companyId
      ? <StaffOrdersView companyId={companyId} />
      : (
        <ScreenShell>
          <ScreenTitle>{t('ordersTitle')}</ScreenTitle>
          <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
        </ScreenShell>
      );
  }

  return <ManagerOrdersScreen
    companyId={companyId}
    dateFilter={dateFilter}
    canDigest={canDigest}
    canSubmitStaff={canSubmitStaff}
  />;
}

function ManagerOrdersScreen({ companyId, dateFilter, canDigest, canSubmitStaff }: any) {
  const { t } = useTranslation();

  const TAB_IDS = useMemo(() => {
    const ids = ['orders', 'items-report', 'items-manage'];
    if (canDigest) ids.push('staff-digest');
    return ids;
  }, [canDigest]);

  const [activeTab, setActiveTab] = useTabSearchParam(TAB_IDS, 'orders');

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
    const tabs = [
      { id: 'orders', label: t('ordersTab') },
      { id: 'items-report', label: t('ordersItemsReportTab') },
      { id: 'items-manage', label: t('ordersItemsManageTab') },
    ];
    if (canDigest) tabs.push({ id: 'staff-digest', label: t('staffDigestTab') });
    return tabs;
  }, [t, canDigest]);

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
          {activeTab === 'staff-digest' && canDigest && <StaffDigestTab companyId={companyId} />}
        </ScreenTabs>
      )}
    </ScreenShell>
  );
}
