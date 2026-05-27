/**
 * StaffOrdersView — واجهة الموظف لإرسال طلبات القسم
 * تجربة POS: شبكة كروت، ضغطة تضيف للطلب، ملخص أسفل الشاشة
 * تبويبان: طلبات | مبيعات
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { fmt } from '../../utils/format';
import { formatSaudiDate, getSaudiToday } from '../../utils/saudiDate';
import {
  useMyStaffOrders,
  useCreateStaffOrderMutation,
  useUpdateStaffOrderMutation,
  useDeleteStaffOrderMutation,
  useOrderProducts,
  useOrderSections,
} from '../../hooks/useOrders';
import { Button, Badge, ScreenShell, ScreenTitle, Modal, ScreenTabs, Input } from '../../ui';

// ─── أنواع ────────────────────────────────────────────────────────────────────
interface ItemRow { productId: string; quantity: number; unit: string; sectionName?: string; }

/** قسم الصنف عند الإضافة — من الفلتر النشط أو من تعريف الصنف */
function resolveItemSection(product: any, activeFilter: string): string {
  const secs = product?.sections as string[] | null | undefined;
  if (activeFilter && Array.isArray(secs) && secs.includes(activeFilter)) return activeFilter;
  if (Array.isArray(secs) && secs.length === 1) return secs[0];
  if (Array.isArray(secs) && secs.length > 0) return secs[0];
  return activeFilter || 'عام';
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge color={status === 'sent' ? 'green' : 'amber'} size="sm">
      {status === 'sent' ? t('staffOrderSent') : t('staffOrderPending')}
    </Badge>
  );
}

// ─── كرت صنف واحد ─────────────────────────────────────────────────────────────
function ProductCard({
  product, lang, qty, freqCount, onTap, onRemove,
}: {
  product: any; lang: string; qty: number; freqCount: number;
  onTap: () => void; onRemove: () => void;
}) {
  const name = lang === 'en' ? (product.nameEn || product.nameAr) : (product.nameAr || product.nameEn);
  const selected = qty > 0;

  return (
    <div
      className={`relative rounded-xl border transition-all cursor-pointer select-none
        ${selected
          ? 'border-noorix-blue bg-blue-50 shadow-md ring-1 ring-noorix-blue/30'
          : 'border-noorix-border bg-noorix-surface hover:border-noorix-blue/40 hover:shadow-sm'
        }`}
      onClick={onTap}
    >
      {selected && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 start-1 z-10 w-5 h-5 rounded-full bg-noorix-red text-white text-[11px] flex items-center justify-center shadow leading-none"
        >×</button>
      )}
      {selected && (
        <div
          className="absolute top-1 end-1 z-10 min-w-[20px] h-5 px-1 rounded-full bg-noorix-blue text-white text-[11px] font-bold flex items-center justify-center shadow"
          onClick={(e) => e.stopPropagation()}
        >{qty}</div>
      )}
      <div className="p-2.5 pt-5 text-center">
        <div className={`text-[13px] font-semibold leading-snug ${selected ? 'text-noorix-blue' : 'text-noorix-text'}`}>
          {name}
        </div>
        {product.unit && (
          <div className="text-[11px] text-noorix-muted mt-0.5 capitalize">{product.unit}</div>
        )}
        {freqCount > 0 && !selected && (
          <div className="text-[10px] text-noorix-blue/70 mt-0.5">×{freqCount}</div>
        )}
      </div>
    </div>
  );
}

