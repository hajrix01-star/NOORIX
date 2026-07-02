/**
 * OrderFormModal — نموذج إنشاء/تعديل طلب
 * اختيار الأصناف: كروت POS + أزرار أقسام + بحث
 */
import React, { useState, useMemo, useCallback } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import { ProductSearchInput } from '../../../components/common/ProductSearchInput';
import { Button, EditableNumberCell, Input, AdaptiveSheet, FmtNum, Modal } from '../../../ui';
import { useOrderSections } from '../../../hooks/useOrders';

// ─── كرت صنف ──────────────────────────────────────────────────────────────────
function PosProductCard({
  product, lang, qtyInList, onTap, onRemove,
}: {
  product: any; lang: string; qtyInList: number; onTap: () => void; onRemove: () => void;
}) {
  const name = lang === 'en' ? (product.nameEn || product.nameAr) : (product.nameAr || product.nameEn);
  const selected = qtyInList > 0;
  return (
    <div
      onClick={onTap}
      className={`relative rounded-xl border cursor-pointer select-none transition-all p-2 flex flex-col gap-1 min-h-[64px] justify-center
        ${selected
          ? 'border-noorix-blue bg-blue-50 shadow-md ring-1 ring-noorix-blue/30'
          : 'border-noorix-border bg-noorix-surface hover:border-noorix-blue/40 hover:shadow-sm'
        }`}
    >
      {selected && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 end-1 w-5 h-5 rounded-full bg-noorix-red text-white text-[12px] font-bold flex items-center justify-center leading-none hover:opacity-75 transition-opacity"
          tabIndex={-1}
        >
          ×
        </button>
      )}
      {selected && (
        <span className="absolute top-1 start-1 bg-noorix-blue text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
          {qtyInList}
        </span>
      )}
      <div className="text-[12px] font-semibold text-noorix-text leading-snug text-center px-1">{name}</div>
      {product.lastPrice > 0 && (
        <div className="text-[11px] text-noorix-muted text-center ltr">{fmt(product.lastPrice)} SR</div>
      )}
    </div>
  );
}

