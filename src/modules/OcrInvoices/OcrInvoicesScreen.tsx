import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenShell, ScreenTabs } from '../../ui';
import InvoiceUploadTab    from './components/InvoiceUploadTab';
import InvoiceListTab      from './components/InvoiceListTab';
import SuppliersCatalogTab from './components/SuppliersCatalogTab';
import ItemsCatalogTab     from './components/ItemsCatalogTab';
import PriceAlertsTab      from './components/PriceAlertsTab';
import OcrReviewQueueTab   from './components/OcrReviewQueueTab';
import OcrPurchasesReportTab from './components/OcrPurchasesReportTab';
import {
  getOcrInvoices,
  getOcrReviewQueue,
  getOcrSuppliers,
  getOcrItems,
  getPriceAlerts,
} from './services/ocrApi';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';

const TABS = [
  { key: 'upload',    labelAr: 'رفع فاتورة',      labelEn: 'Upload' },
  { key: 'review',    labelAr: 'مراجعة الاستخراج', labelEn: 'Extraction review' },
  { key: 'invoices',  labelAr: 'الفواتير',          labelEn: 'Invoices' },
  { key: 'suppliers', labelAr: 'الموردون',          labelEn: 'Suppliers' },
  { key: 'items',     labelAr: 'الأصناف',           labelEn: 'Items' },
  { key: 'alerts',    labelAr: 'تنبيهات الأسعار',  labelEn: 'Alerts' },
  { key: 'purchases', labelAr: 'تقرير مشتريات',    labelEn: 'Purchases report' },
];
const OCR_TAB_IDS = TABS.map((tab: any) => tab.key);

