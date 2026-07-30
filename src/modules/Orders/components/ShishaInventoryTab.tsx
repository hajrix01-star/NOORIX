import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  useCreateShishaStocktakeMutation,
  useInitializeShishaInventoryMutation,
  useShishaInventory,
} from '../../../hooks/useOrders';
import { useTranslation } from '../../../i18n/useTranslation';
import type {
  CreateShishaStocktakePayload,
  InitializeShishaInventoryPayload,
  ShishaInventoryDailyRow,
} from '../../../types/api';
import { AdaptiveSheet, Badge, Button, DateField, DateFilterBar, DialogActions, Input, MetricCard, SimpleTable, Spinner } from '../../../ui';
import type { ShishaInventoryMovement } from '../../../types/api';
import type { SimpleTableColumn } from '../../../ui';
import { formatSaudiDate, getSaudiToday, toYmd } from '../../../utils/saudiDate';

type FormKind = 'opening' | 'stocktake' | null;
const num = (value: number | string | null | undefined, digits = 1) =>
  Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const centerColumns = <TRow extends object>(columns: SimpleTableColumn<TRow>[]): SimpleTableColumn<TRow>[] =>
  columns.map((column) => ({ align: 'center', ...column }));
const centeredFieldClassName = 'text-center';

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function CenteredInput(props: React.ComponentProps<typeof Input>) {
  const { className = '', ...rest } = props;
  return <Input {...rest} className={`${centeredFieldClassName} ${className}`.trim()} />;
}

function CharcoalDailyAlert({ row }: { row: ShishaInventoryDailyRow }) {
  if (row.charcoalStatus === 'missing_actual') {
    return <Badge color="red" size="sm">لم يسجل الموظف الفحم</Badge>;
  }
  if (row.charcoalStatus === 'matched') {
    return <Badge color="green" size="sm">مطابق</Badge>;
  }
  if (row.charcoalStatus === 'over') {
    return <Badge color="red" size="sm">زائد {num(row.charcoalVarianceBoxes)} علبة</Badge>;
  }
  if (row.charcoalStatus === 'under') {
    return <Badge color="amber" size="sm">أقل {num(Math.abs(row.charcoalVarianceBoxes ?? 0))} علبة</Badge>;
  }
  if (row.charcoalStatus === 'legacy_expected') {
    return <Badge color="blue" size="sm">حساب نظامي سابق</Badge>;
  }
  return <Badge color="gray" size="sm">لا يوجد نشاط</Badge>;
}

