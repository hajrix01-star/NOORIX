import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { PERMISSIONS, hasPermission } from '../../constants/permissions';
import { DateFilterBar, ScreenShell, ScreenTabs, ScreenTitle, useDateFilter } from '../../ui';
import { OrdersV3CatalogTab } from './components/OrdersV3CatalogTab';
import { OrdersV3DocumentsTab } from './components/OrdersV3DocumentsTab';
import { OrdersV3InventoryTab } from './components/OrdersV3InventoryTab';
import { OrdersV3ItemsReportTab, OrdersV3SalesReportTab } from './components/OrdersV3ReportsTabs';
import { OrdersV3QueryState } from './OrdersV3Shared';
import { useOrdersV3Bootstrap } from './useOrdersV3';

type TabId = 'requests' | 'registration' | 'items-report' | 'sales-report' | 'catalog' | 'inventory';

export default function OrdersV3Screen() {
  const { activeCompanyId, userRole, userPermissions } = useApp();
  const { lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const bootstrapQuery = useOrdersV3Bootstrap(companyId);
  const admin = ['owner', 'super_admin'].includes(String(userRole || '').toLowerCase());
  const can = (permission: string) => admin || hasPermission(userRole, permission, userPermissions);
  const canWrite = can(PERMISSIONS.ORDERS_V3_WRITE);
  const canDelete = can(PERMISSIONS.ORDERS_V3_DELETE);
  const canInventoryWrite = can(PERMISSIONS.ORDERS_V3_INVENTORY_WRITE);
  const canCreatePurchase = canWrite || can(PERMISSIONS.ORDERS_V3_STAFF_SUBMIT);
  const canCreateRegistration = canWrite || can(PERMISSIONS.ORDERS_V3_INTERNAL_SUBMIT);
  const canRead = can(PERMISSIONS.ORDERS_V3_READ) || canWrite;
  const canReport = canRead || can(PERMISSIONS.ORDERS_V3_REPORTS_READ);
  const tabs = useMemo<Array<{ id: TabId; label: string }>>(() => {
    const result: Array<{ id: TabId; label: string }> = [];
    if (canRead || canCreatePurchase) result.push({ id: 'requests', label: lang === 'ar' ? 'الطلبات' : 'Requests' });
    if (canRead || canCreateRegistration) result.push({ id: 'registration', label: lang === 'ar' ? 'التسجيل الداخلي' : 'Internal registration' });
    if (canReport) result.push({ id: 'items-report', label: lang === 'ar' ? 'تقرير الأصناف' : 'Item report' }, { id: 'sales-report', label: lang === 'ar' ? 'تقرير المبيعات' : 'Sales report' });
    if (canWrite) result.push({ id: 'catalog', label: lang === 'ar' ? 'إدارة الأصناف' : 'Catalog' });
    if (canRead || canInventoryWrite) result.push({ id: 'inventory', label: lang === 'ar' ? 'المخزون والتكلفة' : 'Inventory & cost' });
    return result;
  }, [canCreatePurchase, canCreateRegistration, canInventoryWrite, canRead, canReport, canWrite, lang]);
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
  const [activeTab, setActiveTab] = useTabSearchParam(tabIds, tabIds[0] ?? 'requests', 'ordersV3Tab', 'tab', undefined, { persistDefault: true });

  return (
    <ScreenShell variant="data" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ScreenTitle>{lang === 'ar' ? 'طلبات 2' : 'Orders 2'}</ScreenTitle><span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-extrabold text-violet-700">CORE V3</span></div>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted">{lang === 'ar' ? 'نواة مستقلة للتحويلات والحسابات والمخزون — لا تعتمد على قسم الطلبات القديم.' : 'Independent conversion, calculation and inventory kernel with no legacy Orders dependency.'}</p>
        </div>
        <DateFilterBar filter={dateFilter} modes={['month', 'range', 'quarter', 'year']} />
      </div>
      {!companyId && <div className="noorix-surface-card p-8 text-center text-noorix-muted">{lang === 'ar' ? 'اختر شركة للبدء' : 'Select a company to continue'}</div>}
      {companyId && tabs.length === 0 && <div className="noorix-surface-card p-8 text-center text-red-700">{lang === 'ar' ? 'لا توجد صلاحية لدخول طلبات 2' : 'No Orders 2 permission'}</div>}
      {companyId && tabs.length > 0 && (
        <ScreenTabs items={tabs} value={activeTab} onChange={setActiveTab} contentClassName="min-h-[260px] px-1 py-3 sm:px-3">
          <OrdersV3QueryState loading={bootstrapQuery.isLoading} error={bootstrapQuery.error as Error | null} />
          {!bootstrapQuery.isLoading && activeTab === 'requests' && <OrdersV3DocumentsTab companyId={companyId} documentType="purchase" startDate={dateFilter.startDate} endDate={dateFilter.endDate} bootstrap={bootstrapQuery.data} canReport={canReport} canCreate={canCreatePurchase} canReverse={canDelete} />}
          {!bootstrapQuery.isLoading && activeTab === 'registration' && <OrdersV3DocumentsTab companyId={companyId} documentType="registration" startDate={dateFilter.startDate} endDate={dateFilter.endDate} bootstrap={bootstrapQuery.data} canReport={canReport} canCreate={canCreateRegistration} canReverse={canDelete} />}
          {!bootstrapQuery.isLoading && activeTab === 'items-report' && <OrdersV3ItemsReportTab companyId={companyId} startDate={dateFilter.startDate} endDate={dateFilter.endDate} />}
          {!bootstrapQuery.isLoading && activeTab === 'sales-report' && <OrdersV3SalesReportTab companyId={companyId} startDate={dateFilter.startDate} endDate={dateFilter.endDate} />}
          {!bootstrapQuery.isLoading && activeTab === 'catalog' && <OrdersV3CatalogTab companyId={companyId} bootstrap={bootstrapQuery.data} canDelete={canDelete} />}
          {!bootstrapQuery.isLoading && activeTab === 'inventory' && <OrdersV3InventoryTab companyId={companyId} bootstrap={bootstrapQuery.data} canWrite={canInventoryWrite} />}
        </ScreenTabs>
      )}
    </ScreenShell>
  );
}
