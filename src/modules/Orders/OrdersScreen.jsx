/**
 * OrdersScreen — قسم الطلبات
 * تبويبات: الطلبات | تقارير الأصناف | إدارة الأصناف
 */
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import DateFilterBar from '../../shared/components/DateFilterBar';
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
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('ordersTitle')}</h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          {t('ordersDesc')}
        </p>
      </div>

      {!companyId && (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompany')}
        </div>
      )}

      {companyId && (
        <>
          {/* تبويبات */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--noorix-border)', gap: 0, flexWrap: 'wrap' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="noorix-btn-nav"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  borderRadius: 0, border: 'none', margin: 0,
                  borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
                  background: activeTab === tab.id ? 'rgba(22,163,74,0.07)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--noorix-accent-green)' : 'var(--noorix-text-muted)',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  padding: '10px 20px', fontSize: 13,
                }}
              >
                {tab.label}
              </button>
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
