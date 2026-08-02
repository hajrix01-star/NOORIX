import React, { useEffect, useMemo, useState } from 'react';
import type { OrdersV4Bootstrap, OrdersV4Item } from '../../../types/api';
import { Button, Checkbox, DialogActions, Input, Modal } from '../../../ui';
import { OrdersV4Field, OrdersV4Select } from '../OrdersV4Shared';
import type { useOrdersV4CatalogMutations } from '../useOrdersV4';
import {
  ordersV4CompatibleTargets,
  ordersV4CompleteDefinitionRows,
  ordersV4DefinitionUnitIds,
  ordersV4NextDefinitionRow,
  ordersV4OrderDefinitionRows,
  type OrdersV4DefinitionRow,
} from './ordersV4ItemDefinition.utils';

type Mutations = ReturnType<typeof useOrdersV4CatalogMutations>;
type CardTab = 'data' | 'prices' | 'definition';
type UnitRow = { unitId: string; purchaseLabel: string; lastPrice: string; isOrderEnabled: boolean };
type RecipeRow = { key: string; componentItemId: string; quantity: string; unitId: string };

const conversionRow = (fromUnitId = ''): OrdersV4DefinitionRow => ({ key: crypto.randomUUID(), fromUnitId, toUnitId: '', factor: '1' });
const recipeRow = (): RecipeRow => ({ key: crypto.randomUUID(), componentItemId: '', quantity: '1', unitId: '' });

