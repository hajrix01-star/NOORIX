import React, { useEffect, useMemo, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4CutoverAudit, OrdersV4CutoverResult, OrdersV4DataQuality, OrdersV4InventoryBalance, OrdersV4LedgerEntry, OrdersV4Stocktake, OrdersV4UserIdentity } from '../../../types/api';
import { Button, DialogActions, Input, Modal, ScreenTabs, type SimpleTableColumn } from '../../../ui';
import { getSaudiToday } from '../../../utils/saudiDate';
import {
  OrdersV4Field,
  OrdersV4Kpi,
  OrdersV4Panel,
  OrdersV4QueryState,
  OrdersV4Select,
  OrdersV4Table as SimpleTable,
  ordersV4NavigationBarClassName,
  ordersV4NavigationTabClassName,
  v4Date,
  v4Number,
  v4UserLabel,
} from '../OrdersV4Shared';
import { useCreateOrdersV4Stocktake, useExecuteOrdersV4Cutover, useOrdersV4Balances, useOrdersV4CutoverAudit, useOrdersV4DataQuality, useOrdersV4Ledger, useOrdersV4Stocktakes } from '../useOrdersV4';
import { ordersV4CompositeQuantity, ordersV4UnitFactorToBase } from './ordersV4ItemDefinition.utils';

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('ar');
}

function InventoryFilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 grid gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/35 p-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function uniqueUsers(rows: Array<{ createdByUser?: OrdersV4UserIdentity | null }>): OrdersV4UserIdentity[] {
  return [...new Map(rows.filter((row) => row.createdByUser).map((row) => [row.createdByUser!.id, row.createdByUser!])).values()]
    .sort((a, b) => v4UserLabel(a).localeCompare(v4UserLabel(b), 'ar'));
}

export function OrdersV4InventoryTab({ companyId, bootstrap, canWrite = false, canCutover = false }: { companyId: string; bootstrap?: OrdersV4Bootstrap; canWrite?: boolean; canCutover?: boolean }) {
  const [tab, setTab] = useState('balances');
  const balancesQuery = useOrdersV4Balances(companyId);
  const ledgerQuery = useOrdersV4Ledger(companyId);
  const stocktakesQuery = useOrdersV4Stocktakes(companyId);
  const qualityQuery = useOrdersV4DataQuality(companyId);
  const cutoverQuery = useOrdersV4CutoverAudit(companyId, canCutover);
  const [stocktakeOpen, setStocktakeOpen] = useState(false);
  const balances = balancesQuery.data ?? [];
  const totals = useMemo(() => balances.reduce((acc, row) => ({ value: acc.value + Number(row.value || 0), negative: acc.negative + (Number(row.quantity) < 0 ? 1 : 0) }), { value: 0, negative: 0 }), [balances]);
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <OrdersV4Kpi label="أرصدة الأصناف" value={balances.length} />
      <OrdersV4Kpi label="قيمة المخزون" value={`${v4Number(totals.value)} ر.س`} tone="green" />
      <OrdersV4Kpi label="أرصدة سالبة" value={totals.negative} tone={totals.negative ? 'red' : 'green'} />
      <OrdersV4Kpi label="جودة البيانات" value={qualityQuery.data?.ready ? 'جاهز' : `${qualityQuery.data?.errorCount ?? 0} خطأ`} tone={qualityQuery.data?.ready ? 'green' : 'amber'} />
    </div>
    <ScreenTabs
      items={[{ id: 'balances', label: 'الأرصدة والتكلفة' }, { id: 'ledger', label: 'دفتر الحركات' }, { id: 'stocktakes', label: 'الجرد' }, { id: 'quality', label: 'جودة البيانات' }]}
      value={tab}
      onChange={setTab}
      variant="segmented"
      segmentedFlat
      barClassName={ordersV4NavigationBarClassName}
      getTabClassName={ordersV4NavigationTabClassName}
      contentClassName="pt-3"
    >
      {tab === 'balances' && <BalancesTable query={balancesQuery} bootstrap={bootstrap} />}
      {tab === 'ledger' && <LedgerTable query={ledgerQuery} />}
      {tab === 'stocktakes' && <StocktakesTable query={stocktakesQuery} onCreate={canWrite ? () => setStocktakeOpen(true) : undefined} />}
      {tab === 'quality' && <QualityTable query={qualityQuery} />}
    </ScreenTabs>
    {canCutover && <CutoverAuditPanel companyId={companyId} query={cutoverQuery} />}
    {canWrite && <StocktakeModal open={stocktakeOpen} onClose={() => setStocktakeOpen(false)} companyId={companyId} bootstrap={bootstrap} balances={balances} />}
  </div>;
}

