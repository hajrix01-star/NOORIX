import React, { useMemo, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4DataQuality, OrdersV4InventoryBalance, OrdersV4LedgerEntry, OrdersV4Stocktake } from '../../../types/api';
import { Button, DialogActions, Input, Modal, ScreenTabs, type SimpleTableColumn, TransactionDatePicker } from '../../../ui';
import { getSaudiToday } from '../../../utils/saudiDate';
import { OrdersV4Field, OrdersV4Kpi, OrdersV4Panel, OrdersV4QueryState, OrdersV4Select, OrdersV4Table as SimpleTable, v4Date, v4Number } from '../OrdersV4Shared';
import { useCreateOrdersV4Stocktake, useOrdersV4Balances, useOrdersV4DataQuality, useOrdersV4Ledger, useOrdersV4Stocktakes } from '../useOrdersV4';
import { ordersV4CompositeQuantity, ordersV4UnitFactorToBase } from './ordersV4ItemDefinition.utils';

export function OrdersV4InventoryTab({ companyId, bootstrap, canWrite = false }: { companyId: string; bootstrap?: OrdersV4Bootstrap; canWrite?: boolean }) {
  const [tab, setTab] = useState('balances');
  const balancesQuery = useOrdersV4Balances(companyId);
  const ledgerQuery = useOrdersV4Ledger(companyId);
  const stocktakesQuery = useOrdersV4Stocktakes(companyId);
  const qualityQuery = useOrdersV4DataQuality(companyId);
  const [stocktakeOpen, setStocktakeOpen] = useState(false);
  const balances = balancesQuery.data ?? [];
  const totals = useMemo(() => balances.reduce((acc, row) => ({ value: acc.value + Number(row.value || 0), negative: acc.negative + (Number(row.quantity) < 0 ? 1 : 0) }), { value: 0, negative: 0 }), [balances]);
  return <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><OrdersV4Kpi label="أرصدة الأصناف" value={balances.length} /><OrdersV4Kpi label="قيمة المخزون" value={`${v4Number(totals.value)} ر.س`} tone="green" /><OrdersV4Kpi label="أرصدة سالبة" value={totals.negative} tone={totals.negative ? 'red' : 'green'} /><OrdersV4Kpi label="جودة البيانات" value={qualityQuery.data?.ready ? 'جاهز' : `${qualityQuery.data?.errorCount ?? 0} خطأ`} tone={qualityQuery.data?.ready ? 'green' : 'amber'} /></div><ScreenTabs items={[{ id: 'balances', label: 'الأرصدة والتكلفة' }, { id: 'ledger', label: 'دفتر الحركات' }, { id: 'stocktakes', label: 'الجرد' }, { id: 'quality', label: 'جودة البيانات' }]} value={tab} onChange={setTab} variant="segmented" segmentedFlat contentClassName="pt-3">{tab === 'balances' && <BalancesTable query={balancesQuery} bootstrap={bootstrap} />}{tab === 'ledger' && <LedgerTable query={ledgerQuery} />}{tab === 'stocktakes' && <StocktakesTable query={stocktakesQuery} onCreate={canWrite ? () => setStocktakeOpen(true) : undefined} />}{tab === 'quality' && <QualityTable query={qualityQuery} />}</ScreenTabs>{canWrite && <StocktakeModal open={stocktakeOpen} onClose={() => setStocktakeOpen(false)} companyId={companyId} bootstrap={bootstrap} balances={balances} />}</div>;
}