export function OrdersV4ItemCard({
  item,
  initialKind,
  data,
  mutations,
  onManageCategories,
  onSaved,
  onClose,
}: {
  item: OrdersV4Item | null;
  initialKind: 'purchased' | 'sale';
  data: OrdersV4Bootstrap;
  mutations: Mutations;
  onManageCategories: () => void;
  onSaved: (item: OrdersV4Item) => void;
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
  const [priceUnitIds, setPriceUnitIds] = useState<string[]>([]);
  const [conversionRows, setConversionRows] = useState<OrdersV4DefinitionRow[]>([conversionRow()]);
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
    setPriceUnitIds(item?.units.filter((row) => row.isActive && (row.lastPrice != null || row.isOrderEnabled || row.purchaseLabel)).map((row) => row.unitId) ?? []);
    const savedEdges = currentConversion?.edges.map((edge) => ({
      key: edge.id,
      fromUnitId: edge.fromUnitId,
      toUnitId: edge.toUnitId,
      factor: String(edge.factor),
    })) ?? [];
    setConversionRows(savedEdges.length ? ordersV4OrderDefinitionRows(savedEdges) : [conversionRow(item?.units.find((row) => row.isActive)?.unitId ?? item?.inventoryUnitId ?? '')]);
    setOutputQuantity(String(currentRecipe?.outputQuantity ?? '1'));
    setOutputUnitId(currentRecipe?.outputUnitId ?? item?.inventoryUnitId ?? '');
    setRecipeRows(currentRecipe?.lines.map((line) => ({
      key: line.id,
      componentItemId: line.componentItemId,
      quantity: String(line.quantity),
      unitId: line.unitId,
    })) ?? [recipeRow()]);
  }, [currentConversion, currentRecipe, initialKind, item]);

  const definitionUnitIds = useMemo(
    () => ordersV4DefinitionUnitIds(conversionRows, inventoryUnitId),
    [conversionRows, inventoryUnitId],
  );
  const orphanPriceUnitIds = priceUnitIds.filter((unitId) => !definitionUnitIds.includes(unitId));
  const componentItems = data.items.filter((candidate) => candidate.isActive && candidate.id !== item?.id && (
    !componentSearch.trim() || `${candidate.nameAr} ${candidate.nameEn ?? ''}`.toLocaleLowerCase('ar').includes(componentSearch.trim().toLocaleLowerCase('ar'))
  ));
  const busy = mutations.createItem.isPending || mutations.updateItem.isPending
    || mutations.saveItemDefinition.isPending || mutations.publishRecipe.isPending;

  function toggleSection(sectionId: string, checked: boolean) {
    setSectionIds((current) => checked ? [...new Set([...current, sectionId])] : current.filter((id) => id !== sectionId));
  }

  function definitionPayload() {
    const completeRows = ordersV4CompleteDefinitionRows(conversionRows);
    return {
      inventoryUnitId,
      edges: completeRows.map((row) => ({
        fromUnitId: row.fromUnitId,
        toUnitId: row.toUnitId,
        factor: row.factor,
        reversible: true,
      })),
      units: definitionUnitIds.map((unitId, sortOrder) => {
        const row = unitRows.find((entry) => entry.unitId === unitId);
        const priced = priceUnitIds.includes(unitId);
        return {
          unitId,
          purchaseLabel: priced ? row?.purchaseLabel.trim() || null : null,
          lastPrice: priced && row?.lastPrice ? row.lastPrice : null,
          isOrderEnabled: priced && row?.isOrderEnabled === true && !!row.lastPrice,
          sortOrder,
        };
      }),
    };
  }

  function patchPriceUnit(unitId: string, patch: Partial<UnitRow>) {
    setUnitRows((current) => {
      const existing = current.find((row) => row.unitId === unitId);
      if (!existing) return [...current, { unitId, purchaseLabel: '', lastPrice: '', isOrderEnabled: false, ...patch }];
      return current.map((row) => row.unitId === unitId ? { ...row, ...patch } : row);
    });
  }

  function patchDefinitionRow(index: number, patch: Partial<OrdersV4DefinitionRow>) {
    const next = conversionRows.map((row) => ({ ...row }));
    const previousFrom = next[index]?.fromUnitId;
    const previousTo = next[index]?.toUnitId;
    next[index] = { ...next[index], ...patch };
    if (patch.fromUnitId != null && index > 0) next[index - 1].toUnitId = patch.fromUnitId;
    if (patch.toUnitId != null && next[index + 1] && next[index + 1].fromUnitId === previousTo) next[index + 1].fromUnitId = patch.toUnitId;
    setConversionRows(next);
    if (patch.fromUnitId != null && index === 0 && !next[index].toUnitId && inventoryUnitId === previousFrom) setInventoryUnitId(patch.fromUnitId);
    if (patch.toUnitId && index === next.length - 1) setInventoryUnitId(patch.toUnitId);
  }

  function removeDefinitionRow(index: number) {
    const next = conversionRows.filter((_row, rowIndex) => rowIndex !== index).map((row) => ({ ...row }));
    if (!next.length) {
      setConversionRows([conversionRow()]);
      setInventoryUnitId('');
      return;
    }
    for (let rowIndex = 1; rowIndex < next.length; rowIndex += 1) next[rowIndex].fromUnitId = next[rowIndex - 1].toUnitId;
    setConversionRows(next);
    setInventoryUnitId(next.at(-1)?.toUnitId || next[0].fromUnitId);
  }

  async function save() {
    if (!nameAr.trim()) return;
    if (!item) {
      if (!inventoryUnitId) return;
      const created = await mutations.createItem.mutateAsync({
        sku: sku.trim() || undefined,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        itemType,
        categoryId: categoryId || null,
        inventoryUnitId,
        sectionIds,
        trackInventory,
        units: [{ unitId: inventoryUnitId, purchaseLabel: '', isOrderEnabled: false, lastPrice: null }],
      });
      if (created.data) onSaved(created.data);
      return;
    }
    if (tab === 'data') {
      const updated = await mutations.updateItem.mutateAsync({
        id: item.id,
        body: { sku: sku.trim() || null, nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined, categoryId: categoryId || null, sectionIds, trackInventory },
      });
      if (updated.data) onSaved(updated.data);
    } else if (tab === 'prices') {
      if (!inventoryUnitId || !definitionUnitIds.length || orphanPriceUnitIds.length) return;
      await mutations.saveItemDefinition.mutateAsync({ id: item.id, body: definitionPayload() });
    } else if (item.itemType === 'purchased') {
      if (!inventoryUnitId || !definitionUnitIds.length || orphanPriceUnitIds.length) return;
      await mutations.saveItemDefinition.mutateAsync({ id: item.id, body: definitionPayload() });
    } else {
      await mutations.publishRecipe.mutateAsync({
        outputItemId: item.id,
        outputQuantity,
        outputUnitId,
        lines: recipeRows.map(({ componentItemId, quantity, unitId }) => ({ componentItemId, quantity, unitId })),
      });
    }
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
        { key: 'save', label: tab === 'definition' && item?.itemType === 'purchased' ? 'حفظ الوحدات والتحويلات' : tab === 'definition' ? 'تحقق وانشر' : 'حفظ', role: 'save', loading: busy, disabled: busy || orphanPriceUnitIds.length > 0, onClick: save },
      ]} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-1.5">
          {tabButton('data', 'معلومات عامة')}
          {item && tabButton('prices', 'السعر')}
          {item && tabButton('definition', item.itemType === 'purchased' ? 'الوحدات والتحويلات' : 'الرسبي')}
        </div>

        {tab === 'data' && (
          <div className="grid gap-4 md:grid-cols-2">
            <OrdersV4Field label="اسم الصنف (عربي) *"><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} /></OrdersV4Field>
            <OrdersV4Field label="اسم الصنف (إنجليزي)"><Input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></OrdersV4Field>
            <OrdersV4Field label="SKU"><Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="اختياري" /></OrdersV4Field>
            {!item && <OrdersV4Field label="نوع الصنف"><OrdersV4Select value={itemType} onChange={(event) => setItemType(event.target.value as 'purchased' | 'sale')}><option value="purchased">صنف طلبات</option><option value="sale">صنف تسجيل داخلي</option></OrdersV4Select></OrdersV4Field>}
            {!item && <OrdersV4Field label="وحدة الأساس الأولية"><OrdersV4Select value={inventoryUnitId} onChange={(event) => setInventoryUnitId(event.target.value)}><option value="">اختر</option>{data.units.filter((unit) => unit.isActive).map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</OrdersV4Select><div className="mt-1 text-[10px] text-noorix-muted">يمكن بناء السلسلة وتغيير وحدة الأساس بعد إنشاء الصنف.</div></OrdersV4Field>}
            <OrdersV4Field label="الفئة"><div className="flex gap-2"><OrdersV4Select className="min-w-0 flex-1" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">بدون فئة</option>{data.categories.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.nameAr}</option>)}</OrdersV4Select><Button type="button" size="sm" onClick={onManageCategories}>إدارة الفئات</Button></div></OrdersV4Field>
            <OrdersV4Field label="الأقسام"><div className="flex flex-wrap gap-2">{data.sections.filter((row) => row.isActive).map((section) => <label key={section.id} className="flex items-center gap-2 rounded-lg border border-noorix-border px-3 py-2 text-[12px]"><Checkbox checked={sectionIds.includes(section.id)} onChange={(event) => toggleSection(section.id, event.target.checked)} />{section.nameAr}</label>)}</div></OrdersV4Field>
            <label className="flex items-center gap-2 text-[12px]"><Checkbox checked={trackInventory} onChange={(event) => setTrackInventory(event.target.checked)} />تتبع المخزون والتكلفة</label>
          </div>
        )}

        {tab === 'prices' && item && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] leading-6 text-blue-900">التغليف هنا مستورد حصراً من سلسلة «الوحدات والتحويلات». لا يظهر في الطلبات إلا التغليف الذي حُفظ له سعر وفُعّل.</div>
            {!definitionUnitIds.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-[13px] font-bold text-amber-900">أضف وحدات الصنف وتحويلاته أولًا.</div>
            ) : (
              <OrdersV4Field label="+ إضافة سعر لتغليف">
                <OrdersV4Select value="" onChange={(event) => {
                  const unitId = event.target.value;
                  if (!unitId) return;
                  setPriceUnitIds((current) => [...new Set([...current, unitId])]);
                  patchPriceUnit(unitId, {});
                }}>
                  <option value="">اختر التغليف من سلسلة الصنف</option>
                  {definitionUnitIds.filter((unitId) => !priceUnitIds.includes(unitId)).map((unitId) => <option key={unitId} value={unitId}>{data.units.find((unit) => unit.id === unitId)?.nameAr}</option>)}
                </OrdersV4Select>
              </OrdersV4Field>
            )}
            {priceUnitIds.map((unitId) => {
              if (!definitionUnitIds.includes(unitId)) return <div key={unitId} className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800"><span>التغليف «{data.units.find((unit) => unit.id === unitId)?.nameAr}» لم يعد ضمن سلسلة الصنف. احذفه أو أعده إلى السلسلة قبل الحفظ.</span><Button variant="danger" size="sm" onClick={() => setPriceUnitIds((current) => current.filter((candidate) => candidate !== unitId))}>حذف السعر</Button></div>;
              const row = unitRows.find((entry) => entry.unitId === unitId) ?? { unitId, purchaseLabel: '', lastPrice: '', isOrderEnabled: false };
              const availablePackaging = definitionUnitIds.filter((candidate) => candidate === unitId || !priceUnitIds.includes(candidate));
              return <div key={unitId} className="grid items-end gap-2 rounded-xl border border-noorix-border bg-noorix-bg-surface p-3 lg:grid-cols-[1fr_1.3fr_1fr_auto_auto]">
                <OrdersV4Field label="التغليف"><OrdersV4Select value={unitId} onChange={(event) => {
                  const nextUnitId = event.target.value;
                  setPriceUnitIds((current) => current.map((candidate) => candidate === unitId ? nextUnitId : candidate));
                  patchPriceUnit(nextUnitId, { purchaseLabel: row.purchaseLabel, lastPrice: row.lastPrice, isOrderEnabled: row.isOrderEnabled });
                }}>{availablePackaging.map((candidate) => <option key={candidate} value={candidate}>{data.units.find((unit) => unit.id === candidate)?.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
                <OrdersV4Field label="وصف الشراء / الحجم"><Input value={row.purchaseLabel} onChange={(event) => patchPriceUnit(unitId, { purchaseLabel: event.target.value })} placeholder="مثال: كبير" /></OrdersV4Field>
                <OrdersV4Field label="السعر الظاهر"><Input type="number" min="0" step="any" value={row.lastPrice} onChange={(event) => patchPriceUnit(unitId, { lastPrice: event.target.value })} /></OrdersV4Field>
                <label className="flex items-center gap-2 pb-2 text-[12px]"><Checkbox checked={row.isOrderEnabled} disabled={!row.lastPrice} onChange={(event) => patchPriceUnit(unitId, { isOrderEnabled: event.target.checked })} />يظهر في الطلبات</label>
                <Button variant="danger" size="sm" onClick={() => setPriceUnitIds((current) => current.filter((candidate) => candidate !== unitId))}>حذف</Button>
              </div>;
            })}
          </div>
        )}

        {tab === 'definition' && item?.itemType === 'purchased' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] leading-6 text-blue-950">ابنِ السلسلة من التغليف الكبير إلى الأصغر. مثال: <b>1 كرتون = 10 علب</b> ثم <b>1 علبة = 64 حبة</b>. السطر الجديد يبدأ تلقائيًا من نهاية السابق.</div>
            {!!orphanPriceUnitIds.length && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-bold text-red-800">غيّرت السلسلة وأصبح هناك تغليف مسعّر خارجها. انتقل إلى تبويب السعر واحذف التغليف المتأثر أو أعده إلى السلسلة.</div>}
            {conversionRows.map((row, index) => {
              const fromOptions = index === 0
                ? data.units.filter((unit) => unit.isActive)
                : ordersV4CompatibleTargets(data.units, conversionRows, index - 1);
              const toOptions = ordersV4CompatibleTargets(data.units, conversionRows, index);
              const fromName = data.units.find((unit) => unit.id === row.fromUnitId)?.nameAr || 'الوحدة';
              return <div key={row.key} className="grid items-end gap-2 rounded-xl border border-noorix-border bg-noorix-bg-surface p-3 lg:grid-cols-[44px_1fr_1fr_0.75fr_auto]">
                <strong className="pb-2 text-center">{index + 1}</strong>
                <OrdersV4Field label="الوحدة"><OrdersV4Select value={row.fromUnitId} onChange={(event) => patchDefinitionRow(index, { fromUnitId: event.target.value })}><option value="">اختر الوحدة الرئيسية</option>{fromOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
                <OrdersV4Field label="إلى وحدة"><OrdersV4Select value={row.toUnitId} onChange={(event) => patchDefinitionRow(index, { toUnitId: event.target.value })}><option value="">بدون تحويل / اختر الوحدة التالية</option>{toOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</OrdersV4Select></OrdersV4Field>
                <OrdersV4Field label={`كل 1 ${fromName} يحتوي`}><Input type="number" min="0" step="any" disabled={!row.toUnitId} value={row.factor} onChange={(event) => patchDefinitionRow(index, { factor: event.target.value })} /></OrdersV4Field>
                <Button variant="danger" size="sm" onClick={() => removeDefinitionRow(index)}>حذف</Button>
              </div>;
            })}
            <Button size="sm" disabled={!conversionRows.at(-1)?.toUnitId} onClick={() => setConversionRows((current) => [...current, ordersV4NextDefinitionRow(current)])}>+ إضافة مستوى تحويل</Button>
            {!!definitionUnitIds.length && <div className="grid gap-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3 md:grid-cols-2">
              <div><div className="mb-2 text-[11px] font-bold text-noorix-muted">سلسلة الصنف</div><div className="flex flex-wrap items-center gap-2">{definitionUnitIds.map((unitId, index) => <React.Fragment key={unitId}><span className="rounded-full border border-noorix-border bg-white px-3 py-1.5 text-[12px] font-bold">{data.units.find((unit) => unit.id === unitId)?.nameAr}</span>{index < definitionUnitIds.length - 1 && <span>←</span>}</React.Fragment>)}</div></div>
              <OrdersV4Field label="وحدة أساس المخزون"><OrdersV4Select value={inventoryUnitId} onChange={(event) => setInventoryUnitId(event.target.value)}>{definitionUnitIds.map((unitId) => <option key={unitId} value={unitId}>{data.units.find((unit) => unit.id === unitId)?.nameAr}</option>)}</OrdersV4Select><div className="mt-1 text-[10px] text-noorix-muted">تُختار آخر وحدة تلقائيًا، ويمكن تغييرها إلى أي وحدة متصلة.</div></OrdersV4Field>
            </div>}
            <div className="rounded-xl border border-green-200 bg-green-50 p-3"><div className="mb-2 text-[11px] font-bold text-green-800">المعادلة النهائية</div>{ordersV4CompleteDefinitionRows(conversionRows).length ? ordersV4CompleteDefinitionRows(conversionRows).map((row) => { const from = data.units.find((unit) => unit.id === row.fromUnitId)?.nameAr; const to = data.units.find((unit) => unit.id === row.toUnitId)?.nameAr; return <div key={row.key} className="text-[13px] font-semibold text-green-950">1 {from} = {row.factor} {to}</div>; }) : <div className="text-[12px] text-green-900">صنف بوحدة واحدة — لا يحتاج معادلة تحويل.</div>}</div>
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
