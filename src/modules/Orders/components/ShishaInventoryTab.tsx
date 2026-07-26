import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  useCreateShishaPurchaseMutation,
  useCreateShishaStocktakeMutation,
  useInitializeShishaInventoryMutation,
  useShishaInventory,
} from '../../../hooks/useOrders';
import { useTranslation } from '../../../i18n/useTranslation';
import type {
  CreateShishaPurchasePayload,
  CreateShishaStocktakePayload,
  InitializeShishaInventoryPayload,
  ShishaInventoryDailyRow,
} from '../../../types/api';
import { AdaptiveSheet, Badge, Button, DateField, DateFilterBar, DialogActions, Input, MetricCard, SimpleTable, Spinner } from '../../../ui';
import type { ShishaInventoryMovement } from '../../../types/api';
import type { SimpleTableColumn } from '../../../ui';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';

type FormKind = 'opening' | 'purchase' | 'stocktake' | null;
const num = (value: number | string | null | undefined, digits = 3) =>
  Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits });

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
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
  }), { operations: 0, newShisha: 0, changes: 0, heads: 0, consumedKg: 0, hoses: 0, purchasedKg: 0 }), [rows]);
  const columns = useMemo<SimpleTableColumn<ShishaInventoryDailyRow>[]>(() => [
    { key: 'date', label: 'التاريخ', minWidth: 110, render: (_v, row) => formatSaudiDate(row.date) },
    { key: 'operations', label: 'العمليات', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'newShisha', label: 'شيشة جديدة', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'changes', label: 'تغيير', numeric: true, cellClassName: 'text-amber-600', render: (v) => num(v as number, 0) },
    { key: 'tobaccoHeadsConsumed', label: 'الرؤوس المحتسبة', numeric: true, cellClassName: 'font-bold text-noorix-blue', render: (v) => num(v as number, 0) },
    { key: 'tobaccoConsumedKg', label: 'المعسل المستهلك كجم', numeric: true, render: (v) => num(v as number) },
    { key: 'hosesConsumed', label: 'الليات المستهلكة', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'tobaccoPurchasedKg', label: 'مشتريات المعسل كجم', numeric: true, cellClassName: 'text-emerald-600', render: (v) => num(v as number) },
    { key: 'openingTobaccoKg', label: 'مخزون أول اليوم كجم', numeric: true, render: (v) => num(v as number) },
    { key: 'closingTobaccoKg', label: 'مخزون آخر اليوم كجم', numeric: true, cellClassName: 'font-bold', render: (v) => num(v as number) },
    { key: 'closingTobaccoHeads', label: 'يكفي رؤوس', numeric: true, render: (v) => num(v as number, 0) },
    { key: 'closingHoses', label: 'الليات آخر اليوم', numeric: true, render: (v) => num(v as number, 0) },
  ], []);
  return <div className="space-y-2">
    <SimpleTable columns={columns} data={rows} tableMinWidth={1180} emptyMessage="لا توجد بيانات في الفترة المحددة." stickyHeader />
    <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-noorix-bg-muted px-4 py-3 text-[12px] font-bold">
      <span>المجموع:</span><span>العمليات {num(totals.operations, 0)}</span><span>الجديدة {num(totals.newShisha, 0)}</span>
      <span>التغيير {num(totals.changes, 0)}</span><span>الرؤوس {num(totals.heads, 0)}</span>
      <span>المعسل {num(totals.consumedKg)} كجم</span><span>الليات {num(totals.hoses, 0)}</span>
      <span>المشتريات {num(totals.purchasedKg)} كجم</span>
    </div>
  </div>;
}