function InventoryTable({ rows }: { rows: ShishaInventoryDailyRow[] }) {
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    operations: sum.operations + row.operations,
    newShisha: sum.newShisha + row.newShisha,
    changes: sum.changes + row.changes,
    heads: sum.heads + row.tobaccoHeadsConsumed,
    consumedKg: sum.consumedKg + row.tobaccoConsumedKg,
    hoses: sum.hoses + row.hosesConsumed,
    purchasedKg: sum.purchasedKg + row.tobaccoPurchasedKg,
    charcoalPurchased: sum.charcoalPurchased + row.charcoalPurchasedBoxes,
    charcoalConsumed: sum.charcoalConsumed + row.charcoalConsumedBoxes,
    charcoalExpected: sum.charcoalExpected + (
      row.charcoalStatus === 'legacy_expected' ? 0 : row.charcoalExpectedBoxes
    ),
    charcoalActual: sum.charcoalActual + (row.charcoalActualBoxes ?? 0),
    charcoalAlerts: sum.charcoalAlerts + (['missing_actual', 'over', 'under'].includes(row.charcoalStatus) ? 1 : 0),
  }), {
    operations: 0,
    newShisha: 0,
    changes: 0,
    heads: 0,
    consumedKg: 0,
    hoses: 0,
    purchasedKg: 0,
    charcoalPurchased: 0,
    charcoalConsumed: 0,
    charcoalExpected: 0,
    charcoalActual: 0,
    charcoalAlerts: 0,
  }), [rows]);
  const columns = useMemo<SimpleTableColumn<ShishaInventoryDailyRow>[]>(() => centerColumns([
    { key: 'date', label: 'التاريخ', minWidth: 110, render: (_v, row) => formatSaudiDate(row.date) },
    { key: 'operations', label: 'العمليات', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'newShisha', label: 'شيشة جديدة', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'changes', label: 'تغيير', numeric: true, cellClassName: 'text-amber-600', render: (v) => num(v as number, 0) },
    { key: 'tobaccoHeadsConsumed', label: 'الرؤوس المحتسبة', numeric: true, cellClassName: 'font-bold text-noorix-blue', render: (v) => num(v as number, 0) },
    { key: 'tobaccoConsumedKg', label: 'المعسل المستهلك كجم', numeric: true, render: (v) => num(v as number) },
    { key: 'hosesConsumed', label: 'الليات المستهلكة', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'tobaccoPurchasedKg', label: 'مشتريات المعسل كجم', numeric: true, cellClassName: 'text-emerald-600', render: (v) => num(v as number) },
    { key: 'charcoalPurchasedBoxes', label: 'مشتريات الفحم علبة', numeric: true, cellClassName: 'text-emerald-600', render: (v) => num(v as number) },
    { key: 'charcoalExpectedBoxes', label: 'الفحم المتوقع علبة', numeric: true, render: (v) => num(v as number) },
    { key: 'charcoalActualBoxes', label: 'الفحم الفعلي علبة', numeric: true, cellClassName: 'font-bold text-orange-600', render: (v) => v == null ? '—' : num(v as number) },
    { key: 'charcoalVarianceBoxes', label: 'فرق الفحم علبة', numeric: true, render: (v) => v == null ? '—' : num(v as number) },
    { key: 'charcoalStatus', label: 'تنبيه الفحم اليومي', minWidth: 165, render: (_v, row) => <CharcoalDailyAlert row={row} /> },
    { key: 'charcoalConsumedBoxes', label: 'المخصوم من المخزون علبة', numeric: true, cellClassName: 'text-orange-600', render: (v) => num(v as number) },
    { key: 'openingTobaccoKg', label: 'مخزون أول اليوم كجم', numeric: true, render: (v) => num(v as number) },
    { key: 'closingTobaccoKg', label: 'مخزون آخر اليوم كجم', numeric: true, cellClassName: 'font-bold', render: (v) => num(v as number) },
    { key: 'closingTobaccoHeads', label: 'يكفي رؤوس', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'closingHoses', label: 'الليات آخر اليوم', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'openingCharcoalBoxes', label: 'الفحم أول اليوم علبة', numeric: true, render: (v) => num(v as number) },
    { key: 'closingCharcoalBoxes', label: 'الفحم آخر اليوم علبة', numeric: true, cellClassName: 'font-bold', render: (v) => num(v as number) },
  ]), []);
  return <div className="space-y-2">
    <SimpleTable columns={columns} data={rows} tableMinWidth={2050} emptyMessage="لا توجد بيانات في الفترة المحددة." stickyHeader />
    <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-noorix-bg-muted px-4 py-3 text-[12px] font-bold">
      <span>المجموع:</span><span>العمليات {num(totals.operations, 0)}</span><span>الجديدة {num(totals.newShisha, 0)}</span>
      <span>التغيير {num(totals.changes, 0)}</span><span>الرؤوس {num(totals.heads, 0)}</span>
      <span>المعسل {num(totals.consumedKg)} كجم</span><span>الليات {num(totals.hoses, 0)}</span>
      <span>المشتريات {num(totals.purchasedKg)} كجم</span>
      <span>الفحم المشترى {num(totals.charcoalPurchased)} علبة</span>
      <span>الفحم المتوقع {num(totals.charcoalExpected)} علبة</span>
      <span>الفحم الفعلي المسجل {num(totals.charcoalActual)} علبة</span>
      <span>المخصوم من المخزون {num(totals.charcoalConsumed)} علبة</span>
      <span className={totals.charcoalAlerts > 0 ? 'text-red-600' : 'text-emerald-600'}>أيام التنبيه {num(totals.charcoalAlerts, 0)}</span>
    </div>
  </div>;
}

