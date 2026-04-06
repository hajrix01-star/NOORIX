import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import InvoiceUploadTab    from './components/InvoiceUploadTab';
import InvoiceListTab      from './components/InvoiceListTab';
import SuppliersCatalogTab from './components/SuppliersCatalogTab';
import ItemsCatalogTab     from './components/ItemsCatalogTab';
import PriceAlertsTab      from './components/PriceAlertsTab';
import {
  getOcrInvoices, getOcrSuppliers, getOcrItems, getPriceAlerts,
} from './services/ocrApi';

const TABS = [
  { key: 'upload',    icon: '📤', labelAr: 'رفع فاتورة',   labelEn: 'Upload' },
  { key: 'invoices',  icon: '📄', labelAr: 'الفواتير',      labelEn: 'Invoices' },
  { key: 'suppliers', icon: '🏭', labelAr: 'الموردون',      labelEn: 'Suppliers' },
  { key: 'items',     icon: '📦', labelAr: 'الأصناف',       labelEn: 'Items' },
  { key: 'alerts',    icon: '⚠️', labelAr: 'تنبيهات الأسعار', labelEn: 'Price Alerts' },
];

export default function OcrInvoicesScreen() {
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState('upload');
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const isAr = language === 'ar';

  const { data: invoicesData,  isLoading: invoicesLoading,  refetch: refetchInvoices  } = useQuery({
    queryKey: ['ocr-invoices'],
    queryFn: async () => { const r = await getOcrInvoices();  return r.success ? (r.data || []) : []; },
  });
  const { data: suppliersData, isLoading: suppliersLoading, refetch: refetchSuppliers } = useQuery({
    queryKey: ['ocr-suppliers'],
    queryFn: async () => { const r = await getOcrSuppliers(); return r.success ? (r.data || []) : []; },
  });
  const { data: itemsData,     isLoading: itemsLoading,     refetch: refetchItems     } = useQuery({
    queryKey: ['ocr-items'],
    queryFn: async () => { const r = await getOcrItems();     return r.success ? (r.data || []) : []; },
  });
  const { data: alertsData,    isLoading: alertsLoading,    refetch: refetchAlerts    } = useQuery({
    queryKey: ['ocr-price-alerts'],
    queryFn: async () => { const r = await getPriceAlerts();  return r.success ? (r.data || []) : []; },
  });

  const handleSaved = useCallback(() => {
    refetchInvoices(); refetchAlerts(); refetchSuppliers(); refetchItems();
  }, [refetchInvoices, refetchAlerts, refetchSuppliers, refetchItems]);

  const alertsCount   = alertsData?.length   || 0;
  const invoicesCount = invoicesData?.length  || 0;
  const suppCount     = suppliersData?.length || 0;
  const itemsCount    = itemsData?.length     || 0;

  return (
    <div className="ocr-screen" dir={dir}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="ocr-header">
        <div className="ocr-header-inner">
          <div className="ocr-header-title">
            <span className="ocr-header-icon">🧾</span>
            <div>
              <h1 className="ocr-h1">{isAr ? 'استخراج الفواتير الذكي' : 'Smart Invoice OCR'}</h1>
              <div className="ocr-subtitle">
                {isAr ? 'تحليل واستخراج بيانات الفواتير باستخدام الذكاء الاصطناعي' : 'AI-powered invoice data extraction & analysis'}
              </div>
            </div>
          </div>
          <span className="ocr-beta-badge">{isAr ? 'تجريبي' : 'Beta'}</span>
        </div>

        {/* Stats strip */}
        <div className="ocr-stats-strip">
          {[
            { icon: '📄', val: invoicesCount, label: isAr ? 'فاتورة' : 'Invoices', tab: 'invoices', color: '#3b82f6' },
            { icon: '🏭', val: suppCount,     label: isAr ? 'مورد'   : 'Suppliers', tab: 'suppliers', color: '#8b5cf6' },
            { icon: '📦', val: itemsCount,    label: isAr ? 'صنف'    : 'Items',     tab: 'items',    color: '#f59e0b' },
            { icon: '⚠️', val: alertsCount,   label: isAr ? 'تنبيه' : 'Alerts',    tab: 'alerts',   color: '#dc2626' },
          ].map(({ icon, val, label, tab, color }) => (
            <button key={tab} className="ocr-stat-card" onClick={() => setActiveTab(tab)}
              style={{ '--stat-color': color }}>
              <span className="ocr-stat-icon">{icon}</span>
              <span className="ocr-stat-num">{val}</span>
              <span className="ocr-stat-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="ocr-card">
        {/* Tab bar */}
        <div className="ocr-tabbar" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`ocr-tab-btn${isActive ? ' ocr-tab-btn--active' : ''}`}
              >
                <span className="ocr-tab-icon">{tab.icon}</span>
                <span className="ocr-tab-label">{isAr ? tab.labelAr : tab.labelEn}</span>
                {tab.key === 'alerts' && alertsCount > 0 && (
                  <span className="ocr-tab-badge">{alertsCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="ocr-tab-body">
          {activeTab === 'upload' && (
            <InvoiceUploadTab suppliers={suppliersData || []} items={itemsData || []} onSaved={handleSaved} />
          )}
          {activeTab === 'invoices' && (
            <InvoiceListTab invoices={invoicesData || []} loading={invoicesLoading} onRefresh={refetchInvoices} />
          )}
          {activeTab === 'suppliers' && (
            <SuppliersCatalogTab suppliers={suppliersData || []} loading={suppliersLoading} onRefresh={refetchSuppliers} />
          )}
          {activeTab === 'items' && (
            <ItemsCatalogTab items={itemsData || []} loading={itemsLoading} onRefresh={refetchItems} />
          )}
          {activeTab === 'alerts' && (
            <PriceAlertsTab alerts={alertsData || []} loading={alertsLoading} invoices={invoicesData || []} onRefresh={refetchAlerts} />
          )}
        </div>
      </div>
    </div>
  );
}
