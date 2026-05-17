/**
 * StaffOrdersView — واجهة الموظف لإرسال طلبات القسم
 * تجربة POS: شبكة كروت، ضغطة تضيف للطلب، ملخص أسفل الشاشة
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { fmt } from '../../utils/format';
import { formatSaudiDate } from '../../utils/saudiDate';
import {
  useMyStaffOrders,
  useCreateStaffOrderMutation,
  useUpdateStaffOrderMutation,
  useDeleteStaffOrderMutation,
  useOrderProducts,
  useOrderSections,
} from '../../hooks/useOrders';
import { Button, Input, Badge, ScreenShell, ScreenTitle, Modal } from '../../ui';

// ─── أنواع ────────────────────────────────────────────────────────────────────
interface ItemRow { productId: string; quantity: number; unit: string; }

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
  product,
  lang,
  qty,
  freqCount,
  onTap,
  onRemove,
  onQtyChange,
}: {
  product: any;
  lang: string;
  qty: number;
  freqCount: number;
  onTap: () => void;
  onRemove: () => void;
  onQtyChange: (v: number) => void;
}) {
  const name = lang === 'en'
    ? (product.nameEn || product.nameAr)
    : (product.nameAr || product.nameEn);

  const selected = qty > 0;

  // وحدات الصنف (قد يكون للصنف أكثر من وحدة في الاسم)
  const unitHint = product.unit || '';

  return (
    <div
      className={`relative rounded-xl border transition-all cursor-pointer select-none
        ${selected
          ? 'border-noorix-blue bg-blue-50 shadow-md ring-1 ring-noorix-blue/30'
          : 'border-noorix-border bg-noorix-surface hover:border-noorix-blue/40 hover:shadow-sm'
        }`}
      onClick={onTap}
    >
      {/* × حذف */}
      {selected && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 start-1 z-10 w-5 h-5 rounded-full bg-noorix-red text-white text-[11px] flex items-center justify-center shadow leading-none"
          aria-label="remove"
        >
          ×
        </button>
      )}

      {/* شارة الكمية */}
      {selected && (
        <div
          className="absolute top-1 end-1 z-10 min-w-[20px] h-5 px-1 rounded-full bg-noorix-blue text-white text-[11px] font-bold flex items-center justify-center shadow"
          onClick={(e) => e.stopPropagation()}
        >
          {qty}
        </div>
      )}

      {/* محتوى الكرت */}
      <div className="p-2.5 pt-5 text-center">
        <div className={`text-[13px] font-semibold leading-snug ${selected ? 'text-noorix-blue' : 'text-noorix-text'}`}>
          {name}
        </div>
        {unitHint && (
          <div className="text-[11px] text-noorix-muted mt-0.5 capitalize">{unitHint}</div>
        )}
        {freqCount > 0 && !selected && (
          <div className="text-[10px] text-noorix-blue/70 mt-0.5">×{freqCount}</div>
        )}
      </div>
    </div>
  );
}

