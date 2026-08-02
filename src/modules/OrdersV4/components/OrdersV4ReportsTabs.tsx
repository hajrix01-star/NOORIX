import React, { useMemo, useState } from 'react';
import type { OrdersV4Document, OrdersV4ItemsReportRow } from '../../../types/api';
import { Input, type SimpleTableColumn } from '../../../ui';
import {
  OrdersV4Field,
  OrdersV4Kpi,
  OrdersV4Panel,
  OrdersV4QueryState,
  OrdersV4Select,
  OrdersV4Table as SimpleTable,
  v4Date,
  v4ReportNumber,
  v4UserLabel,
} from '../OrdersV4Shared';
import { useOrdersV4ItemsReport, useOrdersV4SalesReport } from '../useOrdersV4';

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('ar');
}

function ReportsFilterBar({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/35 p-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function OrdersV4ItemsReportTab({ companyId, startDate, endDate }: { companyId: string; startDate: string; endDate: string }) {
  const [documentType, setDocumentType] = useState<'purchase' | 'registration' | ''>('');
  const query = useOrdersV4ItemsReport(companyId, documentType, startDate, endDate);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const rows = query.data ?? [];
  const categories = useMemo(() => [...new Set(rows.map((row) => row.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [rows]);
  const units = useMemo(() => [...new Set(rows.map((row) => row.inventoryUnit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [rows]);
  const filteredRows = useMemo(() => {
    const term = normalized(search);
    return rows.filter((row) => (!category || row.categoryName === category)
      && (!unit || row.inventoryUnit === unit)
      && (!term || normalized(`${row.nameAr} ${row.categoryName} ${row.inventoryUnit}`).includes(term)));
  }, [category, rows, search, unit]);
  const totals = useMemo(() => filteredRows.reduce((acc, row) => ({
    quantity: acc.quantity + Number(row.baseQuantity || 0),
    amount: acc.amount + Number(row.totalAmount || 0),
    documents: acc.documents + row.documentCount,
  }), { quantity: 0, amount: 0, documents: 0 }), [filteredRows]);
  const columns: SimpleTableColumn<OrdersV4ItemsReportRow>[] = [
    { key: 'nameAr', label: 'الصنف', minWidth: 180, render: (value) => <strong>{String(value)}</strong> },
    { key: 'categoryName', label: 'الفئة', render: (value) => String(value || '—') },
    { key: 'documentCount', label: 'عدد المستندات', numeric: true },
    { key: 'baseQuantity', label: 'كمية الأساس', numeric: true, render: (value, row) => `${v4ReportNumber(value)} ${row.inventoryUnit}` },
    { key: 'totalAmount', label: 'القيمة', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
    { key: 'averageUnitCost', label: 'متوسط الوحدة', numeric: true, render: (value) => v4ReportNumber(value) },
  ];
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <OrdersV4Kpi label="الأصناف المطابقة" value={filteredRows.length} />
      <OrdersV4Kpi label="مجموع كميات الأساس" value={v4ReportNumber(totals.quantity)} />
      <OrdersV4Kpi label="قيمة الحركات" value={`${v4ReportNumber(totals.amount)} ر.س`} tone="green" />
      <OrdersV4Kpi label="المستندات المرتبطة" value={totals.documents} />
    </div>
    <OrdersV4Panel title="تقرير الأصناف الموحّد">
      <div className="mb-3">
        <ReportsFilterBar>
          <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الصنف أو الفئة أو الوحدة…" /></OrdersV4Field>
          <OrdersV4Field label="نوع الحركة"><OrdersV4Select value={documentType} onChange={(event) => setDocumentType(event.target.value as 'purchase' | 'registration' | '')}><option value="">كل الحركات</option><option value="purchase">طلبات الشراء</option><option value="registration">التسجيل الداخلي</option></OrdersV4Select></OrdersV4Field>
          <OrdersV4Field label="الفئة"><OrdersV4Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">كل الفئات</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</OrdersV4Select></OrdersV4Field>
          <OrdersV4Field label="وحدة المخزون"><OrdersV4Select value={unit} onChange={(event) => setUnit(event.target.value)}><option value="">كل الوحدات</option>{units.map((name) => <option key={name} value={name}>{name}</option>)}</OrdersV4Select></OrdersV4Field>
        </ReportsFilterBar>
      </div>
      <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />
      {!query.isLoading && <SimpleTable columns={columns} data={filteredRows} emptyMessage="لا توجد حركة مطابقة للفلاتر" tableMinWidth={800} />}
    </OrdersV4Panel>
  </div>;
}

function statusLabel(status: string): string {
  return status === 'received' ? 'مستلم' : status === 'prepared' ? 'معد' : status === 'cancelled' ? 'ملغي' : status === 'reversed' ? 'معكوس' : status;
}

export function OrdersV4SalesReportTab({ companyId, startDate, endDate }: { companyId: string; startDate: string; endDate: string }) {
  const query = useOrdersV4SalesReport(companyId, startDate, endDate);
  const report = query.data;
  const [search, setSearch] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [createdByUserId, setCreatedByUserId] = useState('');
  const [status, setStatus] = useState('received');
  const documents = report?.documents ?? [];
  const sections = useMemo(() => [...new Map(documents.filter((row) => row.section).map((row) => [row.section!.id, row.section!])).values()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')), [documents]);
  const users = useMemo(() => [...new Map(documents.filter((row) => row.createdByUser).map((row) => [row.createdByUser!.id, row.createdByUser!])).values()].sort((a, b) => v4UserLabel(a).localeCompare(v4UserLabel(b), 'ar')), [documents]);
  const filteredDocuments = useMemo(() => {
    const term = normalized(search);
    return documents.filter((document) => (!sectionId || document.sectionId === sectionId)
      && (!createdByUserId || document.createdByUser?.id === createdByUserId)
      && (!status || document.status === status)
      && (!term || normalized(`${document.documentNumber} ${document.section?.nameAr || ''} ${v4UserLabel(document.createdByUser)} ${document.lines.map((line) => line.itemNameSnapshot).join(' ')}`).includes(term)));
  }, [createdByUserId, documents, search, sectionId, status]);
  const filteredByItem = useMemo<OrdersV4ItemsReportRow[]>(() => {
    const grouped = new Map<string, { itemId: string; nameAr: string; categoryName: string; inventoryUnit: string; documentIds: Set<string>; baseQuantity: number; totalAmount: number }>();
    for (const document of filteredDocuments) for (const line of document.lines) {
      const current = grouped.get(line.itemId) ?? {
        itemId: line.itemId,
        nameAr: line.itemNameSnapshot,
        categoryName: line.item.category?.nameAr || '',
        inventoryUnit: line.baseUnit.nameAr,
        documentIds: new Set<string>(),
        baseQuantity: 0,
        totalAmount: 0,
      };
      current.documentIds.add(document.id);
      current.baseQuantity += Number(line.baseQuantity || 0);
      current.totalAmount += Number(line.lineTotal || 0);
      grouped.set(line.itemId, current);
    }
    return [...grouped.values()].map((row) => ({
      itemId: row.itemId,
      nameAr: row.nameAr,
      categoryName: row.categoryName,
      inventoryUnit: row.inventoryUnit,
      documentCount: row.documentIds.size,
      baseQuantity: String(row.baseQuantity),
      totalAmount: String(row.totalAmount),
      averageUnitCost: String(row.baseQuantity ? row.totalAmount / row.baseQuantity : 0),
    })).sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));
  }, [filteredDocuments]);
  const filteredBySection = useMemo(() => {
    const grouped = new Map<string, { sectionName: string; count: number; totalAmount: number }>();
    for (const document of filteredDocuments) {
      const key = document.sectionId || 'unassigned';
      const current = grouped.get(key) ?? { sectionName: document.section?.nameAr || 'غير محدد', count: 0, totalAmount: 0 };
      current.count += 1;
      current.totalAmount += Number(document.totalAmount || 0);
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredDocuments]);
  const filteredTotal = useMemo(() => filteredDocuments.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0), [filteredDocuments]);
  const itemColumns: SimpleTableColumn<OrdersV4ItemsReportRow>[] = [
    { key: 'nameAr', label: 'الصنف' },
    { key: 'documentCount', label: 'التسجيلات', numeric: true },
    { key: 'baseQuantity', label: 'كمية الأساس', numeric: true, render: (value, row) => `${v4ReportNumber(value)} ${row.inventoryUnit}` },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
  ];
  const sectionColumns: SimpleTableColumn<(typeof filteredBySection)[number]>[] = [
    { key: 'sectionName', label: 'القسم' },
    { key: 'count', label: 'عدد التسجيلات', numeric: true },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
  ];
  const documentColumns: SimpleTableColumn<OrdersV4Document>[] = [
    { key: 'documentNumber', label: 'مرجع التسجيل', minWidth: 180 },
    { key: 'documentDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    { key: 'section', label: 'القسم', render: (_value, row) => row.section?.nameAr || '—' },
    { key: 'createdByUser', label: 'الموظف (المستخدم)', minWidth: 170, render: (_value, row) => v4UserLabel(row.createdByUser) },
    { key: 'status', label: 'الحالة', render: (value) => statusLabel(String(value)) },
    { key: 'lines', label: 'الأسطر', numeric: true, render: (_value, row) => row.lines.length },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
  ];
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <OrdersV4Kpi label="التسجيلات المطابقة" value={filteredDocuments.length} />
      <OrdersV4Kpi label="إجمالي التسجيل" value={`${v4ReportNumber(filteredTotal)} ر.س`} tone="green" />
      <OrdersV4Kpi label="الأقسام" value={filteredBySection.length} />
      <OrdersV4Kpi label="الموظفون" value={new Set(filteredDocuments.map((row) => row.createdByUser?.id).filter(Boolean)).size} />
    </div>
    <ReportsFilterBar>
      <OrdersV4Field label="بحث"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="مرجع أو صنف أو موظف…" /></OrdersV4Field>
      <OrdersV4Field label="القسم"><OrdersV4Select value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">كل الأقسام</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="الموظف"><OrdersV4Select value={createdByUserId} onChange={(event) => setCreatedByUserId(event.target.value)}><option value="">كل الموظفين</option>{users.map((user) => <option key={user.id} value={user.id}>{v4UserLabel(user)}</option>)}</OrdersV4Select></OrdersV4Field>
      <OrdersV4Field label="الحالة"><OrdersV4Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">كل الحالات</option><option value="received">مستلم</option><option value="prepared">معد</option><option value="cancelled">ملغي</option><option value="reversed">معكوس</option></OrdersV4Select></OrdersV4Field>
    </ReportsFilterBar>
    <OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />
    {report && <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <OrdersV4Panel title="التسجيل حسب الصنف"><SimpleTable columns={itemColumns} data={filteredByItem} emptyMessage="لا توجد بيانات مطابقة" tableMinWidth={560} /></OrdersV4Panel>
        <OrdersV4Panel title="التسجيل حسب القسم"><SimpleTable columns={sectionColumns} data={filteredBySection} emptyMessage="لا توجد بيانات مطابقة" /></OrdersV4Panel>
      </div>
      <OrdersV4Panel title="سجل التسجيلات"><SimpleTable columns={documentColumns} data={filteredDocuments} emptyMessage="لا توجد تسجيلات مطابقة" tableMinWidth={980} /></OrdersV4Panel>
    </>}
  </div>;
}
