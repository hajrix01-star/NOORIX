/**
 * StaffOrdersView — واجهة الموظف لإرسال طلبات القسم
 * تجربة POS: شبكة كروت، ضغطة تضيف للطلب، ملخص أسفل الشاشة
 * تبويبان: طلبات | مبيعات
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { ScreenShell, ScreenTabs, ScreenTitle } from '../../ui';
import { StaffOrderPanel } from './StaffOrderPanel';
export function StaffOrdersView({
  companyId,
  embedded = false,
  salesOnly = false,
  defaultTab = 'order',
}: {
  companyId: string;
  embedded?: boolean;
  /** داخل واجهة المدير — تبويب مبيعات فقط (كاشير) */
  salesOnly?: boolean;
  defaultTab?: 'order' | 'sale';
}) {
  const { t } = useTranslation();
  const STAFF_VIEW_TAB_IDS = useMemo(() => ['order', 'sale'] as const, []);
  const [activeTab, setActiveTab] = useTabSearchParam(
    STAFF_VIEW_TAB_IDS,
    defaultTab,
    'staffOrderTab',
    null,
    undefined,
    { persistDefault: true },
  );

  const tabs = useMemo(() => [
    { id: 'order', label: t('staffOrdersTabOrders') },
    { id: 'sale',  label: t('staffOrdersTabSales') },
  ], [t]);

  if (salesOnly) {
    return <StaffOrderPanel companyId={companyId} productType="sale" />;
  }

  const tabContent = (
    <ScreenTabs
      items={tabs}
      value={activeTab}
      onChange={(v) => setActiveTab(v as 'order' | 'sale')}
      contentClassName="px-3 pt-3 pb-4 sm:px-4"
    >
      <StaffOrderPanel key={activeTab} companyId={companyId} productType={activeTab as 'order' | 'sale'} />
    </ScreenTabs>
  );

  if (embedded) return tabContent;

  return (
    <ScreenShell variant="data">
      <ScreenTitle>{t('staffOrdersTitle')}</ScreenTitle>
      {tabContent}
    </ScreenShell>
  );
}
