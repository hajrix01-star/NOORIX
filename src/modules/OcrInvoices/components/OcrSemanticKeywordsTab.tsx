import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { fetchOcrInvoiceImageBlob } from '../ocrInvoiceImageQuery';
import { ocrKeys } from '../../../services/queryKeys';
import { fmt } from '../../../utils/format';
import { Button, Input, Modal, SmartTable } from '../../../ui';
import { getOcrOperationsDashboard, getOcrSemanticKeywordInsights } from '../services/ocrApi';

const DAY_OPTIONS = [7, 30, 60, 90, 180];

type InvoiceImageState = {
  invoiceId: string;
  invoiceLabel: string;
  imageUrl: string | null;
  loading: boolean;
  error: string;
};

export default function OcrSemanticKeywordsTab() {
  const { lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const isAr = lang === 'ar';

  const [days, setDays] = useState(30);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [imageState, setImageState] = useState<InvoiceImageState | null>(null);

  const { data: opsData } = useQuery({
    queryKey: ocrKeys.operationsDashboard(activeCompanyId || '', days),
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const r = await getOcrOperationsDashboard(days);
      return r.success ? (r.data || null) : null;
    },
  });

  const {
    data: semanticData,
    isLoading: semanticLoading,
  } = useQuery({
    queryKey: ocrKeys.semanticKeywordInsights(activeCompanyId || '', days, keyword),
    enabled: !!activeCompanyId && !!keyword.trim(),
    queryFn: async () => {
      const r = await getOcrSemanticKeywordInsights({
        keyword: keyword.trim(),
        days,
        limit: 120,
      });
      return r.success ? (r.data || null) : null;
    },
  });

  useEffect(() => (
    () => {
      if (imageState?.imageUrl) URL.revokeObjectURL(imageState.imageUrl);
    }
  ), [imageState?.imageUrl]);

  const openInvoiceImage = async (invoiceId: string, invoiceLabel: string) => {
    if (!invoiceId) return;
    let nextState: InvoiceImageState = {
      invoiceId,
      invoiceLabel,
      imageUrl: null,
      loading: true,
      error: '',
    };
    setImageState((prev) => {
      if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl);
      return nextState;
    });
    try {
      const blob = await fetchOcrInvoiceImageBlob(invoiceId, undefined);
      const blobUrl = URL.createObjectURL(blob);
      nextState = {
        ...nextState,
        imageUrl: blobUrl,
        loading: false,
      };
      setImageState(nextState);
    } catch {
      setImageState({
        ...nextState,
        loading: false,
        error: isAr ? 'تعذّر تحميل صورة الفاتورة.' : 'Failed to load invoice image.',
      });
    }
  };

  const closeInvoiceImage = () => {
    setImageState((prev) => {
      if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl);
      return null;
    });
  };

  const semanticLineColumns = useMemo(() => [
    { key: 'itemName', label: isAr ? 'الصنف' : 'Item' },
    { key: 'supplierName', label: isAr ? 'المورد' : 'Supplier' },
    {
      key: 'unitPrice',
      label: isAr ? 'سعر الوحدة' : 'Unit price',
      numeric: true,
      render: (_: unknown, row: any) => (row.unitPrice != null
        ? <span className="ltr">{fmt(row.unitPrice)} <span className="nx-sar">SR</span></span>
        : '—'),
    },
    {
      key: 'totalPrice',
      label: isAr ? 'إجمالي السطر' : 'Line total',
      numeric: true,
      render: (_: unknown, row: any) => (row.totalPrice != null
        ? <span className="ltr">{fmt(row.totalPrice)} <span className="nx-sar">SR</span></span>
        : '—'),
    },
    {
      key: 'historyPrice',
      label: isAr ? 'آخر سعر تاريخي' : 'Latest historical price',
      numeric: true,
      render: (_: unknown, row: any) => (row.historyPrice != null
        ? <span className="ltr">{fmt(row.historyPrice)} <span className="nx-sar">SR</span></span>
        : '—'),
    },
    {
      key: 'priceDeltaPercent',
      label: isAr ? 'فرق السعر %' : 'Price delta %',
      numeric: true,
      render: (_: unknown, row: any) => (row.priceDeltaPercent != null ? `${fmt(row.priceDeltaPercent)}%` : '—'),
    },
    { key: 'invoiceDate', label: isAr ? 'تاريخ الفاتورة' : 'Invoice date' },
    { key: 'invoiceNumber', label: isAr ? 'رقم الفاتورة' : 'Invoice #' },
    {
      key: 'viewImage',
      label: isAr ? 'الصورة' : 'Image',
      render: (_: unknown, row: any) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openInvoiceImage(String(row.invoiceId || ''), String(row.invoiceNumber || '—'))}
        >
          {isAr ? 'عرض' : 'View'}
        </Button>
      ),
    },
  ], [isAr]);

  const semanticInvoiceColumns = useMemo(() => [
    { key: 'invoiceNumber', label: isAr ? 'رقم الفاتورة' : 'Invoice #' },
    { key: 'invoiceDate', label: isAr ? 'التاريخ' : 'Date' },
    { key: 'supplierName', label: isAr ? 'المورد' : 'Supplier' },
    { key: 'matchedLines', label: isAr ? 'السطور المطابقة' : 'Matched lines', numeric: true },
    {
      key: 'matchedLinesTotal',
      label: isAr ? 'إجمالي السطور المطابقة' : 'Matched lines total',
      numeric: true,
      render: (_: unknown, row: any) => (
        <span className="ltr">{fmt(row.matchedLinesTotal || 0)} <span className="nx-sar">SR</span></span>
      ),
    },
    {
      key: 'invoiceTotal',
      label: isAr ? 'إجمالي الفاتورة' : 'Invoice total',
      numeric: true,
      render: (_: unknown, row: any) => (
        <span className="ltr">{fmt(row.invoiceTotal || 0)} <span className="nx-sar">SR</span></span>
      ),
    },
    {
      key: 'viewImage',
      label: isAr ? 'الصورة' : 'Image',
      render: (_: unknown, row: any) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openInvoiceImage(String(row.invoiceId || ''), String(row.invoiceNumber || '—'))}
        >
          {isAr ? 'عرض' : 'View'}
        </Button>
      ),
    },
  ], [isAr]);

  const semanticItemColumns = useMemo(() => [
    { key: 'itemName', label: isAr ? 'الصنف' : 'Item' },
    { key: 'category', label: isAr ? 'التصنيف' : 'Category', render: (_: unknown, row: any) => row.category || '—' },
    { key: 'lineCount', label: isAr ? 'السطور' : 'Lines', numeric: true },
    { key: 'invoiceCount', label: isAr ? 'الفواتير' : 'Invoices', numeric: true },
    {
      key: 'avgUnitPrice',
      label: isAr ? 'متوسط سعر الوحدة' : 'Avg unit price',
      numeric: true,
      render: (_: unknown, row: any) => (
        <span className="ltr">{fmt(row.avgUnitPrice || 0)} <span className="nx-sar">SR</span></span>
      ),
    },
    {
      key: 'latestHistoryPrice',
      label: isAr ? 'آخر سعر تاريخي' : 'Latest historical price',
      numeric: true,
      render: (_: unknown, row: any) => (row.latestHistoryPrice != null
        ? <span className="ltr">{fmt(row.latestHistoryPrice)} <span className="nx-sar">SR</span></span>
        : '—'),
    },
  ], [isAr]);

  return (
    <div className="flex flex-col gap-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="noorix-surface-card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-bold text-noorix-text">
            {isAr ? 'مستكشف الكلمات الدلالية' : 'Semantic keyword explorer'}
          </div>
          <div className="text-[12px] text-noorix-muted">
            {isAr
              ? 'اضغط كلمة دلالية لعرض الأصناف والموردين والأسعار والفواتير'
              : 'Click a semantic keyword to explore items, suppliers, prices, and invoices'}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
          <label className="flex flex-col gap-1 min-w-[180px]">
            <span className="text-[12px] text-noorix-muted">{isAr ? 'فترة التحليل' : 'Analysis window'}</span>
            <Input type="select" value={String(days)} onChange={(e: any) => setDays(Number(e.target.value) || 30)}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {isAr ? `${d} يوم` : `${d} days`}
                </option>
              ))}
            </Input>
          </label>
          <Input
            type="search"
            value={keywordInput}
            onChange={(e: any) => setKeywordInput(e.target.value || '')}
            placeholder={isAr ? 'مثال: جبن / نعناع / عنب' : 'e.g. cheese / mint / grape'}
          />
          <Button size="sm" variant="primary" onClick={() => setKeyword(keywordInput.trim())}>
            {isAr ? 'بحث' : 'Search'}
          </Button>
          {keyword && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setKeyword('');
                setKeywordInput('');
              }}
            >
              {isAr ? 'مسح' : 'Clear'}
            </Button>
          )}
        </div>
        <div className="text-[12px] text-noorix-muted">
          {isAr ? 'النطاق' : 'Range'}: {opsData?.range?.from || '—'} → {opsData?.range?.to || '—'}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(opsData?.topSemanticKeywords || []).slice(0, 12).map((row: any) => (
            <Button
              key={row.keyword}
              size="sm"
              variant={keyword === row.keyword ? 'primary' : 'ghost'}
              onClick={() => {
                setKeywordInput(row.keyword);
                setKeyword(row.keyword);
              }}
            >
              {row.keyword} ({fmt(row.count || 0, 0)})
            </Button>
          ))}
        </div>

        {keyword && (
          <div className="text-[12px] text-noorix-muted ltr">
            {isAr ? 'النتائج للكلمة:' : 'Results for:'} <span className="font-bold text-noorix-text">{keyword}</span>
            {' • '}
            {isAr ? 'سطور:' : 'Lines:'} {fmt(semanticData?.summary?.matchedLines || 0, 0)}
            {' • '}
            {isAr ? 'فواتير:' : 'Invoices:'} {fmt(semanticData?.summary?.invoicesCount || 0, 0)}
          </div>
        )}
      </div>

      {semanticLoading && keyword && (
        <div className="text-[12px] text-noorix-muted">
          {isAr ? 'جاري تحميل نتائج الكلمة الدلالية…' : 'Loading semantic keyword results…'}
        </div>
      )}

      {!!keyword && !semanticLoading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SmartTable
            title={isAr ? 'سطور الفواتير المطابقة للكلمة' : 'Keyword-matched invoice lines'}
            columns={semanticLineColumns}
            data={semanticData?.lines || []}
            total={(semanticData?.lines || []).length}
            page={1}
            pageSize={Math.max(1, Math.min(30, (semanticData?.lines || []).length || 1))}
            emptyMessage={isAr ? 'لا توجد سطور مطابقة لهذه الكلمة.' : 'No matching lines for this keyword.'}
            tableId="ocr-semantic-keyword-lines"
          />
          <SmartTable
            title={isAr ? 'الفواتير المرتبطة بالكلمة' : 'Invoices linked to keyword'}
            columns={semanticInvoiceColumns}
            data={semanticData?.invoices || []}
            total={(semanticData?.invoices || []).length}
            page={1}
            pageSize={Math.max(1, Math.min(30, (semanticData?.invoices || []).length || 1))}
            emptyMessage={isAr ? 'لا توجد فواتير مرتبطة بالكلمة.' : 'No invoices linked to keyword.'}
            tableId="ocr-semantic-keyword-invoices"
          />
          <SmartTable
            title={isAr ? 'الأصناف المرتبطة بالكلمة' : 'Items linked to keyword'}
            columns={semanticItemColumns}
            data={semanticData?.items || []}
            total={(semanticData?.items || []).length}
            page={1}
            pageSize={Math.max(1, Math.min(30, (semanticData?.items || []).length || 1))}
            emptyMessage={isAr ? 'لا توجد أصناف مرتبطة بالكلمة.' : 'No items linked to keyword.'}
            tableId="ocr-semantic-keyword-items"
          />
        </div>
      )}

      <Modal
        open={!!imageState}
        onClose={closeInvoiceImage}
        title={isAr
          ? `صورة الفاتورة #${imageState?.invoiceLabel || '—'}`
          : `Invoice image #${imageState?.invoiceLabel || '—'}`}
        size="xl"
        footer={(
          <Button size="sm" variant="ghost" onClick={closeInvoiceImage}>
            {isAr ? 'إغلاق' : 'Close'}
          </Button>
        )}
      >
        {imageState?.loading && (
          <div className="text-[13px] text-noorix-muted">
            {isAr ? 'جاري تحميل الصورة…' : 'Loading image…'}
          </div>
        )}
        {!imageState?.loading && imageState?.error && (
          <div className="text-[13px] text-noorix-red">
            {imageState.error}
          </div>
        )}
        {!imageState?.loading && !imageState?.error && imageState?.imageUrl && (
          <img
            src={imageState.imageUrl}
            alt={isAr ? 'صورة الفاتورة' : 'Invoice image'}
            className="w-full max-h-[70vh] object-contain rounded-lg border border-noorix-border bg-noorix-bg-muted"
          />
        )}
      </Modal>
    </div>
  );
}