export function OrderFormModal({
  companyId,
  products = [],
  initialOrder = null,
  createOrder,
  updateOrder,
  onSuccess,
  onError,
  onClose,
  onWhatsApp,
}: any) {
  const { t, lang } = useTranslation();
  const isEdit = !!initialOrder?.id;

  // ─── حالة النموذج ──────────────────────────────────────────────────────────
  const [orderDate, setOrderDate] = useState(() =>
    (initialOrder?.orderDate ? toDateInputYmd(initialOrder.orderDate) || getSaudiToday() : getSaudiToday()));
  const [orderType, setOrderType] = useState(initialOrder?.orderType || 'external');
  const [pettyCashAmount, setPettyCashAmount] = useState(initialOrder?.pettyCashAmount ? String(initialOrder.pettyCashAmount) : '');
  const [notes, setNotes] = useState(initialOrder?.notes || '');
  const [items, setItems] = useState<any[]>(() => {
    if (initialOrder?.items?.length) {
      return initialOrder.items.map((it: any) => ({
        productId: it.productId,
        size: it.size || '',
        packaging: it.packaging || '',
        unit: it.unit || '',
        quantity: String(it.quantity ?? ''),
        unitPrice: String(it.unitPrice ?? ''),
      }));
    }
    return [];
  });
  const [savedOrder, setSavedOrder] = useState<any>(null);

  // ─── حالة POS ──────────────────────────────────────────────────────────────
  const [sectionFilter, setSectionFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [addModal, setAddModal] = useState<{
    product: any; variantKey: string; size: string; packaging: string; unit: string;
    quantity: string; unitPrice: string;
  } | null>(null);

  const { data: sections = [] } = useOrderSections(companyId);

  // ─── مشتقات ────────────────────────────────────────────────────────────────
  const productsById = useMemo(() => {
    const m = new Map();
    products.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  const qtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const prev = m.get(it.productId) ?? 0;
      m.set(it.productId, prev + Math.max(0, parseFloat(it.quantity) || 0));
    }
    return m;
  }, [items]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p: any) => (p.productType || 'order') === 'order');
    if (sectionFilter) {
      list = list.filter((p: any) => {
        const secs = p.sections as string[] | null;
        return Array.isArray(secs) && secs.includes(sectionFilter);
      });
    }
    const q = productSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) =>
        (p.nameAr || '').toLowerCase().includes(q) ||
        (p.nameEn || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, sectionFilter, productSearch]);

  const enrichedItems = useMemo(() => {
    return items.map((it: any) => {
      const p = productsById.get(it.productId);
      const qty = new Decimal(it.quantity || 0);
      const price = new Decimal(it.unitPrice || (p?.lastPrice ?? 0));
      return { ...it, amount: qty.times(price), product: p };
    });
  }, [items, productsById]);

  const totalAmount = useMemo(() =>
    enrichedItems.reduce((sum: any, it: any) => sum.plus(it.amount), new Decimal(0)),
    [enrichedItems]);

  // ─── نقر على كرت ──────────────────────────────────────────────────────────
  const tapProduct = useCallback((p: any) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const sizes = p.sizes ? String(p.sizes).split(/[,،]/).map((x: string) => x.trim()).filter(Boolean) : [];
    const hasVariants = variants.length > 0;
    const hasSizes = sizes.length > 0;

    if (hasVariants || hasSizes) {
      // يفتح مودال الاختيار
      setAddModal({
        product: p,
        variantKey: hasVariants ? (variants[0]?._key || `${variants[0]?.size||''}|${variants[0]?.packaging||''}|${variants[0]?.unit||''}|0`) : '',
        size: !hasVariants && hasSizes ? sizes[0] : '',
        packaging: '',
        unit: variants[0]?.unit || 'piece',
        quantity: '1',
        unitPrice: variants[0]?.lastPrice ? String(variants[0].lastPrice) : (p.lastPrice ? String(p.lastPrice) : ''),
      });
    } else {
      // يضيف مباشرة بكمية 1
      const existIdx = [...items].reverse().findIndex((it: any) => it.productId === p.id);
      const actualIdx = existIdx >= 0 ? items.length - 1 - existIdx : -1;
      if (actualIdx >= 0) {
        setItems((prev: any[]) => {
          const next = [...prev];
          next[actualIdx] = { ...next[actualIdx], quantity: String((parseFloat(next[actualIdx].quantity) || 0) + 1) };
          return next;
        });
      } else {
        setItems((prev: any[]) => [...prev, {
          productId: p.id, size: '', packaging: '', unit: '', quantity: '1',
          unitPrice: p.lastPrice ? String(p.lastPrice) : '',
        }]);
      }
    }
  }, [items]);

  function confirmAddModal() {
    if (!addModal) return;
    const { product, variantKey, size, packaging, unit, quantity, unitPrice } = addModal;
    if (!quantity || parseFloat(quantity) <= 0) { setAddModal(null); return; }
    const variants = Array.isArray(product.variants) ? product.variants : [];
    let resolvedSize = size, resolvedPackaging = packaging, resolvedUnit = unit, resolvedPrice = unitPrice;
    if (variantKey && variants.length > 0) {
      const v = variants.find((x: any, i: number) =>
        (`${x.size||''}|${x.packaging||''}|${x.unit||''}|${i}`) === variantKey ||
        (`${x.size||''}|${x.packaging||''}|${x.unit||''}`) === variantKey.split('|').slice(0,3).join('|')
      ) || variants[0];
      if (v) {
        resolvedSize = v.size || '';
        resolvedPackaging = v.packaging || '';
        resolvedUnit = v.unit || 'piece';
        if (!resolvedPrice) resolvedPrice = v.lastPrice ? String(v.lastPrice) : '';
      }
    }
    setItems((prev: any[]) => [...prev, {
      productId: product.id,
      size: resolvedSize,
      packaging: resolvedPackaging,
      unit: resolvedUnit,
      quantity,
      unitPrice: resolvedPrice || (product.lastPrice ? String(product.lastPrice) : ''),
    }]);
    setAddModal(null);
  }

  function removeItem(idx: number) {
    setItems((prev: any[]) => prev.filter((_: any, i: number) => i !== idx));
  }

  function updateItem(idx: number, field: string, value: any) {
    setItems((prev: any[]) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'productId') {
        const p = productsById.get(value);
        const variants = Array.isArray(p?.variants) ? p.variants : [];
        next[idx].unitPrice = variants[0]?.lastPrice ? String(variants[0].lastPrice) : (p?.lastPrice ? String(p.lastPrice) : '');
        next[idx].size = '';
        next[idx].packaging = '';
        next[idx].unit = variants[0]?.unit || 'piece';
      }
      return next;
    });
  }

  function handleSave() {
    const validItems = items
      .map((it: any) => ({
        productId: it.productId,
        size: it.size?.trim() || undefined,
        packaging: it.packaging?.trim() || undefined,
        unit: it.unit?.trim() || undefined,
        quantity: String(it.quantity || 0),
        unitPrice: String(it.unitPrice || 0),
      }))
      .filter((it: any) => it.productId && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { onError?.(t('ordersAddAtLeastOneItem')); return; }
    const payload = {
      orderDate, orderType,
      pettyCashAmount: orderType === 'external' && pettyCashAmount ? String(pettyCashAmount) : undefined,
      notes: notes.trim() || undefined,
      items: validItems,
    };
    if (isEdit && updateOrder) {
      if (updateOrder.isPending) return;
      updateOrder.mutate({ id: initialOrder.id, body: payload }, {
        onSuccess: (res: any) => { const d = res?.data ?? res ?? { ...initialOrder, ...payload }; setSavedOrder(d); onSuccess?.(d); },
        onError: (e: any) => onError?.(e?.message || t('saveFailed')),
      });
    } else {
      if (!companyId || createOrder.isPending) return;
      createOrder.mutate({ companyId, ...payload }, {
        onSuccess: (res: any) => { const d = res?.data ?? res; setSavedOrder(d); onSuccess?.(d); },
        onError: (e: any) => onError?.(e?.message || t('saveFailed')),
      });
    }
  }

  function resetForm() {
    setOrderDate(getSaudiToday()); setOrderType('external'); setPettyCashAmount('');
    setNotes(''); setItems([]); setSavedOrder(null);
    setSectionFilter(''); setProductSearch('');
  }

  // ─── شاشة النجاح ───────────────────────────────────────────────────────────
  if (savedOrder) {
    return (
      <AdaptiveSheet open onClose={() => { resetForm(); onClose?.(); }} size="sm" side="start" hideClose={false}>
        <div className="text-center py-2">
          <div className="mb-3 text-[48px]">✅</div>
          <h3 className="text-[18px] mb-1.5">{t('orderSaved')}</h3>
          <p className="text-[14px] text-noorix-muted mb-4">
            {t('orderNumber')}: <strong className="text-noorix-blue">{savedOrder.orderNumber}</strong>
          </p>
          <div className="flex items-center flex-wrap gap-4 justify-center mb-5">
            <div className="text-center">
              <div className="text-[11px] text-noorix-muted">{t('total')}</div>
              <div dir="ltr" className="text-[18px] nx-font-numbers text-noorix-green font-[900]"><FmtNum n={savedOrder.totalAmount ?? 0} /> SR</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 items-center">
            <Button variant="success" fullWidth onClick={() => onWhatsApp?.(savedOrder)}>
              {t('sendWhatsApp')} ← {t('order')}
            </Button>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => resetForm()}>{t('ordersAddNewOrder')}</Button>
              <Button size="sm" onClick={() => { onClose?.(); resetForm(); }}>{t('close')}</Button>
            </div>
          </div>
        </div>
      </AdaptiveSheet>
    );
  }

  // ─── نافذة الحجم/الكمية/السعر ──────────────────────────────────────────────
  const addModalVariants = addModal
    ? (Array.isArray(addModal.product.variants) ? addModal.product.variants : []).map((x: any, i: number) => ({
        ...x, _key: `${x.size||''}|${x.packaging||''}|${x.unit||''}|${i}`,
      }))
    : [];
  const addModalSizes = addModal
    ? (addModal.product.sizes ? String(addModal.product.sizes).split(/[,،]/).map((x: string) => x.trim()).filter(Boolean) : [])
    : [];

  const productName = addModal
    ? (lang === 'en' ? (addModal.product.nameEn || addModal.product.nameAr) : (addModal.product.nameAr || addModal.product.nameEn))
    : '';

  return (
    <>
      <AdaptiveSheet
        open
        onClose={onClose}
        title={isEdit ? t('ordersEditOrder') : t('ordersNewOrder')}
        size="xl"
        side="start"
        footer={
          <Button
            variant="primary"
            fullWidth
            disabled={(isEdit ? updateOrder?.isPending : createOrder.isPending) || totalAmount.lte(0) || products.length === 0}
            loading={isEdit ? updateOrder?.isPending : createOrder.isPending}
            onClick={handleSave}
          >
            {t('save')}
          </Button>
        }
      >
        {/* ─── معلومات الطلب (صف مضغوط) ─── */}
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl bg-noorix-bg-muted/50 border border-noorix-border">
          {/* التاريخ */}
          <div className="flex flex-col gap-1 min-w-[130px] flex-1">
            <label className="text-[11px] text-noorix-muted font-medium">{t('orderDate')} *</label>
            <Input type="date" value={orderDate} onChange={(e: any) => setOrderDate(e.target.value)} />
          </div>

          {/* نوع الطلب — أزرار */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-noorix-muted font-medium">{t('orderType')} *</label>
            <div className="inline-flex rounded-xl border border-noorix-border overflow-hidden text-[12px] h-[38px]">
              {(['external', 'internal'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`px-4 font-semibold transition-colors
                    ${orderType === type
                      ? 'bg-noorix-blue text-white'
                      : 'bg-noorix-surface text-noorix-muted hover:bg-noorix-bg-muted'}`}
                >
                  {type === 'external' ? t('orderTypeExternal') : t('orderTypeInternal')}
                </button>
              ))}
            </div>
          </div>

          {/* مبلغ العهدة */}
          {orderType === 'external' && (
            <div className="flex flex-col gap-1 min-w-[110px] flex-1">
              <label className="text-[11px] text-noorix-muted font-medium">{t('pettyCashAmount')}</label>
              <Input type="number" min="0" step="0.01"
                value={pettyCashAmount} onChange={(e: any) => setPettyCashAmount(e.target.value)} placeholder="0.00" />
            </div>
          )}
        </div>

        {/* ─── اختيار الأصناف (POS) ─── */}
        <div className="mb-4">
          <label className="text-[13px] font-bold block mb-2">{t('orderItems')}</label>

          {products.length === 0 ? (
            <div className="p-5 text-center text-noorix-muted text-[13px] border-2 border-dashed border-noorix-border rounded-xl">
              {t('ordersNoProducts')}
            </div>
          ) : (
            <>
              {/* أزرار الأقسام */}
              {(sections as any[]).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => setSectionFilter('')}
                    className={`px-3 py-1 rounded-xl text-[12px] font-semibold border transition-all
                      ${!sectionFilter
                        ? 'bg-noorix-blue text-white border-noorix-blue shadow-sm'
                        : 'bg-noorix-surface text-noorix-text border-noorix-border hover:border-noorix-blue/50'}`}
                  >
                    {t('allSections')}
                  </button>
                  {(sections as any[]).map((s: any) => {
                    const label = lang === 'en' ? (s.nameEn || s.nameAr) : (s.nameAr || s.nameEn);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSectionFilter(sectionFilter === s.nameAr ? '' : s.nameAr)}
                        className={`px-3 py-1 rounded-xl text-[12px] font-semibold border transition-all
                          ${sectionFilter === s.nameAr
                            ? 'bg-noorix-blue text-white border-noorix-blue shadow-sm'
                            : 'bg-noorix-surface text-noorix-text border-noorix-border hover:border-noorix-blue/50'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* بحث */}
              <div className="relative mb-3">
                <Input
                  type="search"
                  value={productSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                  placeholder={t('staffOrderSearchPlaceholder')}
                  prefix="🔍"
                  className="rounded-xl ps-9"
                />
              </div>

              {/* شبكة الكروت */}
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  {filteredProducts.map((p: any) => (
                    <PosProductCard
                      key={p.id}
                      product={p}
                      lang={lang}
                      qtyInList={Math.round(qtyMap.get(p.id) ?? 0)}
                      onTap={() => tapProduct(p)}
                      onRemove={() => setItems((prev: any[]) => prev.filter((it: any) => it.productId !== p.id))}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center text-noorix-muted text-[13px] py-4">{t('ordersNoSearchResults')}</div>
              )}
            </>
          )}
        </div>

        {/* ─── جدول البنود المضافة ─── */}
        {items.length > 0 && (
          <div className="mb-4 overflow-x-auto border border-noorix-border rounded-xl">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
                  <th className="text-end font-bold py-3 px-3">{t('product')}</th>
                  <th className="text-end font-bold py-3 px-3">{t('ordersProductSize')} / {t('ordersProductPackaging')}</th>
                  <th className="text-end font-bold py-3 px-3">{t('quantity')}</th>
                  <th className="text-end font-bold py-3 px-3">{t('unitPrice')}</th>
                  <th className="text-end font-bold py-3 px-3">{t('total')}</th>
                  <th className="w-12 py-3 px-1" />
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, idx: number) => {
                  const p = productsById.get(it.productId);
                  const variantsArr = Array.isArray(p?.variants) ? p.variants : [];
                  const sizesArr = p?.sizes ? String(p.sizes).split(/[,،]/).map((x: any) => x.trim()).filter(Boolean) : [];
                  const variantLabel = [it.size, it.packaging, it.unit].filter(Boolean).join(' / ') || '—';
                  return (
                    <tr key={idx} className="border-b border-noorix-border hover:bg-noorix-bg-muted/30 transition-colors">
                      <td className="py-3 px-3 min-w-[160px]">
                        <ProductSearchInput
                          products={products}
                          productsById={productsById}
                          value={it.productId}
                          onChange={(pid: any) => updateItem(idx, 'productId', pid)}
                          onSelectProduct={(sel: any) => {
                            setItems((prev: any[]) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], productId: sel.productId, size: sel.size || '', packaging: sel.packaging || '', unit: sel.unit || 'piece', unitPrice: sel.unitPrice || next[idx].unitPrice };
                              return next;
                            });
                          }}
                          placeholder={t('selectProduct')}
                          compact
                        />
                      </td>
                      <td className="py-3 px-3 min-w-[120px]">
                        {variantsArr.length > 0 ? (
                          <Input type="select"
                            value={`${it.size||''}|${it.packaging||''}|${it.unit||''}`}
                            onChange={(e: any) => {
                              const v = variantsArr.find((x: any) => `${x.size||''}|${x.packaging||''}|${x.unit||''}` === e.target.value);
                              if (v) setItems((prev: any[]) => { const next = [...prev]; next[idx] = { ...next[idx], size: v.size||'', packaging: v.packaging||'', unit: v.unit||'piece', unitPrice: v.lastPrice ? String(v.lastPrice) : next[idx].unitPrice }; return next; });
                            }}
                          >
                            {variantsArr.map((v: any) => (
                              <option key={`${v.size}|${v.packaging}|${v.unit}`} value={`${v.size||''}|${v.packaging||''}|${v.unit||''}`}>
                                {[v.size, v.packaging, v.unit].filter(Boolean).join(' / ') || '—'}
                              </option>
                            ))}
                          </Input>
                        ) : sizesArr.length > 0 ? (
                          <Input type="select" value={it.size} onChange={(e: any) => updateItem(idx, 'size', e.target.value)}>
                            <option value="">—</option>
                            {sizesArr.map((s: any) => <option key={s} value={s}>{s}</option>)}
                          </Input>
                        ) : (
                          <span className="text-noorix-muted text-[13px]">{variantLabel}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <Input type="number" min="0" step="0.01" value={it.quantity} onChange={(e: any) => updateItem(idx, 'quantity', e.target.value)} className="w-[80px]" />
                      </td>
                      <td className="py-3 px-3">
                        <Input type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e: any) => updateItem(idx, 'unitPrice', e.target.value)} className="w-[90px]" />
                      </td>
                      <td className="nx-cell-num font-bold text-noorix-green py-3 px-3 whitespace-nowrap"><FmtNum n={enrichedItems[idx]?.amount ?? 0} /> SR</td>
                      <td className="py-3 px-1">
                        <Button size="sm" variant="danger" onClick={() => removeItem(idx)}>✕</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ملاحظات + إجمالي ─── */}
        <div className="mb-4">
          <Input multiline label={t('notes')} value={notes} onChange={(e: any) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} />
        </div>

        <div className="noorix-summary-bar">
          <div className="noorix-summary-bar__item">
            <div className="noorix-summary-bar__label">{t('total')}</div>
            <div className="noorix-summary-bar__value noorix-summary-bar__value--green"><FmtNum n={totalAmount} /> SR</div>
          </div>
        </div>
      </AdaptiveSheet>

      {/* ─── مودال الحجم/الكمية/السعر ─── */}
      {addModal && (
        <Modal open onClose={() => setAddModal(null)} title={productName} size="sm">
          <div className="flex flex-col gap-4 p-1">
            {/* variant أو size */}
            {addModalVariants.length > 0 && (
              <Input type="select" label={t('ordersProductVariants')}
                value={addModal.variantKey}
                onChange={(e: any) => {
                  const key = e.target.value;
                  const v = addModalVariants.find((x: any) => x._key === key);
                  setAddModal((m: any) => m ? {
                    ...m, variantKey: key,
                    size: v?.size || '', packaging: v?.packaging || '', unit: v?.unit || 'piece',
                    unitPrice: v?.lastPrice ? String(v.lastPrice) : m.unitPrice,
                  } : m);
                }}
              >
                {addModalVariants.map((v: any) => (
                  <option key={v._key} value={v._key}>
                    {[v.size, v.packaging, v.unit].filter(Boolean).join(' / ') || '—'}
                    {v.lastPrice ? ` — ${fmt(v.lastPrice)} SR` : ''}
                  </option>
                ))}
              </Input>
            )}
            {addModalVariants.length === 0 && addModalSizes.length > 0 && (
              <Input type="select" label={t('ordersProductSize')}
                value={addModal.size}
                onChange={(e: any) => setAddModal((m: any) => m ? { ...m, size: e.target.value } : m)}
              >
                <option value="">—</option>
                {addModalSizes.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </Input>
            )}
            {/* كمية */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-noorix-muted">{t('quantity')}</label>
              <div className="flex items-center gap-3 justify-center">
                <button type="button"
                  onClick={() => setAddModal((m: any) => m ? { ...m, quantity: String(Math.max(1, parseFloat(m.quantity || '1') - 1)) } : m)}
                  className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
                >−</button>
                <EditableNumberCell
                  min="1"
                  align="start"
                  className="w-16 h-10 text-center text-[18px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg focus:outline-none focus:border-noorix-blue"
                  value={addModal.quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddModal((m: any) => m ? { ...m, quantity: e.target.value } : m)}
                />
                <button type="button"
                  onClick={() => setAddModal((m: any) => m ? { ...m, quantity: String(parseFloat(m.quantity || '0') + 1) } : m)}
                  className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
                >+</button>
              </div>
            </div>
            {/* سعر الوحدة */}
            <Input type="number" min="0" step="0.01" label={`${t('unitPrice')} SR`}
              value={addModal.unitPrice}
              onChange={(e: any) => setAddModal((m: any) => m ? { ...m, unitPrice: e.target.value } : m)}
              placeholder="0.00"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="ghost" size="md" onClick={() => setAddModal(null)}>{t('cancel')}</Button>
              <Button variant="success" size="md" onClick={confirmAddModal}>{t('add')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