// ─── الشاشة الرئيسية ───────────────────────────────────────────────────────────
export function StaffOrdersView({ companyId }: { companyId: string }) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();

  const { data: myOrders = [], isLoading } = useMyStaffOrders(companyId);
  const { data: allProducts = [] } = useOrderProducts(companyId);
  const { data: sections = [] } = useOrderSections(companyId);
  const createOrder = useCreateStaffOrderMutation(companyId);
  const updateOrder = useUpdateStaffOrderMutation(companyId);
  const deleteOrder = useDeleteStaffOrderMutation(companyId);

  const [sectionName, setSectionName] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  // خريطة { productId → { quantity, unit } }
  const [basket, setBasket] = useState<Map<string, ItemRow>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const orderSummaryRef = useRef<HTMLDivElement>(null);

  // نافذة اختيار الكمية
  const [qtyModal, setQtyModal] = useState<{ product: any; qty: number; unit: string } | null>(null);

  // ─── تكرار الطلبات لترتيب ذكي ─────────────────────────────────
  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of myOrders as any[]) {
      for (const it of (o.items || [])) {
        if (it.productId) m.set(it.productId, (m.get(it.productId) ?? 0) + 1);
      }
    }
    return m;
  }, [myOrders]);

  // ─── خريطة id → product ──────────────────────────────────────
  const productsById = useMemo(() => {
    const m = new Map<string, any>();
    (allProducts as any[]).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [allProducts]);

  // ─── اسم القسم حسب اللغة ──────────────────────────────────────
  function sectionLabel(s: any) {
    return lang === 'en' ? (s.nameEn || s.nameAr) : (s.nameAr || s.nameEn);
  }

  // ─── أصناف القسم مفلترة + مرتبة ذكياً ───────────────────────
  const products = useMemo(() => {
    let list = sectionName
      ? (allProducts as any[]).filter((p: any) => {
          const secs = p.sections as string[] | null;
          return Array.isArray(secs) && secs.length > 0 && secs.includes(sectionName);
        })
      : (allProducts as any[]);

    // فلتر بحث
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) => {
        const ar = (p.nameAr || '').toLowerCase();
        const en = (p.nameEn || '').toLowerCase();
        return ar.includes(q) || en.includes(q);
      });
    }

    // ترتيب: المطلوب كثيراً أولاً
    return [...list].sort((a: any, b: any) => {
      const fa = freqMap.get(a.id) ?? 0;
      const fb = freqMap.get(b.id) ?? 0;
      if (fb !== fa) return fb - fa;
      const na = lang === 'en' ? (a.nameEn || a.nameAr) : (a.nameAr || a.nameEn);
      const nb = lang === 'en' ? (b.nameEn || b.nameAr) : (b.nameAr || b.nameEn);
      return na.localeCompare(nb);
    });
  }, [allProducts, sectionName, search, freqMap, lang]);

  // ─── السلة كـ array للعرض ─────────────────────────────────────
  const basketItems = useMemo(() => Array.from(basket.values()), [basket]);

  // ─── لمس الكرت: إذا موجود → زد الكمية مباشرة، وإلا → افتح النافذة ───
  function tapProduct(product: any) {
    const existing = basket.get(product.id);
    if (existing) {
      // زيادة الكمية مباشرة بدون نافذة
      setBasket((prev) => {
        const next = new Map(prev);
        next.set(product.id, { ...existing, quantity: existing.quantity + 1 });
        return next;
      });
    } else {
      // افتح نافذة الكمية
      setQtyModal({ product, qty: 1, unit: product.unit || 'piece' });
    }
  }

  function confirmQtyModal() {
    if (!qtyModal) return;
    const { product, qty, unit } = qtyModal;
    if (qty <= 0) { setQtyModal(null); return; }
    setBasket((prev) => {
      const next = new Map(prev);
      next.set(product.id, { productId: product.id, quantity: qty, unit });
      return next;
    });
    setQtyModal(null);
    setTimeout(() => orderSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
  }

  function removeProduct(productId: string) {
    setBasket((prev) => { const next = new Map(prev); next.delete(productId); return next; });
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) { removeProduct(productId); return; }
    setBasket((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (existing) next.set(productId, { ...existing, quantity: qty });
      return next;
    });
  }

  function setUnit(productId: string, unit: string) {
    setBasket((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (existing) next.set(productId, { ...existing, unit });
      return next;
    });
  }

  // ─── إعادة الضبط ──────────────────────────────────────────────
  function resetForm() {
    setSectionName('');
    setNotes('');
    setSearch('');
    setBasket(new Map());
    setEditingId(null);
    setEditingQtyId(null);
  }

  function loadForEdit(order: any) {
    setSectionName(order.sectionName || '');
    setNotes(order.notes || '');
    setSearch('');
    const m = new Map<string, ItemRow>();
    for (const it of (order.items || [])) {
      m.set(it.productId, { productId: it.productId, quantity: Number(it.quantity) || 1, unit: it.unit || 'piece' });
    }
    setBasket(m);
    setEditingId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── إرسال ────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!sectionName) { showToast(t('staffOrderSectionRequired'), 'error'); return; }
    if (basket.size === 0) { showToast(t('staffOrderItemsRequired'), 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        companyId,
        sectionName,
        notes: notes.trim() || undefined,
        items: basketItems.map((it) => ({
          productId: it.productId,
          quantity: String(it.quantity),
          unit: it.unit || undefined,
        })),
      };
      if (editingId) {
        await updateOrder.mutateAsync({ id: editingId, body: payload });
        showToast(t('staffOrderUpdated'), 'success');
      } else {
        await createOrder.mutateAsync(payload);
        showToast(t('staffOrderCreated'), 'success');
      }
      resetForm();
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [sectionName, notes, basket, basketItems, editingId, companyId]);

  const handleDelete = useCallback(async (order: any) => {
    if (!window.confirm(t('staffOrderDeleteConfirm'))) return;
    try {
      await deleteOrder.mutateAsync(order.id);
      showToast(t('deleted'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('deleteFailed'), 'error');
    }
  }, []);

  const pendingOrders = useMemo(() => (myOrders as any[]).filter((o: any) => o.status === 'pending'), [myOrders]);
  const sentOrders   = useMemo(() => (myOrders as any[]).filter((o: any) => o.status === 'sent'),    [myOrders]);

  // ─── واجهة ────────────────────────────────────────────────────
  return (
    <ScreenShell>
      <ScreenTitle>{t('staffOrdersTitle')}</ScreenTitle>

      {/* ── اختيار القسم — أزرار ── */}
      <div className="flex flex-wrap gap-2">
        {(sections as any[]).map((s: any) => {
          const active = sectionName === s.nameAr;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSectionName(active ? '' : s.nameAr);
                setBasket(new Map());
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
        <svg
          className="absolute start-3 top-1/2 -translate-y-1/2 text-noorix-muted"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
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
              onQtyChange={(v) => setQty(p.id, v)}
            />
          ))}
        </div>
      ) : (
        sectionName && (
          <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[13px]">
            {t('staffOrderNoProducts')}
          </div>
        )
      )}

      {/* ── ملخص الطلب ── */}
      {basket.size > 0 && (
        <div ref={orderSummaryRef} className="noorix-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-noorix-border flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-noorix-blue">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span className="text-[14px] font-bold">{t('staffOrderBasket')} ({basket.size})</span>
          </div>

          <div className="divide-y divide-noorix-border">
            {basketItems.map((row) => {
              const p = productsById.get(row.productId);
              const name = p
                ? (lang === 'en' ? (p.nameEn || p.nameAr) : (p.nameAr || p.nameEn))
                : row.productId;
              const isEditingQty = editingQtyId === row.productId;
              return (
                <div key={row.productId} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="flex-1 text-[13px] text-noorix-text">{name}</span>

                  {/* عداد الكمية */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(row.productId, row.quantity - 1)}
                      className="w-7 h-7 rounded-full border border-noorix-border text-noorix-text text-[16px] flex items-center justify-center hover:bg-noorix-bg-muted"
                    >−</button>
                    {isEditingQty ? (
                      <input
                        autoFocus
                        type="number"
                        min="1"
                        className="w-10 h-7 text-center text-[13px] border border-noorix-blue rounded-lg bg-noorix-bg focus:outline-none"
                        value={row.quantity}
                        onChange={(e) => setQty(row.productId, Number(e.target.value))}
                        onBlur={() => setEditingQtyId(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingQtyId(row.productId)}
                        className="w-8 h-7 text-center text-[13px] font-bold text-noorix-blue hover:underline"
                      >{row.quantity}</button>
                    )}
                    <button
                      type="button"
                      onClick={() => setQty(row.productId, row.quantity + 1)}
                      className="w-7 h-7 rounded-full border border-noorix-border text-noorix-text text-[16px] flex items-center justify-center hover:bg-noorix-bg-muted"
                    >+</button>
                  </div>

                  {/* وحدة */}
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

                  {/* حذف */}
                  <button
                    type="button"
                    onClick={() => removeProduct(row.productId)}
                    className="text-noorix-red text-[16px] px-0.5 hover:opacity-70"
                    aria-label="remove"
                  >×</button>
                </div>
              );
            })}
          </div>

          {/* ملاحظات */}
          <div className="px-4 pb-3 pt-2">
            <Input
              label={t('notes')}
              value={notes}
              onChange={(e: any) => setNotes(e.target.value)}
              placeholder={t('optional')}
            />
          </div>

          {/* أزرار الإرسال */}
          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
            <Button variant="ghost" size="md" onClick={resetForm} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('saving') : editingId ? t('staffOrderUpdate') : t('staffOrderSubmit')}
            </Button>
          </div>
        </div>
      )}

      {/* ── طلباتي المعلّقة ── */}
      {pendingOrders.length > 0 && (
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
                    const name = lang === 'en'
                      ? (p?.nameEn || p?.nameAr || '—')
                      : (p?.nameAr || p?.nameEn || '—');
                    return (
                      <div key={i} className="flex justify-between text-[13px]">
                        <span className="text-noorix-text">{name}</span>
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

      {/* ── طلبات تم إرسالها ── */}
      {sentOrders.length > 0 && (
        <div className="noorix-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-noorix-border flex items-center justify-between">
            <span className="text-[13px] font-bold text-noorix-muted">{t('staffOrderMySent')}</span>
            <Badge color="green" size="sm">{sentOrders.length}</Badge>
          </div>
          <div className="divide-y divide-noorix-border">
            {sentOrders.slice(0, 10).map((o: any) => (
              <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">{o.sectionName}</span>
                  <span className="text-[11px] text-noorix-muted">{formatSaudiDate(o.createdAt)}</span>
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

      {!isLoading && (myOrders as any[]).length === 0 && basket.size === 0 && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('staffOrderNoOrders')}
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
            {/* عداد الكمية */}
            <div className="flex flex-col gap-2">
              <div className="text-[13px] text-noorix-muted text-center">{t('quantity')}</div>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setQtyModal((m) => m ? { ...m, qty: Math.max(1, m.qty - 1) } : m)}
                  className="w-10 h-10 rounded-full border-2 border-noorix-border text-noorix-text text-[22px] flex items-center justify-center hover:border-noorix-blue hover:text-noorix-blue transition-colors"
                >−</button>
                <input
                  type="number"
                  min="1"
                  className="w-20 h-12 text-center text-[22px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg text-noorix-text focus:outline-none focus:border-noorix-blue"
                  value={qtyModal.qty}
                  onChange={(e) => setQtyModal((m) => m ? { ...m, qty: Math.max(1, Number(e.target.value) || 1) } : m)}
                />
                <button
                  type="button"
                  onClick={() => setQtyModal((m) => m ? { ...m, qty: m.qty + 1 } : m)}
                  className="w-10 h-10 rounded-full border-2 border-noorix-border text-noorix-text text-[22px] flex items-center justify-center hover:border-noorix-blue hover:text-noorix-blue transition-colors"
                >+</button>
              </div>
            </div>

            {/* الوحدة */}
            <Input
              type="select"
              label={t('ordersUnit')}
              value={qtyModal.unit}
              onChange={(e: any) => setQtyModal((m) => m ? { ...m, unit: e.target.value } : m)}
            >
              <option value="piece">{t('ordersUnitPiece')}</option>
              <option value="kg">{t('ordersUnitKg')}</option>
              <option value="box">{t('ordersUnitBox')}</option>
              <option value="dozen">{t('ordersUnitDozen')}</option>
            </Input>

            {/* أزرار */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="ghost" size="md" onClick={() => setQtyModal(null)}>
                {t('cancel')}
              </Button>
              <Button variant="success" size="md" onClick={confirmQtyModal}>
                {t('staffOrderAddItem')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ScreenShell>
  );
}
