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
  { key: 'upload',    labelAr: 'رفع فاتورة',   labelEn: 'Upload' },
  { key: 'invoices',  labelAr: 'الفواتير',      labelEn: 'Invoices' },
  { key: 'suppliers', labelAr: 'الموردون',      labelEn: 'Suppliers' },
  { key: 'items',     labelAr: 'الأصناف',       labelEn: 'Items' },
  { key: 'alerts',    labelAr: 'تنبيهات الأسعار', labelEn: 'Alerts' },
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

      {/* ── Header ── */}
      <div className="ocr-header">
        <div className="ocr-header-title">
          <div className="ocr-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div>
            <h1 className="ocr-h1">{isAr ? 'استخراج الفواتير الذكي' : 'Smart Invoice OCR'}</h1>
            <div className="ocr-subtitle">
              {isAr ? 'تحليل واستخراج بيانات الفواتير بالذكاء الاصطناعي' : 'AI-powered invoice data extraction'}
            </div>
          </div>
        </div>
        <span className="ocr-beta-badge">{isAr ? 'تجريبي' : 'BETA'}</span>
      </div>

      {/* ── Stats ── */}
      <div className="ocr-stats-strip">
        {[
          { val: invoicesCount, label: isAr ? 'فاتورة' : 'Invoices', tab: 'invoices' },
          { val: suppCount,     label: isAr ? 'مورد'   : 'Suppliers', tab: 'suppliers' },
          { val: itemsCount,    label: isAr ? 'صنف'    : 'Items',     tab: 'items' },
          { val: alertsCount,   label: isAr ? 'تنبيه' : 'Alerts',    tab: 'alerts' },
        ].map(({ val, label, tab }) => (
          <button key={tab} className="ocr-stat-card" onClick={() => setActiveTab(tab)}>
            <span className="ocr-stat-num">{val}</span>
            <span className="ocr-stat-label">{label}</span>
          </button>
        ))}
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
