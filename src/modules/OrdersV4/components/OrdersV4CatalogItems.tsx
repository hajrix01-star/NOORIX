import React, { useMemo, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4Item } from '../../../types/api';
import { Button, Checkbox, Input, SimpleTable, type SimpleTableColumn } from '../../../ui';
import { exportToExcel } from '../../../utils/exportUtils';
import { OrdersV4Select, v4Number } from '../OrdersV4Shared';
import {
  filterOrdersV4CatalogItems,
  ordersV4ItemLastPrice,
  ordersV4ItemUnitsSummary,
  type OrdersV4CatalogItemKind,
} from './ordersV4Catalog.utils';

export function OrdersV4CatalogItems({
  data,
  canDelete,
  onAdd,
  onEdit,
  onDeactivate,
}: {
  data: OrdersV4Bootstrap;
  canDelete: boolean;
  onAdd: (kind: OrdersV4CatalogItemKind) => void;
  onEdit: (item: OrdersV4Item) => void;
  onDeactivate: (id: string) => Promise<unknown>;
}) {
  const [kind, setKind] = useState<OrdersV4CatalogItemKind>('purchased');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const totalForKind = data.items.filter((item) => item.isActive && item.itemType === kind).length;
  const rows = useMemo(() => filterOrdersV4CatalogItems(data.items, { kind, search, categoryId, sectionId }), [categoryId, data.items, kind, search, sectionId]);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function toggleAll() {
    setSelected((current) => allSelected
      ? new Set([...current].filter((id) => !rows.some((row) => row.id === id)))
      : new Set([...current, ...rows.map((row) => row.id)]));
  }

  async function deactivateSelected() {
    for (const id of selected) await onDeactivate(id);
    setSelected(new Set());
  }

  const columns = useMemo<SimpleTableColumn<OrdersV4Item>[]>(() => [
    {
      key: 'selected', label: <Checkbox checked={allSelected} onChange={toggleAll} aria-label="تحديد الكل" />, width: 52, align: 'center',
      render: (_value, row) => <Checkbox checked={selected.has(row.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })} aria-label={`تحديد ${row.nameAr}`} />,
    },
    { key: 'nameAr', label: 'اسم الصنف (عربي)', minWidth: 190, render: (_value, row) => <Button variant="raw" size="auto" className="font-bold text-noorix-blue hover:underline" onClick={() => onEdit(row)}>{row.nameAr}</Button> },
    { key: 'nameEn', label: 'اسم الصنف (إنجليزي)', minWidth: 170, render: (_value, row) => row.nameEn || '—' },
    { key: 'category', label: 'الفئة', render: (_value, row) => row.category?.nameAr || '—' },
    { key: 'sections', label: 'الأقسام', minWidth: 140, render: (_value, row) => row.sections.map((link) => link.section.nameAr).join(' · ') || '—' },
    { key: 'units', label: 'المواصفات', minWidth: 220, render: (_value, row) => <span className="text-[12px] text-noorix-muted">{ordersV4ItemUnitsSummary(row)}</span> },
    { key: 'price', label: 'آخر سعر', numeric: true, render: (_value, row) => { const price = ordersV4ItemLastPrice(row); return price == null ? '—' : v4Number(price, 2); } },
  ], [allSelected, onEdit, rows, selected]);

  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl border border-noorix-border bg-noorix-bg-muted/50 p-1" role="tablist" aria-label="نوع الأصناف">
        <Button variant={kind === 'purchased' ? 'primary' : 'raw'} size="sm" role="tab" aria-selected={kind === 'purchased'} onClick={() => { setKind('purchased'); setSelected(new Set()); }}>أصناف الطلبات</Button>
        <Button variant={kind === 'sale' ? 'primary' : 'raw'} size="sm" role="tab" aria-selected={kind === 'sale'} onClick={() => { setKind('sale'); setSelected(new Set()); }}>أصناف التسجيل الداخلي</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => onAdd(kind)}>+ إضافة صنف</Button>
        <Button size="sm" variant="ghost" disabled={!rows.length} onClick={() => exportToExcel(rows.map((row) => ({
          'الاسم العربي': row.nameAr,
          'الاسم الإنجليزي': row.nameEn || '',
          SKU: row.sku || '',
          'الفئة': row.category?.nameAr || '',
          'الأقسام': row.sections.map((link) => link.section.nameAr).join(' | '),
          'الوحدات': ordersV4ItemUnitsSummary(row),
          'آخر سعر': ordersV4ItemLastPrice(row) ?? '',
        })), `orders-v4-${kind}.xlsx`, { title: kind === 'purchased' ? 'أصناف الطلبات' : 'أصناف التسجيل الداخلي' })}>تصدير Excel</Button>
        <Button size="sm" variant="ghost" onClick={() => exportToExcel([{
          'الاسم العربي': '', 'الاسم الإنجليزي': '', SKU: '', 'النوع': kind,
          'الفئة': '', 'القسم': '', 'وحدة المخزون': '',
        }], 'orders-v4-import-template.xlsx', { title: 'قالب استيراد أصناف طلبات V4' })}>قالب الاستيراد</Button>
        {canDelete && selected.size > 0 && <Button variant="danger" size="sm" onClick={deactivateSelected}>تعطيل المحدد ({selected.size})</Button>}
      </div>
    </div>
    <div className="grid gap-2 rounded-xl border border-noorix-border bg-noorix-surface p-3 md:grid-cols-[minmax(220px,1fr)_220px_220px_auto]">
      <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث في الأصناف…" />
      <OrdersV4Select value={sectionId} onChange={(event) => setSectionId(event.target.value)} aria-label="القسم"><option value="">كل الأقسام</option>{data.sections.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select>
      <OrdersV4Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="الفئة"><option value="">كل الفئات</option>{data.categories.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select>
      <span className="inline-flex items-center justify-center rounded-full border border-noorix-border bg-noorix-bg-muted px-3 text-[12px] text-noorix-muted">{rows.length} / {totalForKind}</span>
    </div>
    <SimpleTable columns={columns} data={rows} tableMinWidth={1060} emptyMessage={totalForKind ? 'لا توجد نتائج مطابقة' : 'أضف أول صنف'} />
  </div>;
}