// ─── لوح طلبات (orders أو sales) ─────────────────────────────────────────────
function StaffOrderPanel({
  companyId,
  productType,
}: {
  companyId: string;
  productType: 'order' | 'sale';
}) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();

  const { data: myOrders = [], isLoading } = useMyStaffOrders(companyId);
  const { data: allProducts = [] } = useOrderProducts(companyId, productType);
  const { data: sections = [] } = useOrderSections(companyId);
  const createOrder = useCreateStaffOrderMutation(companyId);
  const updateOrder = useUpdateStaffOrderMutation(companyId);
  const deleteOrder = useDeleteStaffOrderMutation(companyId);

  const isSale = productType === 'sale';
  /** فلتر عرض الأصناف فقط — ليس شرطاً للإرسال */
  const [sectionFilter, setSectionFilter] = useState('');
  const [saleDate, setSaleDate] = useState(() => getSaudiToday());
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [basket, setBasket] = useState<Map<string, ItemRow>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qtyModal, setQtyModal] = useState<{ product: any; qty: number; unit: string } | null>(null);

  // ─── تكرار الطلبات ──────────────────────────────────────────────
  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of (myOrders as any[]).filter((o: any) => (o.orderType || 'order') === productType)) {
      for (const it of (o.items || [])) {
        if (it.productId) m.set(it.productId, (m.get(it.productId) ?? 0) + 1);
      }
    }
    return m;
  }, [myOrders, productType]);

  const productsById = useMemo(() => {
    const m = new Map<string, any>();
    (allProducts as any[]).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [allProducts]);

  function sectionLabel(s: any) {
    return lang === 'en' ? (s.nameEn || s.nameAr) : (s.nameAr || s.nameEn);
  }

  const products = useMemo(() => {
    let list = sectionFilter
      ? (allProducts as any[]).filter((p: any) => {
          const secs = p.sections as string[] | null;
          return Array.isArray(secs) && secs.length > 0 && secs.includes(sectionFilter);
        })
      : (allProducts as any[]);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) =>
        (p.nameAr || '').toLowerCase().includes(q) || (p.nameEn || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a: any, b: any) => {
      const fa = freqMap.get(a.id) ?? 0;
      const fb = freqMap.get(b.id) ?? 0;
      if (fb !== fa) return fb - fa;
      const na = lang === 'en' ? (a.nameEn || a.nameAr) : (a.nameAr || a.nameEn);
      const nb = lang === 'en' ? (b.nameEn || b.nameAr) : (b.nameAr || b.nameEn);
      return na.localeCompare(nb);
    });
  }, [allProducts, sectionFilter, search, freqMap, lang]);

  const basketItems = useMemo(() => Array.from(basket.values()), [basket]);

  // طلبات هذا النوع فقط
  const myTypedOrders = useMemo(
    () => (myOrders as any[]).filter((o: any) => (o.orderType || 'order') === productType),
    [myOrders, productType]
  );
  const pendingOrders = useMemo(() => myTypedOrders.filter((o: any) => o.status === 'pending'), [myTypedOrders]);
  const sentOrders   = useMemo(() => myTypedOrders.filter((o: any) => o.status === 'sent'),    [myTypedOrders]);

  // ─── لمس الكرت ──────────────────────────────────────────────────
  function tapProduct(product: any) {
    const existing = basket.get(product.id);
    const sec = resolveItemSection(product, sectionFilter);
    if (existing) {
      setBasket((prev) => {
        const next = new Map(prev);
        next.set(product.id, { ...existing, quantity: existing.quantity + 1, sectionName: existing.sectionName || sec });
        return next;
      });
    } else {
      setQtyModal({ product, qty: 1, unit: product.unit || 'piece' });
    }
  }

  function confirmQtyModal() {
    if (!qtyModal) return;
    const { product, qty, unit } = qtyModal;
    if (qty <= 0) { setQtyModal(null); return; }
    const sec = resolveItemSection(product, sectionFilter);
    setBasket((prev) => {
      const next = new Map(prev);
      next.set(product.id, { productId: product.id, quantity: qty, unit, sectionName: sec });
      return next;
    });
    setQtyModal(null);
  }

  function removeProduct(productId: string) {
    setBasket((prev) => { const next = new Map(prev); next.delete(productId); return next; });
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) { removeProduct(productId); return; }
    setBasket((prev) => {
      const next = new Map(prev);
      const ex = next.get(productId);
      if (ex) next.set(productId, { ...ex, quantity: qty });
      return next;
    });
  }

  function setUnit(productId: string, unit: string) {
    setBasket((prev) => {
      const next = new Map(prev);
      const ex = next.get(productId);
      if (ex) next.set(productId, { ...ex, unit });
      return next;
    });
  }

  function resetForm() {
    setSectionFilter('');
    setSaleDate(getSaudiToday());
    setNotes('');
    setSearch('');
    setBasket(new Map());
    setEditingId(null);
    setEditingQtyId(null);
  }

  function openWhatsApp(text: string) {
    if (!text?.trim()) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  function loadForEdit(order: any) {
    setSectionFilter(order.sectionName || '');
    setNotes(order.notes || '');
    setSearch('');
    const m = new Map<string, ItemRow>();
    for (const it of (order.items || [])) {
      m.set(it.productId, {
        productId: it.productId,
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'piece',
        sectionName: order.sectionName || undefined,
      });
    }
    setBasket(m);
    setEditingId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSubmit = useCallback(async () => {
    if (basket.size === 0) { showToast(t('staffOrderItemsRequired'), 'error'); return; }
    if (isSale && !saleDate) { showToast(t('staffSaleDateRequired'), 'error'); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        orderType: productType,
        saleDate: isSale ? saleDate : undefined,
        lang,
        notes: notes.trim() || undefined,
        items: basketItems.map((it) => {
          const p = productsById.get(it.productId);
          const sectionName = it.sectionName || (p ? resolveItemSection(p, sectionFilter) : undefined);
          return {
            productId: it.productId,
            quantity: String(it.quantity),
            unit: it.unit || undefined,
            sectionName: sectionName || undefined,
          };
        }),
      };
      if (editingId) {
        payload.sectionName = sectionFilter || basketItems[0]?.sectionName || 'عام';
      }
      if (editingId) {
        await updateOrder.mutateAsync({ id: editingId, body: payload });
        showToast(t('staffOrderUpdated'), 'success');
      } else {
        const res: any = await createOrder.mutateAsync(payload);
        const data = res?.data ?? res;
        if (isSale) {
          showToast(t('staffSaleCreated'), 'success');
          const waText = data?.whatsAppText;
          if (waText) openWhatsApp(waText);
        } else {
          showToast(t('staffOrderCreated'), 'success');
        }
      }
      resetForm();
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [sectionFilter, saleDate, notes, basket, basketItems, productsById, editingId, companyId, productType, isSale, lang, t, showToast, createOrder, updateOrder]);

  const handleDelete = useCallback(async (order: any) => {
    if (!window.confirm(t('staffOrderDeleteConfirm'))) return;
    try {
      await deleteOrder.mutateAsync(order.id);
      showToast(t('deleted'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('deleteFailed'), 'error');
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* ── أزرار الأقسام ── */}
      <div className="flex flex-wrap gap-2">
        {(sections as any[]).map((s: any) => {
          const active = sectionFilter === s.nameAr;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSectionFilter(active ? '' : s.nameAr);
                setSearch('');
              }}
              className={`px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all
                ${active
                  ? 'bg-noorix-blue text-white border-noorix-blue shadow-sm'
                  : 'bg-noorix-surface text-noorix-text border-noorix-border hover:border-noorix-blue/50 hover:text-noorix-blue'
                }`}
            >
              {sectionLabel(s)}
            </button>
          );
        })}
      </div>

      {/* ── بحث ── */}
      <div className="relative">
        <svg className="absolute start-3 top-1/2 -translate-y-1/2 text-noorix-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="w-full h-9 rounded-xl border border-noorix-border bg-noorix-surface ps-9 pe-3 text-[13px] text-noorix-text placeholder:text-noorix-muted focus:outline-none focus:ring-1 focus:ring-noorix-blue"
          placeholder={t('staffOrderSearchProduct')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── شبكة الكروت ── */}
      {products.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {products.map((p: any) => (
            <ProductCard
              key={p.id}
              product={p}
              lang={lang}
              qty={basket.get(p.id)?.quantity ?? 0}
              freqCount={freqMap.get(p.id) ?? 0}
              onTap={() => tapProduct(p)}
              onRemove={() => removeProduct(p.id)}
            />
          ))}
        </div>
      ) : (
        sectionFilter && (
          <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[13px]">
            {t('staffOrderNoProducts')}
          </div>
        )
      )}

      {/* ── ملخص الطلب ── */}
      {basket.size > 0 && (
        <div className="noorix-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-noorix-border flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-noorix-blue">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span className="text-[14px] font-bold">
              {isSale ? t('staffSaleBasket') : t('staffOrderBasket')} ({basket.size})
            </span>
          </div>
          <div className="divide-y divide-noorix-border">
            {basketItems.map((row) => {
              const p = productsById.get(row.productId);
              const name = p ? (lang === 'en' ? (p.nameEn || p.nameAr) : (p.nameAr || p.nameEn)) : row.productId;
              const isEditingQty = editingQtyId === row.productId;
              return (
                <div key={row.productId} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="flex-1 text-[13px] text-noorix-text">{name}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setQty(row.productId, row.quantity - 1)}
                      className="w-7 h-7 rounded-full border border-noorix-border text-[16px] flex items-center justify-center hover:bg-noorix-bg-muted">−</button>
                    {isEditingQty ? (
                      <input autoFocus type="number" min="1"
                        className="w-10 h-7 text-center text-[13px] border border-noorix-blue rounded-lg bg-noorix-bg focus:outline-none"
                        value={row.quantity}
                        onChange={(e) => setQty(row.productId, Number(e.target.value))}
                        onBlur={() => setEditingQtyId(null)}
                      />
                    ) : (
                      <button type="button" onClick={() => setEditingQtyId(row.productId)}
                        className="w-8 h-7 text-center text-[13px] font-bold text-noorix-blue hover:underline"
                      >{row.quantity}</button>
                    )}
                    <button type="button" onClick={() => setQty(row.productId, row.quantity + 1)}
                      className="w-7 h-7 rounded-full border border-noorix-border text-[16px] flex items-center justify-center hover:bg-noorix-bg-muted">+</button>
                  </div>
                  <select
                    className="h-7 rounded-lg border border-noorix-border bg-noorix-bg px-1 text-[11px] text-noorix-text"
                    value={row.unit}
                    onChange={(e) => setUnit(row.productId, e.target.value)}
                  >
                    <option value="piece">{t('ordersUnitPiece')}</option>
                    <option value="kg">{t('ordersUnitKg')}</option>
                    <option value="box">{t('ordersUnitBox')}</option>
                    <option value="dozen">{t('ordersUnitDozen')}</option>
                  </select>
                  <button type="button" onClick={() => removeProduct(row.productId)}
                    className="text-noorix-red text-[16px] px-0.5 hover:opacity-70">×</button>
                </div>
              );
            })}
          </div>
          <div className="px-4 pb-3 pt-2 flex flex-col gap-3">
            {isSale && (
              <Input
                type="date"
                label={t('staffSaleDate')}
                value={saleDate}
                onChange={(e: any) => setSaleDate(e.target.value)}
              />
            )}
            <Input label={t('notes')} value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder={t('optional')} />
          </div>
          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
            <Button variant="ghost" size="md" onClick={resetForm} disabled={submitting}>{t('cancel')}</Button>
            <Button
              variant={isSale ? 'success' : 'primary'}
              size="md"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? t('saving')
                : editingId
                  ? t('staffOrderUpdate')
                  : isSale
                    ? t('staffSaleSubmit')
                    : t('staffOrderSubmit')}
            </Button>
          </div>
        </div>
      )}

      {/* ── طلباتي المعلّقة (طلبات الأقسام فقط — المبيعات تُرسل مباشرة) ── */}
      {!isSale && pendingOrders.length > 0 && (
        <div className="noorix-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-noorix-border flex items-center justify-between">
            <span className="text-[13px] font-bold">{t('staffOrderMyPending')}</span>
            <Badge color="amber" size="sm">{pendingOrders.length}</Badge>
          </div>
          <div className="divide-y divide-noorix-border">
            {pendingOrders.map((o: any) => (
              <div key={o.id} className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px]">{o.sectionName}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => loadForEdit(o)}>{t('edit')}</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(o)}>{t('delete')}</Button>
                  </div>
                </div>
                <div className="text-[11px] text-noorix-muted">{formatSaudiDate(o.createdAt)}</div>
                <div className="flex flex-col gap-1">
                  {(o.items || []).map((it: any, i: number) => {
                    const p = it.product;
                    const name = lang === 'en' ? (p?.nameEn || p?.nameAr || '—') : (p?.nameAr || p?.nameEn || '—');
                    return (
                      <div key={i} className="flex justify-between text-[13px]">
                        <span>{name}</span>
                        <span className="font-semibold nx-font-numbers">{fmt(it.quantity, 0)} {it.unit || ''}</span>
                      </div>
                    );
                  })}
                </div>
                {o.notes && <div className="text-[11px] text-noorix-muted italic">{o.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── مُرسَل ── */}
      {sentOrders.length > 0 && (
        <div className="noorix-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-noorix-border flex items-center justify-between">
            <span className="text-[13px] font-bold text-noorix-muted">
              {isSale ? t('staffSaleMySent') : t('staffOrderMySent')}
            </span>
            <Badge color="green" size="sm">{sentOrders.length}</Badge>
          </div>
          <div className="divide-y divide-noorix-border">
            {sentOrders.slice(0, 10).map((o: any) => (
              <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">{o.sectionName}</span>
                  <span className="text-[11px] text-noorix-muted">
                    {o.saleDate ? formatSaudiDate(o.saleDate) : formatSaudiDate(o.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-noorix-muted">{(o.items || []).length} {t('staffOrderItemsCount')}</span>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && myTypedOrders.length === 0 && basket.size === 0 && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {isSale ? t('staffSaleNoRecords') : t('staffOrderNoOrders')}
        </div>
      )}

      {/* ── نافذة الكمية ── */}
      {qtyModal && (
        <Modal
          open
          onClose={() => setQtyModal(null)}
          title={lang === 'en'
            ? (qtyModal.product.nameEn || qtyModal.product.nameAr)
            : (qtyModal.product.nameAr || qtyModal.product.nameEn)}
          size="sm"
        >
          <div className="flex flex-col gap-5 p-1">
            <div className="flex flex-col gap-2">
              <div className="text-[13px] text-noorix-muted text-center">{t('quantity')}</div>
              <div className="flex items-center justify-center gap-4">
                <button type="button"
                  onClick={() => setQtyModal((m) => m ? { ...m, qty: Math.max(1, m.qty - 1) } : m)}
                  className="w-10 h-10 rounded-full border-2 border-noorix-border text-[22px] flex items-center justify-center hover:border-noorix-blue hover:text-noorix-blue transition-colors"
                >−</button>
                <input type="number" min="1"
                  className="w-20 h-12 text-center text-[22px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg text-noorix-text focus:outline-none focus:border-noorix-blue"
                  value={qtyModal.qty}
                  onChange={(e) => setQtyModal((m) => m ? { ...m, qty: Math.max(1, Number(e.target.value) || 1) } : m)}
                />
                <button type="button"
                  onClick={() => setQtyModal((m) => m ? { ...m, qty: m.qty + 1 } : m)}
                  className="w-10 h-10 rounded-full border-2 border-noorix-border text-[22px] flex items-center justify-center hover:border-noorix-blue hover:text-noorix-blue transition-colors"
                >+</button>
              </div>
            </div>
            <Input type="select" label={t('ordersUnit')} value={qtyModal.unit}
              onChange={(e: any) => setQtyModal((m) => m ? { ...m, unit: e.target.value } : m)}
            >
              <option value="piece">{t('ordersUnitPiece')}</option>
              <option value="kg">{t('ordersUnitKg')}</option>
              <option value="box">{t('ordersUnitBox')}</option>
              <option value="dozen">{t('ordersUnitDozen')}</option>
            </Input>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="ghost" size="md" onClick={() => setQtyModal(null)}>{t('cancel')}</Button>
              <Button variant="success" size="md" onClick={confirmQtyModal}>{t('staffOrderAddItem')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── الشاشة الرئيسية ───────────────────────────────────────────────────────────
export function StaffOrdersView({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'order' | 'sale'>('order');

  const tabs = useMemo(() => [
    { id: 'order', label: t('staffOrdersTabOrders') },
    { id: 'sale',  label: t('staffOrdersTabSales') },
  ], [t]);

  return (
    <ScreenShell>
      <ScreenTitle>{t('staffOrdersTitle')}</ScreenTitle>
      <ScreenTabs
        items={tabs}
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'order' | 'sale')}
        contentClassName="px-3 pt-3 pb-4 sm:px-4"
      >
        <StaffOrderPanel key={activeTab} companyId={companyId} productType={activeTab} />
      </ScreenTabs>
    </ScreenShell>
  );
}
