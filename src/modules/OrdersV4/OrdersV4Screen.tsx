import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { PERMISSIONS, hasPermission } from '../../constants/permissions';
import { DateFilterBar, ScreenShell, ScreenTabs, ScreenTitle, useDateFilter } from '../../ui';
import { getSaudiToday } from '../../utils/saudiDate';
import { OrdersV4CatalogTab } from './components/OrdersV4CatalogTab';
import { OrdersV4DocumentsTab } from './components/OrdersV4DocumentsTab';
import { OrdersV4InventoryTab } from './components/OrdersV4InventoryTab';
import { OrdersV4ItemsReportTab, OrdersV4SalesReportTab } from './components/OrdersV4ReportsTabs';
import { OrdersV4QueryState, ordersV4NavigationBarClassName, ordersV4NavigationTabClassName } from './OrdersV4Shared';
import { useOrdersV4Bootstrap } from './useOrdersV4';
import { resolveOrdersV4RegistrationPresentation } from './ordersV4RegistrationAccess.utils';

type TabId = 'requests' | 'registration' | 'reports' | 'catalog' | 'inventory';
type ReportTabId = 'items' | 'registration';
const REPORT_TAB_IDS: ReportTabId[] = ['items', 'registration'];

export default function OrdersV4Screen() {
  const { activeCompanyId, userRole, userPermissions, companies = [] } = useApp();
  const { lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const activeCompany = companies.find((company) => company.id === companyId);
  const companyName = activeCompany?.nameAr || activeCompany?.nameEn || '';
  const companyLogoUrl = String(activeCompany?.logoUrl || '');
  const dateFilter = useDateFilter();
  const bootstrapQuery = useOrdersV4Bootstrap(companyId);
  const [reportTab, setReportTab] = useTabSearchParam(REPORT_TAB_IDS, 'items', 'ordersV4ReportTab', null, undefined, { persistDefault: true });
  const isOwner = String(userRole || '').toLowerCase() === 'owner';
  const admin = ['owner', 'super_admin'].includes(String(userRole || '').toLowerCase());
  const can = (permission: string) => admin || hasPermission(userRole, permission, userPermissions);
  const canWrite = can(PERMISSIONS.ORDERS_V4_WRITE);
  const canDelete = can(PERMISSIONS.ORDERS_V4_DELETE);
  const canInventoryWrite = can(PERMISSIONS.ORDERS_V4_INVENTORY_WRITE);
  const canCreatePurchase = canWrite || can(PERMISSIONS.ORDERS_V4_STAFF_SUBMIT);
  const canCreateRegistration = canWrite || can(PERMISSIONS.ORDERS_V4_INTERNAL_SUBMIT);
  const canReceive = canWrite || can(PERMISSIONS.ORDERS_V4_CASHIER_RECEIVE);
  const canRead = can(PERMISSIONS.ORDERS_V4_READ) || canWrite;
  const canReport = canRead || can(PERMISSIONS.ORDERS_V4_REPORTS_READ);
  const registrationPresentation = useMemo(() => resolveOrdersV4RegistrationPresentation({
    canCreateRegistration,
    canReadAll: canRead,
    todayYmd: getSaudiToday(),
  }), [canCreateRegistration, canRead]);
  const isInternalRegistrationStaffView = registrationPresentation.staffLimited;
  const tabs = useMemo<Array<{ id: TabId; label: string }>>(() => {
    const result: Array<{ id: TabId; label: string }> = [];
    if (canRead || canCreatePurchase) result.push({ id: 'requests', label: lang === 'ar' ? 'الطلبات' : 'Requests' });
    if (canRead || canCreateRegistration) result.push({ id: 'registration', label: lang === 'ar' ? 'التسجيل الداخلي' : 'Internal registration' });
    if (canReport) result.push({ id: 'reports', label: lang === 'ar' ? 'التقارير' : 'Reports' });
    if (canWrite) result.push({ id: 'catalog', label: lang === 'ar' ? 'إدارة الأصناف' : 'Catalog' });
    if (canRead || canInventoryWrite) result.push({ id: 'inventory', label: lang === 'ar' ? 'المخزون والتكلفة' : 'Inventory & cost' });
    return result;
  }, [canCreatePurchase, canCreateRegistration, canInventoryWrite, canRead, canReport, canWrite, lang]);
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
  const [activeTab, setActiveTab] = useTabSearchParam(tabIds, tabIds[0] ?? 'requests', 'ordersV4Tab', 'tab', undefined, { persistDefault: true });

  return (
    <ScreenShell variant="data" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ScreenTitle>{lang === 'ar' ? 'طلبات V4' : 'Orders V4'}</ScreenTitle><span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-extrabold text-violet-700">CORE V4</span></div>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted">{lang === 'ar' ? 'قسم تشغيلي مستقل للطلبات والتسجيل الداخلي والمخزون والتكلفة والعهدة.' : 'Independent operational orders, internal registration, inventory, costing and custody.'}</p>
        </div>
        {!(activeTab === 'registration' && isInternalRegistrationStaffView) && (
          <DateFilterBar filter={dateFilter} modes={['all', 'day', 'month', 'range', 'quarter', 'year']} />
        )}
      </div>
      {!companyId && <div className="noorix-surface-card p-8 text-center text-noorix-muted">{lang === 'ar' ? 'اختر شركة للبدء' : 'Select a company to continue'}</div>}
      {companyId && tabs.length === 0 && <div className="noorix-surface-card p-8 text-center text-red-700">{lang === 'ar' ? 'لا توجد صلاحية لدخول طلبات V4' : 'No Orders V4 permission'}</div>}
      {companyId && tabs.length > 0 && (
        <ScreenTabs
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
          variant="segmented"
          segmentedFlat
          barClassName={ordersV4NavigationBarClassName}
          getTabClassName={ordersV4NavigationTabClassName}
          contentClassName="min-h-[260px] px-1 py-3 sm:px-3"
        >
          <OrdersV4QueryState loading={bootstrapQuery.isLoading} error={bootstrapQuery.error as Error | null} />
          {!bootstrapQuery.isLoading && activeTab === 'requests' && <OrdersV4DocumentsTab companyId={companyId} documentType="purchase" startDate={dateFilter.startDate} endDate={dateFilter.endDate} bootstrap={bootstrapQuery.data} canReport={canReport} canCreate={canCreatePurchase} canReverse={canDelete} canUndoReverse={isOwner} canReceive={canReceive} companyName={companyName} companyLogoUrl={companyLogoUrl} />}
          {!bootstrapQuery.isLoading && activeTab === 'registration' && <OrdersV4DocumentsTab companyId={companyId} documentType="registration" startDate={isInternalRegistrationStaffView ? registrationPresentation.startDate : dateFilter.startDate} endDate={isInternalRegistrationStaffView ? registrationPresentation.endDate : dateFilter.endDate} bootstrap={bootstrapQuery.data} canReport={canReport} canCreate={canCreateRegistration} canReverse={canDelete} canUndoReverse={isOwner} showOverviewCards={!isInternalRegistrationStaffView} historyWindowDays={isInternalRegistrationStaffView ? 7 : undefined} companyName={companyName} companyLogoUrl={companyLogoUrl} />}
          {!bootstrapQuery.isLoading && activeTab === 'reports' && <ScreenTabs items={[{ id: 'items', label: lang === 'ar' ? 'تقارير الأصناف' : 'Item reports' }, { id: 'registration', label: lang === 'ar' ? 'تقرير داخلي' : 'Internal report' }]} value={reportTab} onChange={(id) => setReportTab(id as ReportTabId)} variant="segmented" segmentedFlat barClassName={ordersV4NavigationBarClassName} getTabClassName={ordersV4NavigationTabClassName} contentClassName="pt-3">{reportTab === 'items' ? <OrdersV4ItemsReportTab companyId={companyId} startDate={dateFilter.startDate} endDate={dateFilter.endDate} /> : <OrdersV4SalesReportTab companyId={companyId} startDate={dateFilter.startDate} endDate={dateFilter.endDate} />}</ScreenTabs>}
          {!bootstrapQuery.isLoading && activeTab === 'catalog' && <OrdersV4CatalogTab companyId={companyId} bootstrap={bootstrapQuery.data} canDelete={canDelete} />}
          {!bootstrapQuery.isLoading && activeTab === 'inventory' && <OrdersV4InventoryTab companyId={companyId} bootstrap={bootstrapQuery.data} canWrite={canInventoryWrite} canCutover={canDelete} />}
        </ScreenTabs>
      )}
    </ScreenShell>
  );
}