function MovementTable({ rows }: { rows: ShishaInventoryMovement[] }) {
  const columns = useMemo<SimpleTableColumn<ShishaInventoryMovement>[]>(() => centerColumns([
    { key: 'transactionDate', label: 'التاريخ', render: (v) => formatSaudiDate(String(v)) },
    { key: 'movementType', label: 'نوع العملية', render: (v) => v === 'opening' ? 'رصيد افتتاحي' : v === 'purchase' ? 'شراء' : 'تصحيح جرد' },
    { key: 'materialType', label: 'المادة', render: (v) => v === 'tobacco' ? 'معسل (جرام)' : v === 'hose' ? 'ليات (حبة)' : 'فحم (حبة)' },
    { key: 'quantityBase', label: 'الكمية', numeric: true, cellClassName: 'font-semibold', render: (v, row) => row.materialType === 'charcoal' ? `${num(Number(v) / 64)} علبة (${num(v as string, 0)} حبة)` : num(v as string) },
    { key: 'costInclVat', label: 'التكلفة', numeric: true, render: (v) => v == null ? '—' : `${num(v as string)} ر.س` },
    { key: 'invoiceNumber', label: 'الفاتورة', render: (v) => String(v || '—') },
    {
      key: 'createdBy',
      label: 'بواسطة',
      render: (_v, row) => row.source === 'order_catalog'
        ? 'الطلبات (آلي)'
        : row.createdBy?.nameAr || row.createdBy?.nameEn || '—',
    },
  ]), []);
  return <SimpleTable columns={columns} data={rows} tableMinWidth={760} emptyMessage="لا توجد حركات في الفترة المحددة." />;
}

