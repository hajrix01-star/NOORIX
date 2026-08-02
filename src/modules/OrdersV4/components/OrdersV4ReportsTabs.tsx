import React, { useMemo } from 'react';
import type { OrdersV4Document, OrdersV4ItemsReportRow } from '../../../types/api';
import { SimpleTable, type SimpleTableColumn } from '../../../ui';
import { OrdersV4Kpi, OrdersV4Panel, OrdersV4QueryState, v4Date, v4Number } from '../OrdersV4Shared';
import { useOrdersV4ItemsReport, useOrdersV4SalesReport } from '../useOrdersV4';

export function OrdersV4ItemsReportTab({ companyId, startDate, endDate }: { companyId: string; startDate: string; endDate: string }) {
  const query = useOrdersV4ItemsReport(companyId, '', startDate, endDate);
  const rows = query.data ?? [];
  const totals = useMemo(() => rows.reduce((acc, row) => ({
    quantity: acc.quantity + Number(row.baseQuantity || 0),
    amount: acc.amount + Number(row.totalAmount || 0),
    documents: acc.documents + row.documentCount,
  }), { quantity: 0, amount: 0, documents: 0 }), [rows]);
  const columns: SimpleTableColumn<OrdersV4ItemsReportRow>[] = [
    { key: 'nameAr', label: 'الصنف', minWidth: 180, render: (value) => <strong>{String(value)}</strong> },
    { key: 'categoryName', label: 'الفئة' },
    { key: 'documentCount', label: 'عدد المستندات', numeric: true },
    { key: 'baseQuantity', label: 'كمية الأساس', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inventoryUnit}` },
    { key: 'totalAmount', label: 'القيمة', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
    { key: 'averageUnitCost', label: 'متوسط الوحدة', numeric: true, render: (value) => v4Number(value, 4) },
  ];
  return <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><OrdersV4Kpi label="الأصناف المتحركة" value={rows.length} /><OrdersV4Kpi label="مجموع كميات الأساس" value={v4Number(totals.quantity, 6)} /><OrdersV4Kpi label="قيمة الحركات" value={`${v4Number(totals.amount)} ر.س`} tone="green" /><OrdersV4Kpi label="مصدر الحساب" value="V4 Server" /></div><OrdersV4Panel title="تقرير الأصناف الموحّد"><OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />{!query.isLoading && <SimpleTable columns={columns} data={rows} emptyMessage="لا توجد حركة أصناف في الفترة" tableMinWidth={800} />}</OrdersV4Panel></div>;
}

export function OrdersV4SalesReportTab({ companyId, startDate, endDate }: { companyId: string; startDate: string; endDate: string }) {
  const query = useOrdersV4SalesReport(companyId, startDate, endDate);
  const report = query.data;
  const itemColumns: SimpleTableColumn<OrdersV4ItemsReportRow>[] = [
    { key: 'nameAr', label: 'الصنف' },
    { key: 'documentCount', label: 'التسجيلات', numeric: true },
    { key: 'baseQuantity', label: 'كمية الأساس', numeric: true, render: (value, row) => `${v4Number(value, 6)} ${row.inventoryUnit}` },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
  ];
  const sectionColumns: SimpleTableColumn<NonNullable<typeof report>['bySection'][number]>[] = [
    { key: 'sectionName', label: 'القسم' },
    { key: 'count', label: 'عدد التسجيلات', numeric: true },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
  ];
  const documentColumns: SimpleTableColumn<OrdersV4Document>[] = [
    { key: 'documentNumber', label: 'مرجع التسجيل', minWidth: 180 },
    { key: 'documentDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    { key: 'section', label: 'القسم', render: (_value, row) => row.section?.nameAr || '—' },
    { key: 'lines', label: 'الأسطر', numeric: true, render: (_value, row) => row.lines.length },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, render: (value) => `${v4Number(value)} ر.س` },
  ];
  return <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><OrdersV4Kpi label="التسجيلات" value={report?.summary.count ?? 0} /><OrdersV4Kpi label="إجمالي التسجيل" value={`${v4Number(report?.summary.totalAmount)} ر.س`} tone="green" /><OrdersV4Kpi label="الأقسام" value={report?.bySection.length ?? 0} /><OrdersV4Kpi label="نسخة التقرير" value="V4" /></div><OrdersV4QueryState loading={query.isLoading} error={query.error as Error | null} />{report && <><div className="grid min-w-0 gap-4 xl:grid-cols-2"><OrdersV4Panel title="التسجيل حسب الصنف"><SimpleTable columns={itemColumns} data={report.byItem} emptyMessage="لا توجد بيانات" tableMinWidth={560} /></OrdersV4Panel><OrdersV4Panel title="التسجيل حسب القسم"><SimpleTable columns={sectionColumns} data={report.bySection} emptyMessage="لا توجد بيانات" /></OrdersV4Panel></div><OrdersV4Panel title="سجل التسجيلات"><SimpleTable columns={documentColumns} data={report.documents} emptyMessage="لا توجد تسجيلات" tableMinWidth={760} /></OrdersV4Panel></>}</div>;
}