function CutoverAuditPanel({ companyId, query }: { companyId: string; query: ReturnType<typeof useOrdersV4CutoverAudit> }) {
  const audit = query.data;
  const executeMutation = useExecuteOrdersV4Cutover(companyId);
  const [result, setResult] = useState<OrdersV4CutoverResult | null>(null);
  const [executeError, setExecuteError] = useState('');
  const issueColumns: SimpleTableColumn<OrdersV4CutoverAudit['issues'][number]>[] = [
    { key: 'severity', label: 'المستوى', render: (value) => value === 'error' ? 'خطأ مانع' : 'تنبيه' },
    { key: 'entity', label: 'الكيان' },
    { key: 'code', label: 'الرمز' },
    { key: 'message', label: 'التفاصيل', minWidth: 360 },
  ];
  const source = audit?.source ?? {};
  const target = audit?.target ?? {};
  const execute = async () => {
    if (!audit?.ready || executeMutation.isPending) return;
    setExecuteError('');
    try {
      const response = await executeMutation.mutateAsync({ confirmation: 'IMPORT_LEGACY_ORDERS_TO_V4', sourceFingerprint: audit.sourceFingerprint });
      setResult(response.data ?? null);
    } catch (error) {
      setExecuteError(error instanceof Error ? error.message : 'تعذر تنفيذ الترحيل');
    }
  };
  return <OrdersV4Panel title="تدقيق الانتقال من الطلبات القديم إلى طلبات V4" action={audit?.ready ? <Button variant="primary" onClick={execute} disabled={executeMutation.isPending}>{executeMutation.isPending ? 'جارٍ الترحيل والمطابقة…' : 'تنفيذ الترحيل الذري'}</Button> : undefined}>
    <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />
    {audit && <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OrdersV4Kpi label="حالة المصدر" value={audit.ready ? 'جاهز' : 'غير جاهز'} tone={audit.ready ? 'green' : 'red'} />
        <OrdersV4Kpi label="أصناف القديم" value={Number(source.purchasedItems ?? 0) + Number(source.saleItems ?? 0)} />
        <OrdersV4Kpi label="مستندات القديم" value={Number(source.activePurchaseDocuments ?? 0) + Number(source.registrationDocuments ?? 0)} />
        <OrdersV4Kpi label="مشكلات مانعة" value={audit.issueCounts.errors} tone={audit.issueCounts.errors ? 'red' : 'green'} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-noorix-border bg-white p-3 text-xs" dir="ltr">
        <pre className="min-w-[760px] whitespace-pre-wrap text-left">{JSON.stringify({ generatedAt: audit.generatedAt, sourceFingerprint: audit.sourceFingerprint, source, target, issueCounts: audit.issueCounts }, null, 2)}</pre>
      </div>
      <SimpleTable columns={issueColumns} data={audit.issues} emptyMessage="لا توجد مشكلات في المصدر" tableMinWidth={760} />
      {executeError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">{executeError}</div>}
      {result && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" dir="ltr"><pre className="whitespace-pre-wrap text-left">{JSON.stringify(result, null, 2)}</pre></div>}
    </div>}
  </OrdersV4Panel>;
}

function BalancesTable({ query, bootstrap }: { query: ReturnType<typeof useOrdersV4Balances>; bootstrap?: OrdersV4Bootstrap }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [locationId, setLocationId] = useState('');
  const [balanceState, setBalanceState] = useState('');
  const [createdByUserId, setCreatedByUserId] = useState('');
  const rows = query.data ?? [];
  const categories = useMemo(() => [...new Set(rows.map((row) => row.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [rows]);
  const locations = useMemo(() => [...new Map(rows.map((row) => [row.locationId, { id: row.locationId, name: row.locationName }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'ar')), [rows]);
  const users = useMemo(() => uniqueUsers(rows), [rows]);
  const filteredRows = useMemo(() => {
    const term = normalized(search);
    return rows.filter((row) => (!category || row.categoryName === category)
      && (!locationId || row.locationId === locationId)
      && (!createdByUserId || row.createdByUser?.id === createdByUserId)
      && (!balanceState || (balanceState === 'negative' && Number(row.quantity) < 0) || (balanceState === 'positive' && Number(row.quantity) > 0) || (balanceState === 'zero' && Number(row.quantity) === 0) || (balanceState === 'nonzero' && Number(row.quantity) !== 0))
      && (!term || normalized(`${row.itemName} ${row.categoryName} ${row.locationName} ${v4UserLabel(row.createdByUser)}`).includes(term)));
  }, [balanceState, category, createdByUserId, locationId, rows, search]);
  const columns: SimpleTableColumn<OrdersV4InventoryBalance>[] = [
    { key: 'itemName', label: 'الصنف', minWidth: 180 },
    { key: 'categoryName', label: 'الفئة', render: (value) => String(value || '—') },
    { key: 'locationName', label: 'الموقع' },
    { key: 'quantity', label: 'الرصيد المركب', numeric: true, render: (value, row) => {
      const item = bootstrap?.items.find((candidate) => candidate.id === row.itemId);
      const conversion = bootstrap?.conversions.find((candidate) => candidate.itemId === row.itemId && candidate.status === 'published');
      const formatted = ordersV4CompositeQuantity(String(value), item, conversion);
      if (!formatted) return `${v4Number(value, 6)} ${row.unitName}`;
      return <div><strong>{formatted.primary}</strong>{formatted.primary !== formatted.base && <div className="mt-1 text-[10px] text-noorix-muted">يعادل {formatted.base}</div>}</div>;
    } },
    { key: 'averageUnitCost', label: 'متوسط التكلفة', numeric: true, render: (value) => v4Number(value, 4) },
    { key: 'value', label: 'القيمة', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
    { key: 'createdByUser', label: 'آخر إدخال (المستخدم)', minWidth: 180, render: (_value, row) => v4UserLabel(row.createdByUser) },
    { key: 'lastSequence', label: 'آخر تسلسل', numeric: true },
  ];
  return <OrdersV4Panel title={`أرصدة دفتر V4 — ${filteredRows.length} نتيجة`}>
    <InventoryFilterBar>
      <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الصنف أو الفئة أو الموظف…" /></OrdersV4Field>
      <OrdersV4Field label="الفئة"><OrdersV4Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">كل الفئات</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="الموقع"><OrdersV4Select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">كل المواقع</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="حالة الرصيد"><OrdersV4Select value={balanceState} onChange={(event) => setBalanceState(event.target.value)}><option value="">كل الأرصدة</option><option value="nonzero">غير صفري</option><option value="positive">موجب</option><option value="negative">سالب</option><option value="zero">صفر</option></OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="آخر مُدخل"><OrdersV4Select value={createdByUserId} onChange={(event) => setCreatedByUserId(event.target.value)}><option value="">كل الموظفين</option>{users.map((user) => <option key={user.id} value={user.id}>{v4UserLabel(user)}</option>)}</OrdersV4Select></OrdersV4Field>
    </InventoryFilterBar>
    <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />
    {!query.isLoading && <SimpleTable columns={columns} data={filteredRows} tableMinWidth={1120} emptyMessage="لا توجد أرصدة مطابقة للفلاتر" />}
  </OrdersV4Panel>;
}

function LedgerTable({ query }: { query: ReturnType<typeof useOrdersV4Ledger> }) {
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [entryType, setEntryType] = useState('');
  const [createdByUserId, setCreatedByUserId] = useState('');
  const rows = query.data ?? [];
  const items = useMemo(() => [...new Map(rows.map((row) => [row.item.id, row.item])).values()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')), [rows]);
  const locations = useMemo(() => [...new Map(rows.map((row) => [row.location.id, row.location])).values()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')), [rows]);
  const entryTypes = useMemo(() => [...new Set(rows.map((row) => row.entryType))].sort(), [rows]);
  const users = useMemo(() => uniqueUsers(rows), [rows]);
  const filteredRows = useMemo(() => {
    const term = normalized(search);
    return rows.filter((row) => (!itemId || row.item.id === itemId)
      && (!locationId || row.location.id === locationId)
      && (!entryType || row.entryType === entryType)
      && (!createdByUserId || row.createdByUser?.id === createdByUserId)
      && (!term || normalized(`${row.sequence} ${row.item.nameAr} ${row.location.nameAr} ${row.entryType} ${v4UserLabel(row.createdByUser)}`).includes(term)));
  }, [createdByUserId, entryType, itemId, locationId, rows, search]);
  const columns: SimpleTableColumn<OrdersV4LedgerEntry>[] = [
    { key: 'sequence', label: '#', numeric: true },
    { key: 'effectiveAt', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    { key: 'item', label: 'الصنف', render: (_value, row) => row.item.nameAr },
    { key: 'location', label: 'الموقع', render: (_value, row) => row.location.nameAr },
    { key: 'entryType', label: 'نوع القيد' },
    { key: 'quantityDelta', label: 'تغير الكمية', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inventoryUnit.nameAr}` },
    { key: 'valueDelta', label: 'تغير القيمة', numeric: true, render: (value) => v4Number(value) },
    { key: 'quantityAfter', label: 'الرصيد بعد', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inventoryUnit.nameAr}` },
    { key: 'averageUnitCostAfter', label: 'المتوسط بعد', numeric: true, render: (value, row) => `${v4Number(value, 4)} / ${row.inventoryUnit.nameAr}` },
    { key: 'createdByUser', label: 'الموظف (المستخدم)', minWidth: 180, render: (_value, row) => v4UserLabel(row.createdByUser) },
  ];
  return <OrdersV4Panel title={`دفتر المخزون الدائم — ${filteredRows.length} قيد`}>
    <InventoryFilterBar>
      <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رقم أو صنف أو موظف…" /></OrdersV4Field>
      <OrdersV4Field label="الصنف"><OrdersV4Select value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">كل الأصناف</option>{items.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="الموقع"><OrdersV4Select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">كل المواقع</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="نوع القيد"><OrdersV4Select value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="">كل الأنواع</option>{entryTypes.map((type) => <option key={type} value={type}>{type}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="الموظف"><OrdersV4Select value={createdByUserId} onChange={(event) => setCreatedByUserId(event.target.value)}><option value="">كل الموظفين</option>{users.map((user) => <option key={user.id} value={user.id}>{v4UserLabel(user)}</option>)}</OrdersV4Select></OrdersV4Field>
    </InventoryFilterBar>
    <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />
    {!query.isLoading && <SimpleTable columns={columns} data={filteredRows} tableMinWidth={1320} emptyMessage="لا توجد قيود مطابقة للفلاتر" />}
  </OrdersV4Panel>;
}

function StocktakesTable({ query, onCreate }: { query: ReturnType<typeof useOrdersV4Stocktakes>; onCreate?: () => void }) {
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState('');
  const [createdByUserId, setCreatedByUserId] = useState('');
  const rows = query.data ?? [];
  const locations = useMemo(() => [...new Map(rows.map((row) => [row.location.id, row.location])).values()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((row) => row.status))].sort(), [rows]);
  const users = useMemo(() => uniqueUsers(rows), [rows]);
  const filteredRows = useMemo(() => {
    const term = normalized(search);
    return rows.filter((row) => (!locationId || row.location.id === locationId)
      && (!status || row.status === status)
      && (!createdByUserId || row.createdByUser?.id === createdByUserId)
      && (!term || normalized(`${row.stocktakeNumber} ${row.location.nameAr} ${v4UserLabel(row.createdByUser)}`).includes(term)));
  }, [createdByUserId, locationId, rows, search, status]);
  const columns: SimpleTableColumn<OrdersV4Stocktake>[] = [
    { key: 'stocktakeNumber', label: 'رقم الجرد' },
    { key: 'stocktakeDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    { key: 'location', label: 'الموقع', render: (_value, row) => row.location.nameAr },
    { key: 'lines', label: 'الأصناف', numeric: true, render: (_value, row) => row.lines.length },
    { key: 'variance', label: 'قيمة الفروقات', numeric: true, render: (_value, row) => `${v4Number(row.lines.reduce((sum, line) => sum + Number(line.varianceValue), 0))} ر.س` },
    { key: 'createdByUser', label: 'الموظف (المستخدم)', minWidth: 180, render: (_value, row) => v4UserLabel(row.createdByUser) },
    { key: 'status', label: 'الحالة' },
  ];
  return <OrdersV4Panel title={`سجل الجرد — ${filteredRows.length} جلسة`} action={onCreate ? <Button variant="primary" onClick={onCreate}>+ جرد جديد</Button> : undefined}>
    <InventoryFilterBar>
      <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رقم الجرد أو الموقع أو الموظف…" /></OrdersV4Field>
      <OrdersV4Field label="الموقع"><OrdersV4Select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">كل المواقع</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="الحالة"><OrdersV4Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">كل الحالات</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="الموظف"><OrdersV4Select value={createdByUserId} onChange={(event) => setCreatedByUserId(event.target.value)}><option value="">كل الموظفين</option>{users.map((user) => <option key={user.id} value={user.id}>{v4UserLabel(user)}</option>)}</OrdersV4Select></OrdersV4Field>
    </InventoryFilterBar>
    <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />
    {!query.isLoading && <SimpleTable columns={columns} data={filteredRows} emptyMessage="لا توجد جلسات جرد مطابقة" tableMinWidth={980} />}
  </OrdersV4Panel>;
}

function QualityTable({ query }: { query: ReturnType<typeof useOrdersV4DataQuality> }) {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const issues = query.data?.issues ?? [];
  const filteredIssues = useMemo(() => {
    const term = normalized(search);
    return issues.filter((issue) => (!severity || issue.severity === severity)
      && (!term || normalized(`${issue.itemName} ${issue.code} ${issue.message}`).includes(term)));
  }, [issues, search, severity]);
  const columns: SimpleTableColumn<OrdersV4DataQuality['issues'][number]>[] = [
    { key: 'severity', label: 'المستوى', render: (value) => <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${value === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{value === 'error' ? 'خطأ' : 'تنبيه'}</span> },
    { key: 'itemName', label: 'الصنف' },
    { key: 'code', label: 'الكود' },
    { key: 'message', label: 'التفاصيل', minWidth: 320 },
  ];
  return <OrdersV4Panel title={`فحص جاهزية الكتالوج والنواة — ${filteredIssues.length} نتيجة`}>
    <InventoryFilterBar>
      <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الصنف أو الكود أو التفاصيل…" /></OrdersV4Field>
      <OrdersV4Field label="المستوى"><OrdersV4Select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">كل المستويات</option><option value="error">خطأ</option><option value="warning">تنبيه</option></OrdersV4Select></OrdersV4Field>
    </InventoryFilterBar>
    <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />
    {query.data && <SimpleTable columns={columns} data={filteredIssues} emptyMessage="جميع تعريفات V4 جاهزة أو لا توجد نتائج مطابقة" tableMinWidth={700} />}
  </OrdersV4Panel>;
}

function StocktakeModal({ open, onClose, companyId, bootstrap, balances }: { open: boolean; onClose: () => void; companyId: string; bootstrap?: OrdersV4Bootstrap; balances: OrdersV4InventoryBalance[] }) {
  const mutation = useCreateOrdersV4Stocktake(companyId);
  const [locationId, setLocationId] = useState('');
  const [sectionId, setSectionId] = useState('all');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [physical, setPhysical] = useState<Record<string, Record<string, string>>>({});
  const date = getSaudiToday();
  const effectiveLocation = locationId || bootstrap?.locations.find((row) => row.isActive)?.id || '';
  const itemById = useMemo(() => new Map((bootstrap?.items ?? []).map((item) => [item.id, item])), [bootstrap?.items]);
  const scopeRows = useMemo(() => balances.filter((row) => (!effectiveLocation || row.locationId === effectiveLocation)
    && (sectionId === 'all' || itemById.get(row.itemId)?.sections.some((entry) => entry.section.id === sectionId))), [balances, effectiveLocation, itemById, sectionId]);
  const scoped = useMemo(() => {
    const needle = normalized(search);
    return scopeRows.filter((row) => !needle || normalized(`${row.itemName} ${row.categoryName} ${row.unitName}`).includes(needle));
  }, [scopeRows, search]);

  useEffect(() => {
    if (!open) return;
    setLocationId(bootstrap?.locations.find((row) => row.isActive)?.id || '');
    setSectionId('all');
    setSearch('');
    setNotes('');
    setPhysical({});
  }, [bootstrap?.locations, open]);

  function rowDefinition(row: OrdersV4InventoryBalance) {
    const item = itemById.get(row.itemId);
    const conversion = bootstrap?.conversions.find((candidate) => candidate.itemId === row.itemId && candidate.status === 'published');
    const units = item?.units.filter((unit) => unit.isActive).map((unit) => ({
      ...unit,
      factor: ordersV4UnitFactorToBase(unit.unitId, item.inventoryUnitId, conversion),
    })).filter((unit): unit is typeof unit & { factor: number } => unit.factor != null && unit.factor >= 1)
      .sort((left, right) => right.factor - left.factor) ?? [];
    return { item, conversion, units };
  }

  function physicalBaseQuantity(row: OrdersV4InventoryBalance) {
    const values = physical[row.itemId];
    if (!values || !Object.values(values).some((value) => value !== '')) return String(row.quantity);
    const { item, conversion } = rowDefinition(row);
    return String(Object.entries(values).reduce((total, [unitId, value]) => {
      const factor = item ? ordersV4UnitFactorToBase(unitId, item.inventoryUnitId, conversion) : null;
      return total + (Number(value) || 0) * (factor ?? 0);
    }, 0));
  }

  function setPhysicalValue(row: OrdersV4InventoryBalance, unitId: string, value: string) {
    setPhysical((current) => ({
      ...current,
      [row.itemId]: { ...(current[row.itemId] ?? {}), [unitId]: value },
    }));
  }

  async function submit() {
    if (!effectiveLocation || !scopeRows.length) return;
    await mutation.mutateAsync({ stocktakeDate: date, locationId: effectiveLocation, notes: notes.trim() || undefined, idempotencyKey: crypto.randomUUID(), lines: scopeRows.map((row) => ({ itemId: row.itemId, physicalQuantity: physicalBaseQuantity(row) })) });
    onClose();
  }
  return <Modal open={open} onClose={onClose} size="xl" title="جرد المخزون" footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: onClose }, { key: 'save', label: 'اعتماد الجرد', role: 'save', onClick: submit, loading: mutation.isPending, disabled: !scopeRows.length }]} />}>
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] leading-6 text-blue-900">
        الجرد التشغيلي يعتمد تاريخ اليوم بتوقيت السعودية: <b>{date}</b>. الرصيد الدفتري يُعاد احتسابه لحظة الاعتماد لضمان سلامة القيود.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <OrdersV4Field label="موقع المخزون"><OrdersV4Select value={effectiveLocation} onChange={(event) => { setLocationId(event.target.value); setPhysical({}); }}>{bootstrap?.locations.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
        <OrdersV4Field label="بحث في الأصناف"><Input type="search" value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="اسم الصنف أو الفئة…" /></OrdersV4Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-noorix-muted">نطاق الجرد:</span>
        <Button size="sm" variant={sectionId === 'all' ? 'primary' : 'ghost'} onClick={() => setSectionId('all')}>كل الأقسام / جرد كامل</Button>
        {bootstrap?.sections.filter((section) => section.isActive).map((section) => <Button key={section.id} size="sm" variant={sectionId === section.id ? 'primary' : 'ghost'} onClick={() => setSectionId(section.id)}>{section.nameAr}</Button>)}
        <span className="ms-auto rounded-full bg-noorix-bg-muted px-3 py-1 text-[12px] font-bold">{search.trim() ? `${scoped.length} ظاهر من ${scopeRows.length}` : scopeRows.length} صنف</span>
      </div>
      <div className="max-h-[52vh] space-y-2 overflow-y-auto pe-1">
        {scoped.map((row) => {
          const { item, conversion, units } = rowDefinition(row);
          const expected = Number(row.quantity);
          const physicalBase = Number(physicalBaseQuantity(row));
          const variance = physicalBase - expected;
          const expectedDisplay = ordersV4CompositeQuantity(row.quantity, item, conversion)?.primary ?? `${v4Number(row.quantity, 6)} ${row.unitName}`;
          const physicalDisplay = ordersV4CompositeQuantity(physicalBase, item, conversion)?.primary ?? `${v4Number(physicalBase, 6)} ${row.unitName}`;
          const varianceDisplay = ordersV4CompositeQuantity(variance, item, conversion)?.primary ?? `${v4Number(variance, 6)} ${row.unitName}`;
          return <article key={row.itemId} className="rounded-xl border border-noorix-border bg-noorix-surface p-3 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(170px,1fr)_minmax(140px,0.8fr)_minmax(280px,1.6fr)_minmax(140px,0.8fr)] lg:items-end">
              <div><div className="text-[11px] font-bold text-noorix-muted">الصنف</div><div className="mt-1 font-bold text-noorix-text">{row.itemName}</div><div className="text-[11px] text-noorix-muted">{row.categoryName || 'بدون فئة'} · {row.unitName}</div></div>
              <div className="rounded-lg bg-noorix-bg-muted p-2 text-center"><div className="text-[10px] font-bold text-noorix-muted">الدفتري</div><div className="mt-1 text-[13px] font-bold tabular-nums">{expectedDisplay}</div></div>
              <div><div className="mb-1 text-[10px] font-bold text-noorix-muted">الفعلي — أدخل بأي تغليف</div><div className="flex flex-wrap gap-2">{units.map((unit) => {
                const stored = physical[row.itemId];
                const value = stored ? stored[unit.unitId] ?? '' : unit.unitId === item?.inventoryUnitId ? String(row.quantity) : '';
                return <label key={unit.unitId} className="min-w-[90px] flex-1"><span className="mb-1 block text-center text-[10px] text-noorix-muted">{unit.unit.nameAr}</span><Input type="number" step="any" value={value} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPhysicalValue(row, unit.unitId, event.target.value)} /></label>;
              })}</div><div className="mt-1 text-[10px] text-noorix-muted">الإجمالي الفعلي: {physicalDisplay}</div></div>
              <div className={`rounded-lg p-2 text-center ${variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance < 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}><div className="text-[10px] font-bold">الفرق</div><div className="mt-1 text-[13px] font-bold tabular-nums">{varianceDisplay}</div></div>
            </div>
          </article>;
        })}
        {!scoped.length && <div className="rounded-xl border border-dashed border-noorix-border p-8 text-center text-[13px] text-noorix-muted">لا توجد أصناف مطابقة في الموقع والنطاق المحددين</div>}
      </div>
      <OrdersV4Field label="ملاحظات الجرد"><textarea className="min-h-[82px] w-full rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 text-[13px] outline-none focus:border-noorix-green" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظات اختيارية…" /></OrdersV4Field>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-6 text-amber-950">
        الاعتماد ينشئ مستند جرد وقيود فروقات غير قابلة للحذف. أي تصحيح لاحق يتم بجرد جديد حتى يبقى سجل المخزون كاملاً وقابلاً للمراجعة.
      </div>
    </div>
  </Modal>;
}