export default function OcrInvoicesScreen() {
  const { lang, t } = useTranslation();
  const { activeCompanyId } = useApp();
  const queryClient = useQueryClient();
  /** `ocrTab` + legacy `tab` (فقط إن كانت القيمة ضمن تبويبات OCR) — يمنى تعارض ?tab= من مشتريات/إعدادات */
  const [activeTab, setActiveTab] = useTabSearchParam(OCR_TAB_IDS, 'upload', 'ocrTab', 'tab');
  const [uploadPrefillId, setUploadPrefillId] = useState<any>(null);
  const isAr = lang === 'ar';

  const ocrEnabled = !!activeCompanyId;

  const { data: invoicesData,  isLoading: invoicesLoading,  refetch: refetchInvoices  } = useQuery({
    queryKey: ['ocr-invoices', activeCompanyId],
    enabled: ocrEnabled,
    queryFn: async () => { const r = await getOcrInvoices();  return r.success ? (r.data || []) : []; },
  });
  const { data: suppliersData, isLoading: suppliersLoading, refetch: refetchSuppliers } = useQuery({
    queryKey: ['ocr-suppliers', activeCompanyId],
    enabled: ocrEnabled,
    queryFn: async () => { const r = await getOcrSuppliers(); return r.success ? (r.data || []) : []; },
  });
  const { data: itemsData,     isLoading: itemsLoading,     refetch: refetchItems     } = useQuery({
    queryKey: ['ocr-items', activeCompanyId],
    enabled: ocrEnabled,
    queryFn: async () => { const r = await getOcrItems();     return r.success ? (r.data || []) : []; },
  });
  const { data: alertsData,    isLoading: alertsLoading,    refetch: refetchAlerts    } = useQuery({
    queryKey: ['ocr-price-alerts', activeCompanyId],
    enabled: ocrEnabled,
    queryFn: async () => { const r = await getPriceAlerts();  return r.success ? (r.data || []) : []; },
  });

  const { data: reviewQueueData } = useQuery({
    queryKey: ['ocr-review-queue', activeCompanyId],
    enabled: ocrEnabled,
    queryFn: async () => {
      const r = await getOcrReviewQueue();
      return r.success ? (r.data || []) : [];
    },
  });

  const handleSaved = useCallback((meta: any) => {
    queryClient.invalidateQueries({ queryKey: ['ocr-review-queue', activeCompanyId] });
    if (meta?.invalidateFinancial) {
      invalidateOnFinancialMutation(queryClient);
    }
    refetchInvoices(); refetchAlerts(); refetchSuppliers(); refetchItems();
  }, [queryClient, activeCompanyId, refetchInvoices, refetchAlerts, refetchSuppliers, refetchItems]);

  const handleOpenFromReview = useCallback((inv: any) => {
    if (!inv?.id) return;
    setUploadPrefillId(inv.id);
    setActiveTab('upload');
  }, [setActiveTab]);

  const clearUploadPrefill = useCallback(() => setUploadPrefillId(null), []);

  const alertsCount   = alertsData?.length   || 0;
  const invoicesCount = invoicesData?.length  || 0;
  const suppCount     = suppliersData?.length || 0;
  const itemsCount    = itemsData?.length     || 0;
  const reviewPendingCount = Array.isArray(reviewQueueData)
    ? reviewQueueData.filter((x: any) => x.status === 'pending_review').length
    : 0;

  const STATS = useMemo(() => [
    { val: reviewPendingCount, labelKey: 'ocrStatToReview', tab: 'review' },
    { val: invoicesCount, labelAr: 'فاتورة',  labelEn: 'Invoices',  tab: 'invoices'  },
    { val: suppCount,     labelAr: 'مورد',    labelEn: 'Suppliers', tab: 'suppliers' },
    { val: itemsCount,    labelAr: 'صنف',     labelEn: 'Items',     tab: 'items'     },
    { val: alertsCount,   labelAr: 'تنبيه',   labelEn: 'Alerts',   tab: 'alerts'    },
  ], [reviewPendingCount, invoicesCount, suppCount, itemsCount, alertsCount, t]);

  const tabItems = useMemo(() => TABS.map((tab: any) => ({
    id: tab.key,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {tab.key === 'review'
          ? t('ocrReviewQueueTab')
          : tab.key === 'purchases'
            ? t('ocrPurchasesReportTab')
            : (isAr ? tab.labelAr : tab.labelEn)}
        {tab.key === 'review' && reviewPendingCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-noorix-blue text-white text-[10px] font-bold leading-none">
            {reviewPendingCount}
          </span>
        )}
        {tab.key === 'alerts' && alertsCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-noorix-red text-white text-[10px] font-bold leading-none">
            {alertsCount}
          </span>
        )}
      </span>
    ),
  })), [isAr, alertsCount, reviewPendingCount, t]);

  return (
    <ScreenShell>

      {!ocrEnabled && (
        <div className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[13px] text-noorix-muted">
          {isAr ? 'اختر شركة من القائمة لعرض بيانات OCR لهذا الفرع.' : 'Select a company from the menu to load OCR data for that branch.'}
        </div>
      )}

      {/* ── رأس الصفحة ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-noorix-bg-muted text-noorix-blue shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-noorix-text m-0 leading-tight">
              {isAr ? 'استخراج الفواتير الذكي' : 'Smart Invoice OCR'}
            </h1>
            <p className="text-[12px] text-noorix-muted m-0 mt-0.5">
              {isAr ? 'تحليل واستخراج بيانات الفواتير بالذكاء الاصطناعي' : 'AI-powered invoice data extraction'}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold tracking-widest text-noorix-muted bg-noorix-bg-muted border border-noorix-border rounded-md px-2.5 py-1">
          {isAr ? 'تجريبي' : 'BETA'}
        </span>
      </div>

      {/* ── كروت الإحصائيات ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATS.map((row: any) => (
          <button
            key={row.tab}
            type="button"
            onClick={() => setActiveTab(row.tab)}
            className={[
              'noorix-surface-card p-4 flex flex-col items-center gap-1 cursor-pointer',
              'transition-shadow hover:shadow-md text-center',
              activeTab === row.tab ? 'ring-2 ring-noorix-blue/40' : '',
            ].join(' ')}
          >
            <span className="text-[26px] font-extrabold text-noorix-text leading-none tabular-nums">
              {row.val}
            </span>
            <span className="text-[12px] text-noorix-muted font-medium">
              {row.labelKey ? t(row.labelKey) : (isAr ? row.labelAr : row.labelEn)}
            </span>
          </button>
        ))}
      </div>

      {/* ── التبويبات والمحتوى ── */}
      <ScreenTabs
        items={tabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content"
      >
        {activeTab === 'upload' && (
          <InvoiceUploadTab
            suppliers={suppliersData || []}
            items={itemsData || []}
            onSaved={handleSaved}
            prefillInvoiceId={uploadPrefillId}
            onPrefillConsumed={clearUploadPrefill}
          />
        )}
        {activeTab === 'review' && (
          <OcrReviewQueueTab onOpenInvoice={handleOpenFromReview} />
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
        {activeTab === 'purchases' && <OcrPurchasesReportTab />}
      </ScreenTabs>

    </ScreenShell>
  );
}