function BalancesTable({ query, bootstrap }: { query: ReturnType<typeof useOrdersV4Balances>; bootstrap?: OrdersV4Bootstrap }) {
  const columns: SimpleTableColumn<OrdersV4InventoryBalance>[] = [
    { key: 'itemName', label: 'الصنف', minWidth: 180 }, { key: 'categoryName', label: 'الفئة' }, { key: 'locationName', label: 'الموقع' },
    { key: 'quantity', label: 'الرصيد المركب', numeric: true, render: (value, row) => {
      const item = bootstrap?.items.find((candidate) => candidate.id === row.itemId);
      const conversion = bootstrap?.conversions.find((candidate) => candidate.itemId === row.itemId && candidate.status === 'published');
      const formatted = ordersV4CompositeQuantity(String(value), item, conversion);
      if (!formatted) return `${v4Number(value, 6)} ${row.unitName}`;
      return <div><strong>{formatted.primary}</strong>{formatted.primary !== formatted.base && <div className="mt-1 text-[10px] text-noorix-muted">يعادل {formatted.base}</div>}</div>;
    } },
    { key: 'averageUnitCost', label: 'متوسط التكلفة', numeric: true, render: (value) => v4Number(value, 4) },
    { key: 'value', label: 'القيمة', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
    { key: 'lastSequence', label: 'آخر تسلسل', numeric: true },
  ];
  return <OrdersV4Panel title="أرصدة دفتر V4"><OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />{!query.isLoading && <SimpleTable columns={columns} data={query.data ?? []} tableMinWidth={880} emptyMessage="لا توجد أصناف مخزنية" />}</OrdersV4Panel>;
}

function LedgerTable({ query }: { query: ReturnType<typeof useOrdersV4Ledger> }) {
  const columns: SimpleTableColumn<OrdersV4LedgerEntry>[] = [
    { key: 'sequence', label: '#', numeric: true }, { key: 'effectiveAt', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    { key: 'item', label: 'الصنف', render: (_value, row) => row.item.nameAr }, { key: 'location', label: 'الموقع', render: (_value, row) => row.location.nameAr },
    { key: 'entryType', label: 'نوع القيد' }, { key: 'quantityDelta', label: 'تغير الكمية', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inventoryUnit.nameAr}` },
    { key: 'valueDelta', label: 'تغير القيمة', numeric: true, render: (value) => v4Number(value) }, { key: 'quantityAfter', label: 'الرصيد بعد', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inventoryUnit.nameAr}` },
    { key: 'averageUnitCostAfter', label: 'المتوسط بعد', numeric: true, render: (value, row) => `${v4Number(value, 4)} / ${row.inventoryUnit.nameAr}` },
  ];
  return <OrdersV4Panel title="دفتر المخزون الدائم"><OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />{!query.isLoading && <SimpleTable columns={columns} data={query.data ?? []} tableMinWidth={1100} emptyMessage="لا توجد قيود بعد" />}</OrdersV4Panel>;
}

function StocktakesTable({ query, onCreate }: { query: ReturnType<typeof useOrdersV4Stocktakes>; onCreate?: () => void }) {
  const columns: SimpleTableColumn<OrdersV4Stocktake>[] = [
    { key: 'stocktakeNumber', label: 'رقم الجرد' }, { key: 'stocktakeDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    { key: 'location', label: 'الموقع', render: (_value, row) => row.location.nameAr }, { key: 'lines', label: 'الأصناف', numeric: true, render: (_value, row) => row.lines.length },
    { key: 'variance', label: 'قيمة الفروقات', numeric: true, render: (_value, row) => `${v4Number(row.lines.reduce((sum, line) => sum + Number(line.varianceValue), 0))} ر.س` },
  ];
  return <OrdersV4Panel title="سجل الجرد" action={onCreate ? <Button variant="primary" onClick={onCreate}>+ جرد جديد</Button> : undefined}><OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />{!query.isLoading && <SimpleTable columns={columns} data={query.data ?? []} emptyMessage="لا توجد جلسات جرد" tableMinWidth={700} />}</OrdersV4Panel>;
}

function QualityTable({ query }: { query: ReturnType<typeof useOrdersV4DataQuality> }) {
  const columns: SimpleTableColumn<OrdersV4DataQuality['issues'][number]>[] = [
    { key: 'severity', label: 'المستوى', render: (value) => <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${value === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{value === 'error' ? 'خطأ' : 'تنبيه'}</span> },
    { key: 'itemName', label: 'الصنف' }, { key: 'code', label: 'الكود' }, { key: 'message', label: 'التفاصيل', minWidth: 320 },
  ];
  return <OrdersV4Panel title="فحص جاهزية الكتالوج والنواة"><OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />{query.data && <SimpleTable columns={columns} data={query.data.issues} emptyMessage="جميع تعريفات V4 جاهزة" tableMinWidth={700} />}</OrdersV4Panel>;
}

function StocktakeModal({ open, onClose, companyId, bootstrap, balances }: { open: boolean; onClose: () => void; companyId: string; bootstrap?: OrdersV4Bootstrap; balances: OrdersV4InventoryBalance[] }) {
  const mutation = useCreateOrdersV4Stocktake(companyId);
  const [date, setDate] = useState(getSaudiToday());
  const [locationId, setLocationId] = useState('');
  const [physical, setPhysical] = useState<Record<string, Record<string, string>>>({});
  const effectiveLocation = locationId || bootstrap?.locations.find((row) => row.isActive)?.id || '';
  const scoped = balances.filter((row) => !effectiveLocation || row.locationId === effectiveLocation);
  const columns: SimpleTableColumn<OrdersV4InventoryBalance>[] = [
    { key: 'itemName', label: 'الصنف', minWidth: 220 },
    { key: 'quantity', label: 'المتوقع', numeric: true, render: (value, row) => {
      const item = bootstrap?.items.find((candidate) => candidate.id === row.itemId);
      const conversion = bootstrap?.conversions.find((candidate) => candidate.itemId === row.itemId && candidate.status === 'published');
      return ordersV4CompositeQuantity(String(value), item, conversion)?.primary ?? v4Number(value, 6);
    } },
    {
      key: 'physicalQuantity',
      label: 'الفعلي',
      minWidth: 320,
      render: (_value, row) => {
        const item = bootstrap?.items.find((candidate) => candidate.id === row.itemId);
        const conversion = bootstrap?.conversions.find((candidate) => candidate.itemId === row.itemId && candidate.status === 'published');
        const inputUnits = item?.units.filter((unit) => unit.isActive).map((unit) => ({
          ...unit,
          factor: ordersV4UnitFactorToBase(unit.unitId, item.inventoryUnitId, conversion),
        })).filter((unit) => unit.factor != null && unit.factor >= 1).sort((left, right) => Number(right.factor) - Number(left.factor)) ?? [];
        return <div className="flex min-w-[300px] flex-wrap gap-2">{inputUnits.map((unit) => <label key={unit.unitId} className="min-w-[90px] flex-1"><span className="mb-1 block text-[10px] font-bold text-noorix-muted">{unit.unit.nameAr}</span><Input type="number" min="0" step="any" value={physical[row.itemId]?.[unit.unitId] ?? ''} placeholder="0" onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPhysical((current) => ({ ...current, [row.itemId]: { ...current[row.itemId], [unit.unitId]: event.target.value } }))} /></label>)}</div>;
      },
    },
  ];
  function physicalBaseQuantity(row: OrdersV4InventoryBalance) {
    const values = physical[row.itemId];
    if (!values || !Object.values(values).some((value) => value !== '')) return String(row.quantity);
    const item = bootstrap?.items.find((candidate) => candidate.id === row.itemId);
    const conversion = bootstrap?.conversions.find((candidate) => candidate.itemId === row.itemId && candidate.status === 'published');
    return String(Object.entries(values).reduce((total, [unitId, value]) => {
      const factor = item ? ordersV4UnitFactorToBase(unitId, item.inventoryUnitId, conversion) : null;
      return total + (Number(value) || 0) * (factor ?? 0);
    }, 0));
  }
  async function submit() {
    if (!effectiveLocation || !scoped.length) return;
    await mutation.mutateAsync({ stocktakeDate: date, locationId: effectiveLocation, idempotencyKey: crypto.randomUUID(), lines: scoped.map((row) => ({ itemId: row.itemId, physicalQuantity: physicalBaseQuantity(row) })) });
    onClose();
  }
  return <Modal open={open} onClose={onClose} size="xl" title="جرد مخزون V4" footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose }, { key: 'save', label: 'اعتماد الفروقات', role: 'save', onClick: submit, loading: mutation.isPending }]} />}><div className="flex flex-col gap-3"><div className="grid gap-3 sm:grid-cols-2"><OrdersV4Field label="تاريخ الجرد"><TransactionDatePicker value={date} onValueChange={setDate} /></OrdersV4Field><OrdersV4Field label="الموقع"><OrdersV4Select value={effectiveLocation} onChange={(event) => setLocationId(event.target.value)}>{bootstrap?.locations.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select></OrdersV4Field></div><div className="max-h-[50vh] overflow-auto"><SimpleTable columns={columns} data={scoped} tableMinWidth={560} emptyMessage="لا توجد أرصدة مخزنية في الموقع" /></div></div></Modal>;
}
