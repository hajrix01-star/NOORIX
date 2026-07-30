import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { ScreenShell, ScreenTabs, ScreenTitle } from '../../ui';
import { StaffOrderPanel } from './StaffOrderPanel';

type StaffOrderTabId = 'order' | 'sale';

export function StaffOrdersView({
  companyId,
  embedded = false,
  salesOnly = false,
  defaultTab = 'order',
  allowOrders = true,
  allowSales = true,
}: {
  companyId: string;
  embedded?: boolean;
  salesOnly?: boolean;
  defaultTab?: StaffOrderTabId;
  allowOrders?: boolean;
  allowSales?: boolean;
}) {
  const { t } = useTranslation();
  const tabIds = useMemo<StaffOrderTabId[]>(() => {
    if (salesOnly) return ['sale'];
    const ids: StaffOrderTabId[] = [];
    if (allowOrders) ids.push('order');
    if (allowSales) ids.push('sale');
    return ids.length ? ids : ['order'];
  }, [allowOrders, allowSales, salesOnly]);

  const resolvedDefaultTab = tabIds.includes(defaultTab) ? defaultTab : tabIds[0];
  const [activeTab, setActiveTab] = useTabSearchParam(
    tabIds,
    resolvedDefaultTab,
    'staffOrderTab',
    null,
    undefined,
    { persistDefault: true },
  );

  const tabs = useMemo(() => [
    ...(allowOrders && !salesOnly ? [{ id: 'order', label: t('staffOrdersTabOrders') }] : []),
    ...(allowSales || salesOnly ? [{ id: 'sale', label: t('staffOrdersTabSales') }] : []),
  ], [allowOrders, allowSales, salesOnly, t]);

  const singlePanel = tabIds.length === 1
    ? <StaffOrderPanel companyId={companyId} productType={tabIds[0]} />
    : null;

  const tabContent = singlePanel ?? (
    <ScreenTabs
      items={tabs}
      value={activeTab}
      onChange={(v) => setActiveTab(v as StaffOrderTabId)}
      contentClassName="px-3 pt-3 pb-4 sm:px-4"
    >
      <StaffOrderPanel key={activeTab} companyId={companyId} productType={activeTab as StaffOrderTabId} />
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