function MovementTable({ rows }: { rows: ShishaInventoryMovement[] }) {
  const columns = useMemo<SimpleTableColumn<ShishaInventoryMovement>[]>(() => [
    { key: 'transactionDate', label: 'التاريخ', render: (v) => formatSaudiDate(String(v)) },
    { key: 'movementType', label: 'نوع العملية', render: (v) => v === 'opening' ? 'رصيد افتتاحي' : v === 'purchase' ? 'شراء' : 'تصحيح جرد' },
    { key: 'materialType', label: 'المادة', render: (v) => v === 'tobacco' ? 'معسل (جرام)' : v === 'hose' ? 'ليات (حبة)' : 'فحم (حبة)' },
    { key: 'quantityBase', label: 'الكمية الأساسية', numeric: true, cellClassName: 'font-semibold', render: (v) => num(v as string) },
    { key: 'costInclVat', label: 'التكلفة', numeric: true, render: (v) => v == null ? '—' : `${num(v as string, 2)} ر.س` },
    { key: 'invoiceNumber', label: 'الفاتورة', render: (v) => String(v || '—') },
    { key: 'createdBy', label: 'بواسطة', render: (_v, row) => row.createdBy?.nameAr || row.createdBy?.nameEn || '—' },
  ], []);
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
  const [form, setForm] = useState<FormKind>(null);
  const [openingDate, setOpeningDate] = useState(normalizedEndDate);
  const [purchaseDate, setPurchaseDate] = useState(normalizedEndDate);
  const [stocktakeDate, setStocktakeDate] = useState(normalizedEndDate);
  const [purchaseMaterial, setPurchaseMaterial] = useState<CreateShishaPurchasePayload['materialType']>('tobacco');
  const [purchaseUnit, setPurchaseUnit] = useState<CreateShishaPurchasePayload['unit']>('kg');
  useEffect(() => {
    if (form) return;
    setOpeningDate(normalizedEndDate);
    setPurchaseDate(normalizedEndDate);
    setStocktakeDate(normalizedEndDate);
  }, [form, normalizedEndDate]);
  const { data, isLoading, error } = useShishaInventory(companyId, normalizedStartDate, normalizedEndDate);
  const initialize = useInitializeShishaInventoryMutation();
  const purchase = useCreateShishaPurchaseMutation();
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
  const submitPurchase = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const v = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body: CreateShishaPurchasePayload = {
      companyId, transactionDate: purchaseDate, materialType: v.materialType as CreateShishaPurchasePayload['materialType'],
      quantity: v.quantity, unit: v.unit as CreateShishaPurchasePayload['unit'], costInclVat: v.costInclVat || undefined,
      invoiceNumber: v.invoiceNumber || undefined, supplierName: v.supplierName || undefined, notes: v.notes || undefined,
    };
    purchase.mutate(body, { onSuccess: () => setForm(null) });
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
          {initialized && <Button variant="primary" onClick={() => setForm('purchase')}>تسجيل شراء</Button>}
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
          <MetricCard color="#0891b2" className="min-h-[132px]"><MetricCard.Header label="الليات المتوفرة" subLabel="لي واحد لكل رأس، ويشمل التغيير" /><MetricCard.Value value={num(current?.hoses, 0)} currency="لي" /></MetricCard>
          <MetricCard color="#ea580c" className="min-h-[132px]"><MetricCard.Header label="الفحم المتوفر" subLabel={`${num(current?.charcoalPiecesTotal, 0)} حبة`} /><MetricCard.Value value={`${num(current?.charcoalCartons, 0)} كرتون`} /><MetricCard.Footer className="mt-auto border-t border-noorix-border py-2 text-[11px] text-noorix-muted"><span>{num(current?.charcoalPacks, 0)} باكت</span><span>{num(current?.charcoalPieces, 0)} حبة</span></MetricCard.Footer></MetricCard>
          <MetricCard color="#16a34a" className="min-h-[132px]"><MetricCard.Header label="استهلاك الفترة" subLabel={`${num(data?.periodTotals?.changes, 0)} تغيير`} /><MetricCard.Value value={num(data?.periodTotals?.tobaccoHeadsConsumed, 0)} currency="رأس" /><MetricCard.Footer className="mt-auto border-t border-noorix-border py-2 text-[11px] text-noorix-muted"><span>معسل</span><span>{num(data?.periodTotals?.tobaccoConsumedKg)} كجم</span></MetricCard.Footer></MetricCard>
          <MetricCard color="#ca8a04" className="min-h-[132px]"><MetricCard.Header label="متوسط تكلفة المعسل" subLabel={current?.averageCostPerGram == null ? 'أدخل تكلفة المشتريات لحسابها' : `${num(current.averageCostPerGram, 4)} ر.س/جرام`} /><MetricCard.Value value={current?.averageCostPerHead == null ? '—' : num(current.averageCostPerHead, 2)} currency={current?.averageCostPerHead == null ? undefined : 'ر.س/رأس'} /></MetricCard>
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
        <FieldGrid><DateField label="تاريخ بداية التتبع" value={openingDate} onValueChange={setOpeningDate} required /><Input name="headsPerKg" type="number" label="متوسط الرؤوس لكل كيلو" defaultValue="39" min="1" step="0.01" required /><Input name="tobaccoQuantity" type="number" label="المعسل (كجم)" defaultValue="15" min="0" step="0.001" required /><Input name="hoses" type="number" label="الليات (حبة)" defaultValue="0" min="0" step="1" required /><Input name="charcoalCartons" type="number" label="الفحم (كرتون)" defaultValue="0" min="0" step="1" required /><Input name="charcoalPacks" type="number" label="الفحم (باكت)" defaultValue="0" min="0" step="1" required /><Input name="charcoalPieces" type="number" label="الفحم (حبة)" defaultValue="0" min="0" step="1" required /><Input name="tobaccoCostInclVat" type="number" label="تكلفة المعسل شاملة الضريبة (اختياري)" min="0" step="0.01" /><Input name="hoseCostInclVat" type="number" label="تكلفة الليات شاملة الضريبة (اختياري)" min="0" step="0.01" /><Input name="charcoalCostInclVat" type="number" label="تكلفة الفحم شاملة الضريبة (اختياري)" min="0" step="0.01" /></FieldGrid>
        <Input name="notes" label="ملاحظات" multiline rows={2} /><DialogActions actions={[{ key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setForm(null) }, { key: 'save', label: 'اعتماد مخزون البداية', role: 'save', type: 'submit', loading: initialize.isPending }]} />
      </form></AdaptiveSheet>
      <AdaptiveSheet open={form === 'purchase'} onClose={() => setForm(null)} title="تسجيل شراء للمخزون" size="lg"><form onSubmit={submitPurchase} className="space-y-4">
        <FieldGrid><DateField label="تاريخ الشراء" value={purchaseDate} onValueChange={setPurchaseDate} required /><Input name="materialType" type="select" label="المادة" value={purchaseMaterial} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => { const material = event.target.value as CreateShishaPurchasePayload['materialType']; setPurchaseMaterial(material); const unit = material === 'tobacco' ? 'kg' : 'piece'; setPurchaseUnit(unit); }} required><option value="tobacco">معسل</option><option value="hose">ليات</option><option value="charcoal">فحم</option></Input><Input name="quantity" type="number" label="الكمية" min="0.001" step="0.001" required /><Input name="unit" type="select" label="الوحدة" value={purchaseUnit} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPurchaseUnit(event.target.value as CreateShishaPurchasePayload['unit'])} required>{purchaseMaterial === 'tobacco' && <><option value="kg">كيلو</option><option value="g">جرام</option></>}{purchaseMaterial === 'hose' && <option value="piece">حبة</option>}{purchaseMaterial === 'charcoal' && <><option value="piece">حبة</option><option value="pack">باكت</option><option value="carton">كرتون</option></>}</Input><Input name="costInclVat" type="number" label="التكلفة شاملة الضريبة" min="0" step="0.01" /><Input name="invoiceNumber" label="رقم الفاتورة" /><Input name="supplierName" label="المورد" /></FieldGrid>
        <Input name="notes" label="ملاحظات" multiline rows={2} /><DialogActions actions={[{ key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setForm(null) }, { key: 'save', label: 'تسجيل الشراء', role: 'save', type: 'submit', loading: purchase.isPending }]} />
      </form></AdaptiveSheet>
      <AdaptiveSheet open={form === 'stocktake'} onClose={() => setForm(null)} title="الجرد واعتماد التصحيح" size="lg"><form onSubmit={submitStocktake} className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800">أدخل الكميات الفعلية. سيحسب نوركس الفرق عن الرصيد الدفتري ويسجله كعملية تصحيح مستقلة غير قابلة للتعديل.</div>
        <FieldGrid><DateField label="تاريخ الجرد" value={stocktakeDate} onValueChange={setStocktakeDate} required /><Input name="tobaccoQuantity" type="number" label="المعسل الفعلي (كجم)" min="0" step="0.001" required /><Input name="hoses" type="number" label="الليات الفعلية (حبة)" min="0" step="1" required /><Input name="charcoalCartons" type="number" label="الفحم الفعلي (كرتون)" min="0" step="1" required /><Input name="charcoalPacks" type="number" label="الفحم الفعلي (باكت)" min="0" step="1" required /><Input name="charcoalPieces" type="number" label="الفحم الفعلي (حبة)" min="0" step="1" required /></FieldGrid>
        <Input name="notes" label="سبب أو ملاحظات الجرد" multiline rows={2} required /><DialogActions actions={[{ key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setForm(null) }, { key: 'save', label: 'اعتماد الجرد والتصحيح', role: 'save', type: 'submit', loading: stocktake.isPending }]} />
      </form></AdaptiveSheet>
    </div>
  );
}
