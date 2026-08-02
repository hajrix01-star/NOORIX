import React, { useEffect, useMemo, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4Item } from '../../../types/api';
import { Button, Checkbox, DialogActions, Input, Modal } from '../../../ui';
import { OrdersV4Field, OrdersV4Select } from '../OrdersV4Shared';
import type { useOrdersV4CatalogMutations } from '../useOrdersV4';
import { ordersV4BuiltInTemplates } from './ordersV4Catalog.utils';

type Mutations = ReturnType<typeof useOrdersV4CatalogMutations>;
type CardTab = 'data' | 'prices' | 'definition';
type UnitRow = { unitId: string; purchaseLabel: string; lastPrice: string; isOrderEnabled: boolean };
type ConversionRow = { key: string; fromUnitId: string; toUnitId: string; factor: string; reversible: boolean; allowDimensionBridge: boolean };
type RecipeRow = { key: string; componentItemId: string; quantity: string; unitId: string };

const conversionRow = (): ConversionRow => ({
  key: crypto.randomUUID(), fromUnitId: '', toUnitId: '', factor: '1', reversible: true, allowDimensionBridge: false,
});
const recipeRow = (): RecipeRow => ({ key: crypto.randomUUID(), componentItemId: '', quantity: '1', unitId: '' });

export function OrdersV4ItemCard({
  item,
  initialKind,
  data,
  mutations,
  onClose,
}: {
  item: OrdersV4Item | null;
  initialKind: 'purchased' | 'sale';
  data: OrdersV4Bootstrap;
  mutations: Mutations;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<CardTab>('data');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sku, setSku] = useState('');
  const [itemType, setItemType] = useState<'purchased' | 'sale'>(initialKind);
  const [categoryId, setCategoryId] = useState('');
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [trackInventory, setTrackInventory] = useState(true);
  const [inventoryUnitId, setInventoryUnitId] = useState('');
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [conversionRows, setConversionRows] = useState<ConversionRow[]>([conversionRow()]);
  const [outputQuantity, setOutputQuantity] = useState('1');
  const [outputUnitId, setOutputUnitId] = useState('');
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([recipeRow()]);
  const [componentSearch, setComponentSearch] = useState('');

  const currentConversion = useMemo(
    () => data.conversions.find((version) => version.itemId === item?.id && version.status === 'published'),
    [data.conversions, item?.id],
  );
  const currentRecipe = useMemo(
    () => data.recipes.find((version) => version.outputItemId === item?.id && version.status === 'published'),
    [data.recipes, item?.id],
  );

  useEffect(() => {
    setTab('data');
    setNameAr(item?.nameAr ?? '');
    setNameEn(item?.nameEn ?? '');
    setSku(item?.sku ?? '');
    setItemType(item?.itemType ?? initialKind);
    setCategoryId(item?.categoryId ?? '');
    setSectionIds(item?.sections.map((link) => link.section.id) ?? []);
    setTrackInventory(item?.trackInventory ?? true);
    setInventoryUnitId(item?.inventoryUnitId ?? '');
    setUnitRows(item?.units.filter((row) => row.isActive).map((row) => ({
      unitId: row.unitId,
      purchaseLabel: row.purchaseLabel ?? '',
      lastPrice: String(row.lastPrice ?? ''),
      isOrderEnabled: row.isOrderEnabled,
    })) ?? []);
    setConversionRows(currentConversion?.edges.map((edge) => ({
      key: edge.id,
      fromUnitId: edge.fromUnitId,
      toUnitId: edge.toUnitId,
      factor: String(edge.factor),
      reversible: edge.reversible,
      allowDimensionBridge: edge.allowDimensionBridge,
    })) ?? [conversionRow()]);
    setOutputQuantity(String(currentRecipe?.outputQuantity ?? '1'));
    setOutputUnitId(currentRecipe?.outputUnitId ?? item?.inventoryUnitId ?? '');
    setRecipeRows(currentRecipe?.lines.map((line) => ({
      key: line.id,
      componentItemId: line.componentItemId,
      quantity: String(line.quantity),
      unitId: line.unitId,
    })) ?? [recipeRow()]);
  }, [currentConversion, currentRecipe, initialKind, item]);

  const availableUnits = data.units.filter((unit) => unit.isActive && !unitRows.some((row) => row.unitId === unit.id));
  const componentItems = data.items.filter((candidate) => candidate.isActive && candidate.id !== item?.id && (
    !componentSearch.trim() || `${candidate.nameAr} ${candidate.nameEn ?? ''}`.toLocaleLowerCase('ar').includes(componentSearch.trim().toLocaleLowerCase('ar'))
  ));
  const busy = mutations.createItem.isPending || mutations.updateItem.isPending
    || mutations.replaceItemUnits.isPending || mutations.publishConversion.isPending || mutations.publishRecipe.isPending;

  function toggleSection(sectionId: string, checked: boolean) {
    setSectionIds((current) => checked ? [...new Set([...current, sectionId])] : current.filter((id) => id !== sectionId));
  }

  async function save() {
    if (!nameAr.trim()) return;
    if (!item) {
      if (!inventoryUnitId) return;
      await mutations.createItem.mutateAsync({
        sku: sku.trim() || undefined,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        itemType,
        categoryId: categoryId || null,
        inventoryUnitId,
        sectionIds,
        trackInventory,
        units: [{ unitId: inventoryUnitId, purchaseLabel: '', isOrderEnabled: itemType === 'purchased', lastPrice: null }],
      });
      onClose();
      return;
    }
    if (tab === 'data') {
      await mutations.updateItem.mutateAsync({
        id: item.id,
        body: { sku: sku.trim() || null, nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined, categoryId: categoryId || null, sectionIds, trackInventory },
      });
    } else if (tab === 'prices') {
      if (!inventoryUnitId || !unitRows.length) return;
      await mutations.replaceItemUnits.mutateAsync({
        id: item.id,
        body: {
          inventoryUnitId,
          units: unitRows.map((row, sortOrder) => ({ ...row, purchaseLabel: row.purchaseLabel.trim() || null, lastPrice: row.lastPrice || null, sortOrder })),
        },
      });
    } else if (item.itemType === 'purchased') {
      await mutations.publishConversion.mutateAsync({
        itemId: item.id,
        edges: conversionRows.map(({ fromUnitId, toUnitId, factor, reversible, allowDimensionBridge }) => ({
          fromUnitId, toUnitId, factor, reversible, allowDimensionBridge,
        })),
      });
    } else {
      await mutations.publishRecipe.mutateAsync({
        outputItemId: item.id,
        outputQuantity,
        outputUnitId,
        lines: recipeRows.map(({ componentItemId, quantity, unitId }) => ({ componentItemId, quantity, unitId })),
      });
    }
    onClose();
  }

  const tabButton = (id: CardTab, label: string) => (
    <Button key={id} type="button" variant={tab === id ? 'primary' : 'ghost'} size="sm" onClick={() => setTab(id)}>{label}</Button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={item ? `بطاقة الصنف — ${item.nameAr}` : `إضافة ${initialKind === 'purchased' ? 'صنف طلبات' : 'صنف تسجيل داخلي'}`}
      footer={<DialogActions actions={[
        { key: 'cancel', label: 'إلغاء', role: 'cancel', disabled: busy, onClick: onClose },
        { key: 'save', label: tab === 'definition' ? 'تحقق وانشر' : 'حفظ', role: 'save', loading: busy, disabled: busy, onClick: save },
      ]} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-1.5">
          {tabButton('data', 'البيانات')}
          {item && tabButton('prices', 'الأحجام والأسعار')}
          {item && tabButton('definition', item.itemType === 'purchased' ? 'التحويلات' : 'الرسبي')}
        </div>

        {tab === 'data' && (
          <div className="grid gap-4 md:grid-cols-2">
            <OrdersV4Field label="اسم الصنف (عربي) *"><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} /></OrdersV4Field>
            <OrdersV4Field label="اسم الصنف (إنجليزي)"><Input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></OrdersV4Field>
            <OrdersV4Field label="SKU"><Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="اختياري" /></OrdersV4Field>
            {!item && <OrdersV4Field label="نوع الصنف"><OrdersV4Select value={itemType} onChange={(event) => setItemType(event.target.value as 'purchased' | 'sale')}><option value="purchased">صنف طلبات</option><option value="sale">صنف تسجيل داخلي</option></OrdersV4Select></OrdersV4Field>}
            {!item && <OrdersV4Field label="وحدة المخزون"><OrdersV4Select value={inventoryUnitId} onChange={(event) => setInventoryUnitId(event.target.value)}><option value="">اختر</option>{data.units.filter((unit) => unit.isActive).map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>}
            <OrdersV4Field label="الفئة"><OrdersV4Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">بدون فئة</option>{data.categories.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
            <OrdersV4Field label="الأقسام"><div className="flex flex-wrap gap-2">{data.sections.filter((row) => row.isActive).map((section) => <label key={section.id} className="flex items-center gap-2 rounded-lg border border-noorix-border px-3 py-2 text-[12px]"><Checkbox checked={sectionIds.includes(section.id)} onChange={(event) => toggleSection(section.id, event.target.checked)} />{section.nameAr}</label>)}</div></OrdersV4Field>
            <label className="flex items-center gap-2 text-[12px]"><Checkbox checked={trackInventory} onChange={(event) => setTrackInventory(event.target.checked)} />تتبع المخزون والتكلفة</label>
          </div>
        )}

        {tab === 'prices' && item && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-900">وحدة المخزون تحدد الرصيد. الأسعار مرتبطة بوحدات الطلب والفاتورة وتُحدّث عند الاستلام.</div>
            <OrdersV4Field label="وحدة الخصم من المخزون"><OrdersV4Select value={inventoryUnitId} onChange={(event) => setInventoryUnitId(event.target.value)}>{unitRows.map((row) => <option key={row.unitId} value={row.unitId}>{data.units.find((unit) => unit.id === row.unitId)?.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
            {unitRows.map((row, index) => {
              const unit = data.units.find((candidate) => candidate.id === row.unitId);
              return <div key={row.unitId} className="grid items-end gap-2 rounded-xl border border-noorix-border p-3 lg:grid-cols-[1fr_1.4fr_1fr_auto_auto]">
                <div><div className="text-[11px] text-noorix-muted">وحدة الفاتورة</div><strong>{unit?.nameAr}</strong></div>
                <OrdersV4Field label="وصف الشراء / الحجم"><Input value={row.purchaseLabel} onChange={(event) => setUnitRows((current) => current.map((entry, rowIndex) => rowIndex === index ? { ...entry, purchaseLabel: event.target.value } : entry))} placeholder={`مثال: كبير / ${unit?.nameAr ?? ''}`} /></OrdersV4Field>
                <OrdersV4Field label="السعر الظاهر"><Input type="number" min="0" step="any" value={row.lastPrice} onChange={(event) => setUnitRows((current) => current.map((entry, rowIndex) => rowIndex === index ? { ...entry, lastPrice: event.target.value } : entry))} /></OrdersV4Field>
                <label className="flex items-center gap-2 pb-2 text-[12px]"><Checkbox checked={row.isOrderEnabled} onChange={(event) => setUnitRows((current) => current.map((entry, rowIndex) => rowIndex === index ? { ...entry, isOrderEnabled: event.target.checked } : entry))} />تظهر في الطلبات</label>
                <Button variant="danger" size="sm" disabled={unitRows.length === 1 || row.unitId === inventoryUnitId} onClick={() => setUnitRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>حذف</Button>
              </div>;
            })}
            <OrdersV4Field label="+ إضافة وحدة"><OrdersV4Select value="" onChange={(event) => { if (event.target.value) setUnitRows((current) => [...current, { unitId: event.target.value, purchaseLabel: '', lastPrice: '', isOrderEnabled: item.itemType === 'purchased' }]); }}><option value="">اختر وحدة</option>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
          </div>
        )}

        {tab === 'definition' && item?.itemType === 'purchased' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-6 text-amber-950"><b>سلسلة المخزون:</b> اكتبها مرة واحدة من العبوة الأكبر إلى الأصغر. وحدة الخصم الحالية: {item.inventoryUnit.nameAr}.</div>
            <div className="flex flex-wrap gap-2">{ordersV4BuiltInTemplates(data.units).map((template) => <Button key={template.name} size="sm" variant="ghost" onClick={() => setConversionRows([{ key: crypto.randomUUID(), fromUnitId: template.fromUnitId, toUnitId: template.toUnitId, factor: template.factor, reversible: true, allowDimensionBridge: false }])}>{template.name}</Button>)}</div>
            {conversionRows.map((row, index) => <div key={row.key} className="grid items-end gap-2 rounded-xl border border-noorix-border p-3 lg:grid-cols-[44px_1fr_1fr_0.7fr_auto]">
              <strong className="pb-2 text-center">{index + 1}</strong>
              <OrdersV4Field label="من وحدة"><OrdersV4Select value={row.fromUnitId} onChange={(event) => setConversionRows((current) => current.map((entry) => entry.key === row.key ? { ...entry, fromUnitId: event.target.value } : entry))}><option value="">اختر</option>{unitRows.map((itemUnit) => <option key={itemUnit.unitId} value={itemUnit.unitId}>{data.units.find((unit) => unit.id === itemUnit.unitId)?.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
              <OrdersV4Field label="إلى وحدة"><OrdersV4Select value={row.toUnitId} onChange={(event) => setConversionRows((current) => current.map((entry) => entry.key === row.key ? { ...entry, toUnitId: event.target.value } : entry))}><option value="">اختر</option>{unitRows.map((itemUnit) => <option key={itemUnit.unitId} value={itemUnit.unitId}>{data.units.find((unit) => unit.id === itemUnit.unitId)?.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
              <OrdersV4Field label="كل 1 يحتوي"><Input type="number" min="0" step="any" value={row.factor} onChange={(event) => setConversionRows((current) => current.map((entry) => entry.key === row.key ? { ...entry, factor: event.target.value } : entry))} /></OrdersV4Field>
              <Button variant="danger" size="sm" disabled={conversionRows.length === 1} onClick={() => setConversionRows((current) => current.filter((entry) => entry.key !== row.key))}>حذف</Button>
            </div>)}
            <Button size="sm" onClick={() => setConversionRows((current) => [...current, conversionRow()])}>+ تحويل</Button>
            <div className="rounded-xl border border-green-200 bg-green-50 p-3"><div className="mb-2 text-[11px] font-bold text-green-800">معادلة الصنف</div>{conversionRows.map((row) => { const from = data.units.find((unit) => unit.id === row.fromUnitId)?.nameAr || '؟'; const to = data.units.find((unit) => unit.id === row.toUnitId)?.nameAr || '؟'; return <div key={row.key} className="text-[13px] font-semibold text-green-950">1 {from} = {row.factor || '؟'} {to}</div>; })}</div>
          </div>
        )}

        {tab === 'definition' && item?.itemType === 'sale' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-900"><b>الرسبي:</b> استهلاك مواد المخزون لكل كمية مباعة. التكلفة تُحسب من متوسط آخر 5 طلبات مستلمة.</div>
            <div className="grid gap-3 md:grid-cols-2"><OrdersV4Field label="كمية المخرج"><Input type="number" min="0" step="any" value={outputQuantity} onChange={(event) => setOutputQuantity(event.target.value)} /></OrdersV4Field><OrdersV4Field label="وحدة المخرج"><OrdersV4Select value={outputUnitId} onChange={(event) => setOutputUnitId(event.target.value)}>{unitRows.map((row) => <option key={row.unitId} value={row.unitId}>{data.units.find((unit) => unit.id === row.unitId)?.nameAr}</option>)}</OrdersV4Select></OrdersV4Field></div>
            <Input type="search" value={componentSearch} onChange={(event) => setComponentSearch(event.target.value)} placeholder="بحث في المكونات…" />
            {recipeRows.map((row) => <div key={row.key} className="grid items-end gap-2 rounded-xl border border-noorix-border p-3 lg:grid-cols-[1.5fr_0.7fr_1fr_auto]">
              <OrdersV4Field label="المكوّن"><OrdersV4Select value={row.componentItemId} onChange={(event) => { const component = data.items.find((candidate) => candidate.id === event.target.value); setRecipeRows((current) => current.map((entry) => entry.key === row.key ? { ...entry, componentItemId: event.target.value, unitId: component?.inventoryUnitId ?? '' } : entry)); }}><option value="">اختر المكوّن</option>{componentItems.map((component) => <option key={component.id} value={component.id}>{component.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
              <OrdersV4Field label="الكمية"><Input type="number" min="0" step="any" value={row.quantity} onChange={(event) => setRecipeRows((current) => current.map((entry) => entry.key === row.key ? { ...entry, quantity: event.target.value } : entry))} /></OrdersV4Field>
              <OrdersV4Field label="الوحدة"><OrdersV4Select value={row.unitId} onChange={(event) => setRecipeRows((current) => current.map((entry) => entry.key === row.key ? { ...entry, unitId: event.target.value } : entry))}>{data.items.find((candidate) => candidate.id === row.componentItemId)?.units.filter((unit) => unit.isActive).map((itemUnit) => <option key={itemUnit.unitId} value={itemUnit.unitId}>{itemUnit.unit.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
              <Button variant="danger" size="sm" disabled={recipeRows.length === 1} onClick={() => setRecipeRows((current) => current.filter((entry) => entry.key !== row.key))}>حذف</Button>
            </div>)}
            <Button size="sm" onClick={() => setRecipeRows((current) => [...current, recipeRow()])}>+ مكوّن</Button>
            {currentRecipe && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-[12px] text-green-950">التكلفة الحالية: <b>{currentRecipe.estimatedCost} ر.س</b> — النسخة {currentRecipe.version}</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}
