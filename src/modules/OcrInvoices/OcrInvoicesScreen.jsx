import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  { key: 'upload',    icon: '📤', labelKey: 'ocrUploadTab' },
  { key: 'invoices',  icon: '📄', labelKey: 'ocrInvoicesTab' },
  { key: 'suppliers', icon: '🏭', labelKey: 'ocrSuppliersTab' },
  { key: 'items',     icon: '📦', labelKey: 'ocrItemsTab' },
  { key: 'alerts',    icon: '⚠️', labelKey: 'ocrPriceAlertsTab' },
];

export default function OcrInvoicesScreen() {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('upload');
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const { data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['ocr-invoices'],
    queryFn: async () => {
      const res = await getOcrInvoices();
      return res.success ? (res.data || []) : [];
    },
  });

  const { data: suppliersData, isLoading: suppliersLoading, refetch: refetchSuppliers } = useQuery({
    queryKey: ['ocr-suppliers'],
    queryFn: async () => {
      const res = await getOcrSuppliers();
      return res.success ? (res.data || []) : [];
    },
  });

  const { data: itemsData, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ['ocr-items'],
    queryFn: async () => {
      const res = await getOcrItems();
      return res.success ? (res.data || []) : [];
    },
  });

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['ocr-price-alerts'],
    queryFn: async () => {
      const res = await getPriceAlerts();
      return res.success ? (res.data || []) : [];
    },
  });

  const handleSaved = useCallback(() => {
    refetchInvoices();
    refetchAlerts();
  }, [refetchInvoices, refetchAlerts]);

  const alertsCount = alertsData?.length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} dir={dir}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🔍 {t('ocrTitle')}</h1>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)',
          }}>
            {t('ocrBeta')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--noorix-border)',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '14px 20px', border: 'none', cursor: 'pointer',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14, whiteSpace: 'nowrap',
                  background: 'transparent',
                  color: isActive ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
                  borderBottom: isActive ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <span>{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
                {tab.key === 'alerts' && alertsCount > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 10,
                    background: '#dc2626', color: '#fff', minWidth: 18, textAlign: 'center',
                  }}>
                    {alertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '24px 20px' }}>
          {activeTab === 'upload' && (
            <InvoiceUploadTab
              suppliers={suppliersData || []}
              items={itemsData || []}
              onSaved={handleSaved}
            />
          )}
          {activeTab === 'invoices' && (
            <InvoiceListTab
              invoices={invoicesData || []}
              loading={invoicesLoading}
            />
          )}
          {activeTab === 'suppliers' && (
            <SuppliersCatalogTab
              suppliers={suppliersData || []}
              loading={suppliersLoading}
              onRefresh={refetchSuppliers}
            />
          )}
          {activeTab === 'items' && (
            <ItemsCatalogTab
              items={itemsData || []}
              loading={itemsLoading}
              onRefresh={refetchItems}
            />
          )}
          {activeTab === 'alerts' && (
            <PriceAlertsTab
              alerts={alertsData || []}
              loading={alertsLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
