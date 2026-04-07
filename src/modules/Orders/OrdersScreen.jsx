/**
 * OrdersScreen — قسم الطلبات
 * تبويبات: الطلبات | تقارير الأصناف | إدارة الأصناف
 */
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Button } from '../../ui';
import { OrdersTab } from './components/OrdersTab';
import { ItemsReportTab } from './components/ItemsReportTab';
import { ItemsManageTab } from './components/ItemsManageTab';

function parseYearMonth(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return Number.isFinite(y) && Number.isFinite(m) ? { year: y, month: m } : null;
}

export default function OrdersScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const dateFilter = useDateFilter();
  const [activeTab, setActiveTab] = useState('orders');

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

  const tabs = [
    { id: 'orders', label: t('ordersTab'), desc: t('ordersTabDesc') },
    { id: 'items-report', label: t('ordersItemsReportTab'), desc: t('ordersItemsReportTabDesc') },
    { id: 'items-manage', label: t('ordersItemsManageTab'), desc: t('ordersItemsManageTabDesc') },
  ];

  return (
    <div className="flex flex-col gap-4 py-4 px-0 md:px-3 lg:px-6">
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('ordersTitle')}</h1>
      </div>

      {!companyId && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {companyId && (
        <>
          {/* تبويبات */}
          <div className="orders-screen-tab-strip" role="tablist">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`orders-screen-tab${activeTab === tab.id ? ' orders-screen-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