export function ShishaInventoryTab({ companyId, startDate, endDate, dateFilter }: {
  companyId: string;
  startDate: string;
  endDate: string;
  dateFilter: React.ComponentProps<typeof DateFilterBar>['filter'];
}) {
  const { t } = useTranslation();
  const { userPermissions = [] } = useApp();
  const canWrite = userPermissions.includes('ORDERS_WRITE');
  const normalizedStartDate = toYmd(startDate);
  const normalizedEndDate = toYmd(endDate);
  const today = getSaudiToday();
  const [form, setForm] = useState<FormKind>(null);
  const [openingDate, setOpeningDate] = useState(today);
  const [stocktakeDate, setStocktakeDate] = useState(today);
  const { data, isLoading, error } = useShishaInventory(companyId, normalizedStartDate, normalizedEndDate);
  const initialize = useInitializeShishaInventoryMutation();
  const stocktake = useCreateShishaStocktakeMutation();
  const initialized = Boolean(data?.initialized);
  const current = data?.current;

  const submitOpening = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const v = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body: InitializeShishaInventoryPayload = {
      companyId, startDate: openingDate, headsPerKg: v.headsPerKg, tobaccoQuantity: v.tobaccoQuantity,
      tobaccoUnit: 'kg', hoses: v.hoses, charcoalCartons: v.charcoalCartons, charcoalPacks: v.charcoalPacks,
      charcoalPieces: v.charcoalPieces, tobaccoCostInclVat: v.tobaccoCostInclVat || undefined,
      hoseCostInclVat: v.hoseCostInclVat || undefined, charcoalCostInclVat: v.charcoalCostInclVat || undefined,
      notes: v.notes || undefined,
    };
    initialize.mutate(body, { onSuccess: () => setForm(null) });
  };
  const submitStocktake = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const v = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body: CreateShishaStocktakePayload = {
      companyId, stocktakeDate, tobaccoQuantity: v.tobaccoQuantity, tobaccoUnit: 'kg',
      hoses: v.hoses, charcoalCartons: v.charcoalCartons, charcoalPacks: v.charcoalPacks,
      charcoalPieces: v.charcoalPieces, notes: v.notes || undefined,
    };
    stocktake.mutate(body, { onSuccess: () => setForm(null) });
  };

  if (isLoading) return <div className="flex min-h-[240px] items-center justify-center"><Spinner /></div>;
  if (error) return <div className="noorix-surface-card nx-empty-state text-red-600">{error.message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DateFilterBar filter={dateFilter} className="min-w-0 flex-1" />
        {canWrite && <div className="flex flex-wrap gap-2">
          {!initialized && <Button variant="primary" onClick={() => setForm('opening')}>تسجيل مخزون البداية</Button>}
          {initialized && <Button variant="default" onClick={() => setForm('stocktake')}>جرد وتصحيح</Button>}
        </div>}
      </div>

      {!initialized ? <div className="noorix-surface-card px-6 py-12 text-center">
        <div className="text-[17px] font-bold text-noorix-text">لم يبدأ تتبع مخزون الشيشة بعد</div>
        <div className="mt-2 text-[13px] text-noorix-muted">يسجل مخزون البداية مرة واحدة، وبعدها لا يتغير الرصيد يدوياً؛ كل تعديل يتم بحركة شراء أو جرد معتمدة.</div>
      </div> : <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard color="#2563eb" className="min-h-[132px]"><MetricCard.Header label="المعسل المتوفر" subLabel={`${num(current?.tobaccoGrams, 0)} جرام`} /><MetricCard.Value value={num(current?.tobaccoKg)} currency="كجم" /><MetricCard.Footer className="mt-auto border-t border-noorix-border py-2 text-[11px] text-noorix-muted"><span>المتوسط</span><span>{num(data?.settings?.headsPerKg, 0)} رأس/كجم</span></MetricCard.Footer></MetricCard>
          <MetricCard color="#7c3aed" className="min-h-[132px]"><MetricCard.Header label="الرؤوس المتاحة" subLabel="حسب كمية المعسل فقط" /><MetricCard.Value value={num(current?.tobaccoHeads, 0)} currency="رأس" /></MetricCard>
          <MetricCard color="#0891b2" className="min-h-[132px]"><MetricCard.Header label="الليات المتوفرة" subLabel="لي واحد لكل شيشة جديدة فقط" /><MetricCard.Value value={num(current?.hoses, 0)} currency="لي" /></MetricCard>
          <MetricCard color="#ea580c" className="min-h-[132px]"><MetricCard.Header label="الفحم المتوفر" subLabel={`${num(current?.charcoalPiecesTotal, 0)} حبة`} /><MetricCard.Value value={num(current?.charcoalBoxesTotal)} currency="علبة" /><MetricCard.Footer className="mt-auto border-t border-noorix-border py-2 text-[11px] text-noorix-muted"><span>64 حبة/علبة</span><span>علبة لكل 6 رؤوس</span></MetricCard.Footer></MetricCard>
          <MetricCard color="#16a34a" className="min-h-[132px]"><MetricCard.Header label="استهلاك الفترة" subLabel={`${num(data?.periodTotals?.changes, 0)} تغيير`} /><MetricCard.Value value={num(data?.periodTotals?.tobaccoHeadsConsumed, 0)} currency="رأس" /><MetricCard.Footer className="mt-auto border-t border-noorix-border py-2 text-[11px] text-noorix-muted"><span>معسل</span><span>{num(data?.periodTotals?.tobaccoConsumedKg)} كجم</span></MetricCard.Footer></MetricCard>
          <MetricCard color="#ca8a04" className="min-h-[132px]"><MetricCard.Header label="متوسط تكلفة المعسل" subLabel={current?.averageCostPerGram == null ? 'أدخل تكلفة المشتريات لحسابها' : `${num(current.averageCostPerGram)} ر.س/جرام`} /><MetricCard.Value value={current?.averageCostPerHead == null ? '—' : num(current.averageCostPerHead)} currency={current?.averageCostPerHead == null ? undefined : 'ر.س/رأس'} /></MetricCard>
        </div>
        <div className={`noorix-surface-card flex flex-col gap-3 border-s-4 p-4 ${
          (data?.periodTotals?.charcoalAlertDays ?? 0) > 0 ? 'border-s-red-500' : 'border-s-emerald-500'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[14px] font-bold text-noorix-text">حاسبة الفحم اليومية</div>
              <div className="mt-0.5 text-[11px] text-noorix-muted">
                المتوقع = رؤوس الشيشة ÷ 6، والخصم من المخزون يعتمد على صنف «استهلاك الفحم الفعلي» الذي يسجله الموظف.
              </div>
            </div>
            {(data?.periodTotals?.charcoalAlertDays ?? 0) > 0
              ? <Badge color="red">{num(data?.periodTotals?.charcoalAlertDays, 0)} يوم يحتاج مراجعة</Badge>
              : <Badge color="green">الاستهلاك اليومي مطابق</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
            <span>المتوقع: <strong>{num(data?.periodTotals?.charcoalExpectedBoxes)} علبة</strong></span>
            <span>الفعلي المسجل: <strong>{num(data?.periodTotals?.charcoalActualBoxes)} علبة</strong></span>
            <span>الفرق: <strong>{num(data?.periodTotals?.charcoalVarianceBoxes)} علبة</strong></span>
            <span className={(data?.periodTotals?.charcoalMissingDays ?? 0) > 0 ? 'text-red-600' : 'text-noorix-muted'}>
              أيام بدون تسجيل: <strong>{num(data?.periodTotals?.charcoalMissingDays, 0)}</strong>
            </span>
            {data?.settings?.charcoalActualTrackingStartDate && (
              <span className="text-noorix-muted">
                بداية المقارنة الفعلية: <strong>{formatSaudiDate(data.settings.charcoalActualTrackingStartDate)}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-[15px] font-bold text-noorix-text">التقرير اليومي للمخزون والاستهلاك</h3><p className="mt-0.5 text-[11px] text-noorix-muted">المخزون محسوب آلياً من الحركات المعتمدة وتسجيلات قسم الشيشة.</p></div><Badge color="gray">سجل غير قابل للتعديل</Badge></div>
        <InventoryTable rows={data?.daily ?? []} />
        <div className="noorix-surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-noorix-border px-4 py-3"><div><div className="text-[14px] font-bold">سجل الحركات</div><div className="text-[11px] text-noorix-muted">لا يوجد تعديل أو حذف؛ الجرد ينشئ عملية تصحيح موثقة.</div></div>{data?.latestStocktake && <Badge color="green">آخر جرد: {formatSaudiDate(data.latestStocktake.stocktakeDate)}</Badge>}</div>
          <MovementTable rows={data?.movements ?? []} />
        </div>
      </>}

      <AdaptiveSheet open={form === 'opening'} onClose={() => setForm(null)} title="تسجيل مخزون البداية" size="lg"><form onSubmit={submitOpening} className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">هذه العملية تنفذ مرة واحدة ولا يمكن تعديلها لاحقاً. تأكد من الكميات قبل الحفظ.</div>
        <FieldGrid><DateField className={centeredFieldClassName} label="تاريخ بداية التتبع" value={openingDate} onValueChange={setOpeningDate} max={today} required /><CenteredInput name="headsPerKg" type="number" label="متوسط الرؤوس لكل كيلو" defaultValue="39" min="1" step="0.01" required /><CenteredInput name="tobaccoQuantity" type="number" label="المعسل (كجم)" defaultValue="15" min="0" step="0.001" required /><CenteredInput name="hoses" type="number" label="الليات (حبة)" defaultValue="0" min="0" step="1" required /><CenteredInput name="charcoalCartons" type="number" label="الفحم (كرتون)" defaultValue="0" min="0" step="1" required /><CenteredInput name="charcoalPacks" type="number" label="الفحم (علبة)" defaultValue="0" min="0" step="0.25" required /><CenteredInput name="charcoalPieces" type="number" label="الفحم (حبة)" defaultValue="0" min="0" step="1" required /><CenteredInput name="tobaccoCostInclVat" type="number" label="تكلفة المعسل شاملة الضريبة (اختياري)" min="0" step="0.01" /><CenteredInput name="hoseCostInclVat" type="number" label="تكلفة الليات شاملة الضريبة (اختياري)" min="0" step="0.01" /><CenteredInput name="charcoalCostInclVat" type="number" label="تكلفة الفحم شاملة الضريبة (اختياري)" min="0" step="0.01" /></FieldGrid>
        <CenteredInput name="notes" label="ملاحظات" multiline rows={2} /><DialogActions actions={[{ key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setForm(null) }, { key: 'save', label: 'اعتماد مخزون البداية', role: 'save', type: 'submit', loading: initialize.isPending }]} />
      </form></AdaptiveSheet>
      <AdaptiveSheet open={form === 'stocktake'} onClose={() => setForm(null)} title="الجرد واعتماد التصحيح" size="lg"><form onSubmit={submitStocktake} className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800">أدخل الكميات الفعلية. سيحسب نوركس الفرق عن الرصيد الدفتري ويسجله كعملية تصحيح مستقلة غير قابلة للتعديل.</div>
        <FieldGrid><DateField className={centeredFieldClassName} label="تاريخ الجرد" value={stocktakeDate} onValueChange={setStocktakeDate} max={today} required /><CenteredInput name="tobaccoQuantity" type="number" label="المعسل الفعلي (كجم)" min="0" step="0.001" required /><CenteredInput name="hoses" type="number" label="الليات الفعلية (حبة)" min="0" step="1" required /><CenteredInput name="charcoalCartons" type="number" label="الفحم الفعلي (كرتون)" min="0" step="1" required /><CenteredInput name="charcoalPacks" type="number" label="الفحم الفعلي (علبة)" min="0" step="0.25" required /><CenteredInput name="charcoalPieces" type="number" label="الفحم الفعلي (حبة)" min="0" step="1" required /></FieldGrid>
        <CenteredInput name="notes" label="سبب أو ملاحظات الجرد" multiline rows={2} required /><DialogActions actions={[{ key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setForm(null) }, { key: 'save', label: 'اعتماد الجرد والتصحيح', role: 'save', type: 'submit', loading: stocktake.isPending }]} />
      </form></AdaptiveSheet>
    </div>
  );
}
