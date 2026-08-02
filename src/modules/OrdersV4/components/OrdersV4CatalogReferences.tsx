import React, { useMemo, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4Category, OrdersV4Section } from '../../../types/api';
import { Button, DialogActions, Input, Modal, SimpleTable, type SimpleTableColumn } from '../../../ui';
import { exportToExcel } from '../../../utils/exportUtils';
import { OrdersV4Field, OrdersV4Panel, OrdersV4Select, v4Number } from '../OrdersV4Shared';
import type { useOrdersV4CatalogMutations } from '../useOrdersV4';
import { ordersV4BuiltInTemplates, ordersV4ConversionEquations } from './ordersV4Catalog.utils';

type Mutations = ReturnType<typeof useOrdersV4CatalogMutations>;
type ReferenceTab = 'sections' | 'categories' | 'units' | 'recipes' | 'locations';
type FormMode = 'category' | 'section' | 'unit' | 'location' | null;

export function OrdersV4CatalogReferences({
  tab,
  data,
  canDelete,
  mutations,
  onOpenItem,
}: {
  tab: ReferenceTab;
  data: OrdersV4Bootstrap;
  canDelete: boolean;
  mutations: Mutations;
  onOpenItem: (id: string) => void;
}) {
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const [dimension, setDimension] = useState('count');
  const [canonicalFactor, setCanonicalFactor] = useState('1');
  const [kind, setKind] = useState('warehouse');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');

  function openCreate(mode: Exclude<FormMode, null>) {
    setEditingId(null); setFormMode(mode); setNameAr(''); setNameEn(''); setCode('');
    setDimension('count'); setCanonicalFactor('1'); setKind('warehouse'); setSectionId('');
  }

  function openCategory(row: OrdersV4Category) {
    setEditingId(row.id); setFormMode('category'); setNameAr(row.nameAr); setNameEn(row.nameEn || '');
  }

  function openSection(row: OrdersV4Section) {
    setEditingId(row.id); setFormMode('section'); setNameAr(row.nameAr); setNameEn(row.nameEn || ''); setCode(row.code);
  }

  async function save() {
    if (!formMode || !nameAr.trim()) return;
    if (formMode === 'category') {
      if (editingId) await mutations.updateCategory.mutateAsync({ id: editingId, body: { nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined } });
      else await mutations.createCategory.mutateAsync({ nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined });
    }
    if (formMode === 'section') {
      if (editingId) await mutations.updateSection.mutateAsync({ id: editingId, body: { code: code.trim() || undefined, nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined } });
      else await mutations.createSection.mutateAsync({ code: code.trim() || undefined, nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined });
    }
    if (formMode === 'unit') await mutations.createUnit.mutateAsync({ code: code.trim(), nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined, dimension, canonicalFactor: canonicalFactor || null });
    if (formMode === 'location') await mutations.createLocation.mutateAsync({ code: code.trim() || undefined, nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined, kind, sectionId: sectionId || null });
    setFormMode(null);
  }

  const filteredCategories = useMemo(() => data.categories.filter((row) => row.isActive && `${row.nameAr} ${row.nameEn || ''}`.toLocaleLowerCase('ar').includes(search.trim().toLocaleLowerCase('ar'))), [data.categories, search]);
  const busy = mutations.createCategory.isPending || mutations.updateCategory.isPending || mutations.createSection.isPending
    || mutations.updateSection.isPending || mutations.createUnit.isPending || mutations.createLocation.isPending;

  const categoryColumns: SimpleTableColumn<OrdersV4Category>[] = [
    { key: 'nameAr', label: 'اسم الفئة (عربي)', render: (_value, row) => <Button variant="raw" size="auto" className="font-bold text-noorix-blue hover:underline" onClick={() => openCategory(row)}>{row.nameAr}</Button> },
    { key: 'nameEn', label: 'اسم الفئة (إنجليزي)', render: (_value, row) => row.nameEn || '—' },
    { key: 'count', label: 'عدد الأصناف', numeric: true, render: (_value, row) => data.items.filter((item) => item.isActive && item.categoryId === row.id).length },
    { key: 'actions', label: 'الإجراءات', render: (_value, row) => <div className="flex gap-2"><Button size="sm" onClick={() => openCategory(row)}>تعديل</Button>{canDelete && <Button size="sm" variant="danger" onClick={() => mutations.deactivate.mutate({ entity: 'category', id: row.id })}>تعطيل</Button>}</div> },
  ];
  const sectionColumns: SimpleTableColumn<OrdersV4Section>[] = [
    { key: 'nameAr', label: 'اسم القسم (عربي)', render: (_value, row) => <strong>{row.nameAr}</strong> },
    { key: 'nameEn', label: 'اسم القسم (إنجليزي)', render: (_value, row) => row.nameEn || '—' },
    { key: 'count', label: 'عدد الأصناف', numeric: true, render: (_value, row) => data.items.filter((item) => item.isActive && item.sections.some((link) => link.section.id === row.id)).length },
    { key: 'actions', label: 'الإجراءات', render: (_value, row) => <div className="flex gap-2"><Button size="sm" onClick={() => openSection(row)}>تعديل</Button>{canDelete && <Button size="sm" variant="danger" onClick={() => mutations.deactivate.mutate({ entity: 'section', id: row.id })}>تعطيل</Button>}</div> },
  ];

  return <>
    <Modal open={formMode !== null} onClose={() => setFormMode(null)} size="md" title={`${editingId ? 'تعديل' : 'إضافة'} ${formMode === 'category' ? 'فئة' : formMode === 'section' ? 'قسم' : formMode === 'unit' ? 'وحدة مركزية' : 'موقع مخزون'}`} footer={<DialogActions actions={[{ key: 'cancel', label: 'إلغاء', role: 'cancel', onClick: () => setFormMode(null), disabled: busy }, { key: 'save', label: 'حفظ', role: 'save', onClick: save, loading: busy, disabled: busy }]} />}>
      <div className="flex flex-col gap-3">
        <OrdersV4Field label="الاسم العربي *"><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} /></OrdersV4Field>
        <OrdersV4Field label="الاسم الإنجليزي"><Input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></OrdersV4Field>
        {(formMode === 'section' || formMode === 'unit' || formMode === 'location') && <OrdersV4Field label="الرمز"><Input value={code} onChange={(event) => setCode(event.target.value)} /></OrdersV4Field>}
        {formMode === 'unit' && <div className="grid grid-cols-2 gap-3"><OrdersV4Field label="النوع"><OrdersV4Select value={dimension} onChange={(event) => setDimension(event.target.value)}><option value="count">وحدة</option><option value="mass">وزن</option><option value="volume">حجم</option><option value="length">طول</option><option value="package">تغليف</option></OrdersV4Select></OrdersV4Field><OrdersV4Field label="المعامل القياسي"><Input value={canonicalFactor} onChange={(event) => setCanonicalFactor(event.target.value)} placeholder="فارغ للتغليف" /></OrdersV4Field></div>}
        {formMode === 'location' && <div className="grid grid-cols-2 gap-3"><OrdersV4Field label="النوع"><OrdersV4Select value={kind} onChange={(event) => setKind(event.target.value)}><option value="warehouse">مستودع</option><option value="section">قسم</option><option value="virtual">افتراضي</option></OrdersV4Select></OrdersV4Field><OrdersV4Field label="القسم"><OrdersV4Select value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">بدون ربط</option>{data.sections.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select></OrdersV4Field></div>}
      </div>
    </Modal>

    {tab === 'sections' && <OrdersV4Panel title="الأقسام" action={<Button variant="primary" size="sm" onClick={() => openCreate('section')}>+ إضافة قسم</Button>}><SimpleTable columns={sectionColumns} data={data.sections.filter((row) => row.isActive)} emptyMessage="لا توجد أقسام" /></OrdersV4Panel>}

    {tab === 'categories' && <OrdersV4Panel title="الفئات" action={<Button variant="primary" size="sm" onClick={() => openCreate('category')}>+ إضافة فئة</Button>}><div className="mb-3 flex flex-wrap justify-between gap-2"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث في الفئات…" className="max-w-[320px]" /><Button size="sm" variant="ghost" disabled={!filteredCategories.length} onClick={() => exportToExcel(filteredCategories.map((row) => ({ 'الاسم العربي': row.nameAr, 'الاسم الإنجليزي': row.nameEn || '' })), 'orders-v4-categories.xlsx', { title: 'فئات طلبات V4' })}>تصدير Excel</Button></div><SimpleTable columns={categoryColumns} data={filteredCategories} emptyMessage="لا توجد فئات مطابقة" /></OrdersV4Panel>}

    {tab === 'units' && <div className="flex flex-col gap-4"><OrdersV4Panel title="الوحدات المركزية" action={<Button variant="primary" size="sm" onClick={() => openCreate('unit')}>+ إضافة وحدة</Button>}><div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] leading-6 text-blue-950"><b>المصدر المركزي للوحدات:</b> تُنشأ الوحدة هنا مرة واحدة، ثم تستوردها بطاقات الأصناف والرسبي. الوحدات الافتراضية: حبة، كيلوجرام، جرام، لتر، ملليلتر، باكيت، علبة، كرتون.</div><SimpleTable columns={[
      { key: 'nameAr', label: 'الوحدة' }, { key: 'code', label: 'الكود' }, { key: 'dimension', label: 'النوع', render: (value) => value === 'package' ? 'تغليف' : value === 'mass' ? 'وزن' : value === 'volume' ? 'حجم' : 'وحدة' }, { key: 'canonicalFactor', label: 'المعامل القياسي', numeric: true, render: (value) => value == null ? 'خاص بالصنف' : v4Number(value, 8) }, ...(canDelete ? [{ key: 'action', label: 'الإجراءات', render: (_value: unknown, row: OrdersV4Bootstrap['units'][number]) => <Button size="sm" variant="danger" onClick={() => mutations.deactivate.mutate({ entity: 'unit', id: row.id })}>تعطيل</Button> } as SimpleTableColumn<OrdersV4Bootstrap['units'][number]>] : []),
    ]} data={data.units.filter((row) => row.isActive)} tableMinWidth={680} /></OrdersV4Panel><OrdersV4Panel title="قوالب التحويل"><div className="grid gap-2 md:grid-cols-3">{ordersV4BuiltInTemplates(data.units).map((template) => { const from = data.units.find((unit) => unit.id === template.fromUnitId); const to = data.units.find((unit) => unit.id === template.toUnitId); return <div key={template.name} className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3"><strong>{template.name}</strong><div className="mt-2 text-[12px] text-noorix-muted">1 {from?.nameAr} = {template.factor} {to?.nameAr}</div></div>; })}</div></OrdersV4Panel><OrdersV4Panel title="التحويلات المنشورة"><SimpleTable columns={[{ key: 'item', label: 'الصنف', render: (_value, row) => <Button variant="raw" size="auto" className="font-bold text-noorix-blue" onClick={() => onOpenItem(row.itemId)}>{row.item.nameAr}</Button> }, { key: 'version', label: 'النسخة', numeric: true }, { key: 'edges', label: 'سلسلة التحويل', render: (_value, row) => ordersV4ConversionEquations(row).join(' ← ') }, { key: 'status', label: 'الحالة', render: () => 'منشور' }]} data={data.conversions} tableMinWidth={760} emptyMessage="لا توجد تحويلات منشورة" /></OrdersV4Panel></div>}

    {tab === 'recipes' && <OrdersV4Panel title="الرسبي" action={<span className="text-[11px] text-noorix-muted">تُدار الوصفة من بطاقة صنف التسجيل الداخلي</span>}><SimpleTable columns={[{ key: 'outputItem', label: 'صنف التسجيل الداخلي', render: (_value, row) => <Button variant="raw" size="auto" className="font-bold text-noorix-blue" onClick={() => onOpenItem(row.outputItemId)}>{row.outputItem.nameAr}</Button> }, { key: 'version', label: 'النسخة', numeric: true }, { key: 'outputQuantity', label: 'المخرج', render: (_value, row) => `${row.outputQuantity} ${row.outputUnit.nameAr}` }, { key: 'lines', label: 'المكونات', render: (_value, row) => row.lines.map((line) => `${line.componentItem.nameAr}: ${line.quantity} ${line.unit.nameAr}`).join(' · ') }, { key: 'estimatedCost', label: 'التكلفة', numeric: true, render: (value) => `${v4Number(value)} ر.س` }]} data={data.recipes} tableMinWidth={850} emptyMessage="لا توجد وصفات منشورة" /></OrdersV4Panel>}

    {tab === 'locations' && <OrdersV4Panel title="مواقع المخزون" action={<Button variant="primary" size="sm" onClick={() => openCreate('location')}>+ إضافة موقع</Button>}><SimpleTable columns={[{ key: 'nameAr', label: 'الموقع' }, { key: 'code', label: 'الرمز' }, { key: 'kind', label: 'النوع' }, { key: 'section', label: 'القسم', render: (_value, row) => row.section?.nameAr || '—' }, ...(canDelete ? [{ key: 'action', label: 'الإجراءات', render: (_value: unknown, row: OrdersV4Bootstrap['locations'][number]) => <Button size="sm" variant="danger" onClick={() => mutations.deactivate.mutate({ entity: 'location', id: row.id })}>تعطيل</Button> } as SimpleTableColumn<OrdersV4Bootstrap['locations'][number]>] : [])]} data={data.locations.filter((row) => row.isActive)} emptyMessage="لا توجد مواقع" /></OrdersV4Panel>}
  </>;
}
