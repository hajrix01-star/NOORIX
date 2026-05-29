import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, SmartTable } from '../../../ui';
import { fmt } from '../../../utils/format';
import { ocrKeys } from '../../../services/queryKeys';
import { getOcrOperationsDashboard } from '../services/ocrApi';

const DAY_OPTIONS = [7, 30, 60, 90, 180];

function reasonLabel(reasonKey: string, isAr: boolean): string {
  const labels: Record<string, { ar: string; en: string }> = {
    parse: { ar: 'فشل قراءة JSON', en: 'JSON parse failure' },
    schema: { ar: 'فشل التحقق من البنية', en: 'Schema validation failure' },
    low_signal: { ar: 'استخراج بإشارات ضعيفة', en: 'Low-signal extraction' },
    network: { ar: 'مشكلة اتصال/مهلة', en: 'Network/timeout issue' },
    model_unavailable: { ar: 'تعذر توفر النموذج', en: 'Model unavailable' },
    image: { ar: 'مشكلة جودة/ملف الصورة', en: 'Image quality/file issue' },
    unknown: { ar: 'سبب غير مصنف', en: 'Unclassified reason' },
  };
  return (labels[reasonKey] || labels.unknown)[isAr ? 'ar' : 'en'];
}

export default function OcrOperationsDashboardTab() {
  const { lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const isAr = lang === 'ar';
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ocrKeys.operationsDashboard(activeCompanyId || '', days),
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const r = await getOcrOperationsDashboard(days);
      return r.success ? (r.data || null) : null;
    },
  });

  const summary = data?.summary || {};
  const kpis = useMemo(() => ([
    {
      key: 'success',
      label: isAr ? 'عمليات ناجحة' : 'Successful operations',
      value: fmt(summary.successCount || 0, 0),
      hint: `${fmt(summary.successRate || 0)}%`,
      color: 'text-noorix-green',
    },
    {
      key: 'failed',
      label: isAr ? 'عمليات فاشلة' : 'Failed operations',
      value: fmt(summary.failedCount || 0, 0),
      hint: `${fmt(summary.failureRate || 0)}%`,
      color: 'text-noorix-red',
    },
    {
      key: 'attempts',
      label: isAr ? 'متوسط المحاولات حتى النجاح' : 'Avg attempts to success',
      value: fmt(summary.avgAttemptsToSuccess || 0),
      hint: `${isAr ? 'P95' : 'P95'}: ${fmt(summary.p95AttemptsToSuccess || 0)}`,
      color: 'text-noorix-blue',
    },
    {
      key: 'fallback',
      label: isAr ? 'استخدام fallback' : 'Fallback usage',
      value: fmt(summary.fallbackUsedCount || 0, 0),
      hint: `${fmt(summary.fallbackUsedRate || 0)}%`,
      color: 'text-noorix-amber',
    },
    {
      key: 'pending',
      label: isAr ? 'بانتظار المراجعة' : 'Pending review',
      value: fmt(summary.pendingReviewCount || 0, 0),
      hint: `${isAr ? 'قيد التنفيذ' : 'In progress'}: ${fmt((summary.queuedCount || 0) + (summary.extractingCount || 0), 0)}`,
      color: 'text-noorix-violet',
    },
    {
      key: 'lineQuality',
      label: isAr ? 'سطور منخفضة الثقة' : 'Low-confidence lines',
      value: fmt(summary.lowConfidenceLineCount || 0, 0),
      hint: `${isAr ? 'غير مطابق' : 'Unmatched'}: ${fmt(summary.unmatchedLineCount || 0, 0)}`,
      color: 'text-noorix-navy',
    },
  ]), [isAr, summary]);

  const failureRows = (data?.failureReasons || []).map((row: any) => ({
    ...row,
    reasonLabel: reasonLabel(String(row.reasonKey || ''), isAr),
  }));

  const failureColumns = useMemo(() => [
    { key: 'reasonLabel', label: isAr ? 'سبب الفشل' : 'Failure reason' },
    { key: 'count', label: isAr ? 'العدد' : 'Count', numeric: true },
    {
      key: 'rate',
      label: isAr ? 'النسبة' : 'Rate',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt(row.rate || 0)}%`,
    },
  ], [isAr]);

  const modelColumns = useMemo(() => [
    { key: 'model', label: isAr ? 'النموذج' : 'Model' },
    { key: 'attempts', label: isAr ? 'المحاولات' : 'Attempts', numeric: true },
    { key: 'successAttempts', label: isAr ? 'نجاح' : 'Success', numeric: true },
    { key: 'failedAttempts', label: isAr ? 'فشل' : 'Failed', numeric: true },
    {
      key: 'successRate',
      label: isAr ? 'نسبة النجاح' : 'Success rate',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt(row.successRate || 0)}%`,
    },
    {
      key: 'avgLatencyMs',
      label: isAr ? 'متوسط زمن الاستجابة (ms)' : 'Avg latency (ms)',
      numeric: true,
      render: (_: unknown, row: any) => fmt(row.avgLatencyMs || 0),
    },
    {
      key: 'finalWins',
      label: isAr ? 'مرات الفوز النهائي' : 'Final wins',
      numeric: true,
    },
  ], [isAr]);

  const attemptsColumns = useMemo(() => [
    { key: 'attempts', label: isAr ? 'عدد المحاولات' : 'Attempts', numeric: true },
    { key: 'count', label: isAr ? 'عدد العمليات' : 'Operations', numeric: true },
    {
      key: 'rate',
      label: isAr ? 'النسبة' : 'Rate',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt(row.rate || 0)}%`,
    },
  ], [isAr]);

  const itemColumns = useMemo(() => [
    { key: 'nameAr', label: isAr ? 'الصنف' : 'Item' },
    { key: 'category', label: isAr ? 'التصنيف' : 'Category', render: (_: unknown, row: any) => row.category || '—' },
    { key: 'lineCount', label: isAr ? 'السطور' : 'Lines', numeric: true },
    { key: 'invoiceCount', label: isAr ? 'الفواتير' : 'Invoices', numeric: true },
    { key: 'unmatchedLines', label: isAr ? 'غير مطابق' : 'Unmatched', numeric: true },
    {
      key: 'avgConfidence',
      label: isAr ? 'متوسط الثقة' : 'Avg confidence',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt((row.avgConfidence || 0) * 100)}%`,
    },
  ], [isAr]);

  const supplierColumns = useMemo(() => [
    { key: 'nameAr', label: isAr ? 'المورد' : 'Supplier' },
    { key: 'totalInvoices', label: isAr ? 'إجمالي الفواتير' : 'Total invoices', numeric: true },
    { key: 'successInvoices', label: isAr ? 'نجاح' : 'Success', numeric: true },
    { key: 'failedInvoices', label: isAr ? 'فشل' : 'Failed', numeric: true },
    {
      key: 'successRate',
      label: isAr ? 'نسبة النجاح' : 'Success rate',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt(row.successRate || 0)}%`,
    },
    {
      key: 'avgSupplierConfidence',
      label: isAr ? 'ثقة اسم المورد' : 'Supplier confidence',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt((row.avgSupplierConfidence || 0) * 100)}%`,
    },
  ], [isAr]);

  const qualityFlagColumns = useMemo(() => [
    { key: 'flag', label: isAr ? 'مؤشر الجودة' : 'Quality flag' },
    { key: 'count', label: isAr ? 'التكرار' : 'Count', numeric: true },
    {
      key: 'rate',
      label: isAr ? 'النسبة' : 'Rate',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt(row.rate || 0)}%`,
    },
  ], [isAr]);

  const trendColumns = useMemo(() => [
    { key: 'date', label: isAr ? 'اليوم' : 'Day' },
    { key: 'total', label: isAr ? 'الإجمالي' : 'Total', numeric: true },
    { key: 'success', label: isAr ? 'نجاح' : 'Success', numeric: true },
    { key: 'failed', label: isAr ? 'فشل' : 'Failed', numeric: true },
    {
      key: 'successRate',
      label: isAr ? 'نسبة النجاح' : 'Success rate',
      numeric: true,
      render: (_: unknown, row: any) => `${fmt(row.successRate || 0)}%`,
    },
  ], [isAr]);

  return (
    <div className="flex flex-col gap-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="noorix-surface-card p-4 flex flex-wrap items-end gap-3">
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
        <Button size="sm" variant="primary" onClick={() => refetch()}>
          {isAr ? 'تحديث اللوحة' : 'Refresh dashboard'}
        </Button>
        <div className="text-[12px] text-noorix-muted">
          {isAr ? 'النطاق' : 'Range'}: {data?.range?.from || '—'} → {data?.range?.to || '—'}
        </div>
      </div>

      {isLoading && (
        <div className="text-[13px] text-noorix-muted">
          {isAr ? 'جاري تحميل لوحة التشغيل…' : 'Loading operations dashboard…'}
        </div>
      )}

      {!isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.key} className="noorix-surface-card p-4 flex flex-col gap-1">
                <span className="text-[12px] text-noorix-muted">{kpi.label}</span>
                <span className={`text-[22px] font-extrabold leading-none tabular-nums ltr ${kpi.color}`}>{kpi.value}</span>
                <span className="text-[11px] text-noorix-muted ltr">{kpi.hint}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SmartTable
              title={isAr ? 'أسباب الفشل' : 'Failure reasons'}
              columns={failureColumns}
              data={failureRows}
              total={failureRows.length}
              page={1}
              pageSize={failureRows.length || 1}
              emptyMessage={isAr ? 'لا توجد أسباب فشل في الفترة المحددة.' : 'No failure reasons in selected period.'}
              tableId="ocr-ops-failure-reasons"
            />
            <SmartTable
              title={isAr ? 'المحاولات حتى النجاح' : 'Attempts until success'}
              columns={attemptsColumns}
              data={data?.attemptsToSuccess || []}
              total={(data?.attemptsToSuccess || []).length}
              page={1}
              pageSize={(data?.attemptsToSuccess || []).length || 1}
              emptyMessage={isAr ? 'لا توجد بيانات محاولات نجاح.' : 'No attempts-to-success data.'}
              tableId="ocr-ops-attempts-success"
            />
          </div>

          <SmartTable
            title={isAr ? 'أداء النماذج' : 'Model performance'}
            columns={modelColumns}
            data={data?.models || []}
            total={(data?.models || []).length}
            page={1}
            pageSize={Math.max(1, (data?.models || []).length)}
            emptyMessage={isAr ? 'لا توجد محاولات نماذج في الفترة المحددة.' : 'No model attempts in selected period.'}
            tableId="ocr-ops-model-performance"
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SmartTable
              title={isAr ? 'مؤشرات الجودة الأكثر تكراراً' : 'Top quality flags'}
              columns={qualityFlagColumns}
              data={data?.topQualityFlags || []}
              total={(data?.topQualityFlags || []).length}
              page={1}
              pageSize={(data?.topQualityFlags || []).length || 1}
              emptyMessage={isAr ? 'لا توجد مؤشرات جودة في الفترة المحددة.' : 'No quality flags in selected period.'}
              tableId="ocr-ops-quality-flags"
            />
            <SmartTable
              title={isAr ? 'الاتجاه اليومي' : 'Daily trend'}
              columns={trendColumns}
              data={data?.dailyTrend || []}
              total={(data?.dailyTrend || []).length}
              page={1}
              pageSize={Math.max(1, (data?.dailyTrend || []).length)}
              emptyMessage={isAr ? 'لا توجد بيانات يومية في الفترة المحددة.' : 'No daily data in selected period.'}
              tableId="ocr-ops-daily-trend"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SmartTable
              title={isAr ? 'أداء الأصناف (الاستخراج والمطابقة)' : 'Item extraction & matching'}
              columns={itemColumns}
              data={data?.itemInsights || []}
              total={(data?.itemInsights || []).length}
              page={1}
              pageSize={Math.max(1, Math.min(20, (data?.itemInsights || []).length || 1))}
              emptyMessage={isAr ? 'لا توجد بيانات أصناف في الفترة المحددة.' : 'No item data in selected period.'}
              tableId="ocr-ops-items"
            />
            <SmartTable
              title={isAr ? 'استقرار الموردين' : 'Supplier stability'}
              columns={supplierColumns}
              data={data?.supplierInsights || []}
              total={(data?.supplierInsights || []).length}
              page={1}
              pageSize={Math.max(1, Math.min(20, (data?.supplierInsights || []).length || 1))}
              emptyMessage={isAr ? 'لا توجد بيانات موردين في الفترة المحددة.' : 'No supplier data in selected period.'}
              tableId="ocr-ops-suppliers"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="noorix-surface-card p-4 flex flex-col gap-1">
              <span className="text-[12px] text-noorix-muted">{isAr ? 'سجلات مطابقة الموردين' : 'Supplier matching logs'}</span>
              <span className="text-[20px] font-bold tabular-nums ltr">{fmt(data?.matching?.supplierLogsCount || 0, 0)}</span>
              <span className="text-[11px] text-noorix-muted ltr">{fmt(data?.matching?.supplierResolutionRate || 0)}%</span>
            </div>
            <div className="noorix-surface-card p-4 flex flex-col gap-1">
              <span className="text-[12px] text-noorix-muted">{isAr ? 'سجلات مطابقة الأصناف' : 'Item matching logs'}</span>
              <span className="text-[20px] font-bold tabular-nums ltr">{fmt(data?.matching?.itemLogsCount || 0, 0)}</span>
              <span className="text-[11px] text-noorix-muted ltr">{fmt(data?.matching?.itemResolutionRate || 0)}%</span>
            </div>
            <div className="noorix-surface-card p-4 flex flex-col gap-1">
              <span className="text-[12px] text-noorix-muted">{isAr ? 'زمن المحاولة (P95 ms)' : 'Attempt latency (P95 ms)'}</span>
              <span className="text-[20px] font-bold tabular-nums ltr">{fmt(summary.p95AttemptLatencyMs || 0)}</span>
              <span className="text-[11px] text-noorix-muted ltr">{isAr ? 'متوسط' : 'Avg'}: {fmt(summary.avgAttemptLatencyMs || 0)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
