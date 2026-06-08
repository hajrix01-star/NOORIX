/**
 * StaffOrdersView — واجهة الموظف لإرسال طلبات القسم
 * تجربة POS: شبكة كروت، ضغطة تضيف للطلب، ملخص أسفل الشاشة
 * تبويبان: طلبات | مبيعات
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { fmt } from '../../utils/format';
import { formatSaudiDate, getSaudiToday, toDateInputYmd } from '../../utils/saudiDate';
import { unwrapApiData } from '../../services/core/apiHttp';
import { orderKeys } from '../../services/queryKeys';
import {
  type StaffBasketLine,
  basketTotal,
  basketLineAmount,
  defaultVariantModalState,
  displayProductPrice,
  formatVariantLabel,
  productHasVariants,
  resolveVariantFromModal,
  staffBasketLineKey,
} from './utils/staffOrderBasketUtils';
import {
  useMyStaffOrders,
  useStaffSaleNextLogRef,
  useCreateStaffOrderMutation,
  useUpdateStaffOrderMutation,
  useDeleteStaffOrderMutation,
  useResendStaffSaleMutation,
  useOrderProducts,
  useOrderSections,
} from '../../hooks/useOrders';
import { Button, Badge, ScreenShell, ScreenTitle, Modal, ScreenTabs, Input, cn } from '../../ui';

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
  const priceLabel = displayProductPrice(product);

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
        {priceLabel && (
          <div className="text-[11px] text-noorix-muted mt-0.5 ltr">{fmt(priceLabel)} <span className="nx-sar">SR</span></div>
        )}
        {product.unit && !priceLabel && (
          <div className="text-[11px] text-noorix-muted mt-0.5 capitalize">{product.unit}</div>
        )}
        {freqCount > 0 && !selected && (
          <div className="text-[10px] text-noorix-blue/70 mt-0.5">×{freqCount}</div>
        )}
      </div>
    </div>
  );
}

function StaffSentOrderRow({
  order,
  isSale,
  lang,
  t,
  onResend,
  onEdit,
  onDelete,
}: {
  order: any;
  isSale: boolean;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  onResend?: (o: any) => void;
  onEdit: (o: any) => void;
  onDelete: (o: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = order.items || [];
  const dateLabel = order.saleDate ? formatSaudiDate(order.saleDate) : formatSaudiDate(order.createdAt);
  const title = isSale ? dateLabel : (order.sectionName || '—');
  const subtitle = isSale ? null : dateLabel;

  return (
    <div className="rounded-lg border border-noorix-border bg-noorix-bg overflow-hidden">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            className="shrink-0 mt-0.5 w-8 h-8 rounded-lg border border-noorix-border bg-noorix-bg-muted/50 flex items-center justify-center text-noorix-muted hover:text-noorix-text"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t('staffSentCollapse') : t('staffSentExpand')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('transition-transform duration-200', open && 'rotate-180')}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="flex-1 min-w-0 text-start flex flex-col gap-0.5"
            onClick={() => setOpen((v) => !v)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[14px] text-noorix-text">{title}</span>
              <StatusBadge status={order.status} />
            </div>
            {subtitle ? (
              <span className="text-[11px] text-noorix-muted">{subtitle}</span>
            ) : null}
            {!open && items.length > 0 ? (
              <span className="text-[11px] text-noorix-muted">
                {items.length} {t('staffOrderItemsCount')}
              </span>
            ) : null}
          </button>
        </div>
        <div className="flex flex-wrap gap-1 justify-end ps-10">
          {isSale && onResend ? (
            <Button size="sm" variant="ghost" onClick={() => onResend(order)}>
              {t('staffSaleResend')}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => onEdit(order)}>{t('edit')}</Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(order)}>{t('delete')}</Button>
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-noorix-border flex flex-col gap-2">
          <div className="flex flex-col gap-2 pt-2">
            {items.map((it: any, i: number) => {
              const p = it.product;
              const nameAr = p?.nameAr || '—';
              const nameEn = p?.nameEn?.trim() || null;
              return (
                <div key={i} className="flex items-start justify-between gap-2 text-[13px]">
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="font-medium text-noorix-text break-words">{nameAr}</span>
                    {nameEn ? (
                      <span className="text-[11px] text-noorix-muted break-words ltr text-start">{nameEn}</span>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-end flex flex-col gap-0.5 items-end">
                    {it.size || it.packaging ? (
                      <span className="text-[10px] text-noorix-muted ltr">
                        {formatVariantLabel(it.size, it.packaging, it.unit)}
                      </span>
                    ) : it.unit ? (
                      <span className="text-[10px] text-noorix-muted capitalize">{it.unit}</span>
                    ) : null}
                    <span className="font-semibold nx-font-numbers ltr">
                      {fmt(it.quantity, 0)}
                      {it.unitPrice != null && Number(it.unitPrice) > 0 ? (
                        <> × {fmt(it.unitPrice)} = {fmt(new Decimal(it.quantity || 0).times(it.unitPrice || 0))} <span className="nx-sar">SR</span></>
                      ) : (
                        <> {it.unit || ''}</>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {order.notes ? (
            <div className="text-[11px] text-noorix-muted italic break-words">{order.notes}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StaffSentSaleGroup({
  orders,
  lang,
  t,
  onResend,
  onEdit,
  onDelete,
}: {
  orders: any[];
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  onResend: (o: any) => void;
  onEdit: (o: any) => void;
  onDelete: (o: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const primary = orders[0];
  const logRef = primary?.logRef as string | null | undefined;
  const dateLabel = primary?.saleDate ? formatSaudiDate(primary.saleDate) : formatSaudiDate(primary.createdAt);
  const totalItems = orders.reduce((n, o) => n + ((o.items || []).length), 0);
  const sectionsCount = orders.length;

  return (
    <div className="rounded-lg border border-noorix-border bg-noorix-bg overflow-hidden">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            className="shrink-0 mt-0.5 w-8 h-8 rounded-lg border border-noorix-border bg-noorix-bg-muted/50 flex items-center justify-center text-noorix-muted hover:text-noorix-text"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t('staffSentCollapse') : t('staffSentExpand')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('transition-transform duration-200', open && 'rotate-180')}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="flex-1 min-w-0 text-start flex flex-col gap-0.5"
            onClick={() => setOpen((v) => !v)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[14px] text-noorix-blue ltr">{logRef || dateLabel}</span>
              <StatusBadge status={primary.status} />
              {sectionsCount > 1 ? (
                <Badge color="violet" size="sm">{t('staffSaleSectionsCount', sectionsCount)}</Badge>
              ) : null}
            </div>
            {logRef ? <span className="text-[11px] text-noorix-muted">{dateLabel}</span> : null}
            {!open ? (
              <span className="text-[11px] text-noorix-muted">
                {totalItems} {t('staffOrderItemsCount')}
              </span>
            ) : null}
          </button>
        </div>
        <div className="flex flex-wrap gap-1 justify-end ps-10">
          <Button size="sm" variant="ghost" onClick={() => onResend(primary)}>
            {t('staffSaleResend')}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="px-3 pb-3 pt-0 border-t border-noorix-border flex flex-col gap-3">
          {orders.map((order) => (
            <div key={order.id} className="pt-2 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-noorix-text">{order.sectionName || '—'}</span>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(order)}>{t('edit')}</Button>
                  <Button size="sm" variant="danger" onClick={() => onDelete(order)}>{t('delete')}</Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {(order.items || []).map((it: any, i: number) => {
                  const p = it.product;
                  const nameAr = p?.nameAr || '—';
                  const nameEn = p?.nameEn?.trim() || null;
                  return (
                    <div key={i} className="flex items-start justify-between gap-2 text-[13px]">
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <span className="font-medium text-noorix-text break-words">{nameAr}</span>
                        {nameEn ? (
                          <span className="text-[11px] text-noorix-muted break-words ltr text-start">{nameEn}</span>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-end flex flex-col gap-0.5 items-end">
                        {it.size || it.packaging ? (
                          <span className="text-[10px] text-noorix-muted ltr">
                            {formatVariantLabel(it.size, it.packaging, it.unit)}
                          </span>
                        ) : it.unit ? (
                          <span className="text-[10px] text-noorix-muted capitalize">{it.unit}</span>
                        ) : null}
                        <span className="font-semibold nx-font-numbers ltr">
                          {fmt(it.quantity, 0)}
                          {it.unitPrice != null && Number(it.unitPrice) > 0 ? (
                            <> × {fmt(it.unitPrice)} = {fmt(new Decimal(it.quantity || 0).times(it.unitPrice || 0))} <span className="nx-sar">SR</span></>
                          ) : (
                            <> {it.unit || ''}</>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {order.notes ? (
                <div className="text-[11px] text-noorix-muted italic break-words">{order.notes}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
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
  const queryClient = useQueryClient();

  const { data: myOrders = [], isLoading, isError: ordersError } = useMyStaffOrders(companyId);
  const { data: allProducts = [] } = useOrderProducts(companyId, productType);
  const { data: sections = [] } = useOrderSections(companyId);
  const createOrder = useCreateStaffOrderMutation(companyId);
  const updateOrder = useUpdateStaffOrderMutation(companyId);
  const deleteOrder = useDeleteStaffOrderMutation(companyId);
  const resendSale = useResendStaffSaleMutation(companyId);

  const isSale = productType === 'sale';
  /** فلتر عرض الأصناف فقط — ليس شرطاً للإرسال */
  const [sectionFilter, setSectionFilter] = useState('');
  const [saleDate, setSaleDate] = useState(() => getSaudiToday());
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [basketLines, setBasketLines] = useState<StaffBasketLine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qtyModal, setQtyModal] = useState<{ product: any; qty: number; unit: string } | null>(null);
  const [variantModal, setVariantModal] = useState<ReturnType<typeof defaultVariantModalState> | null>(null);

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

  const basketTotalAmount = useMemo(() => basketTotal(basketLines), [basketLines]);

  const qtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const line of basketLines) {
      m.set(line.productId, (m.get(line.productId) ?? 0) + line.quantity);
    }
    return m;
  }, [basketLines]);

  // طلبات هذا النوع فقط
  const myTypedOrders = useMemo(
    () => (myOrders as any[]).filter((o: any) => (o.orderType || 'order') === productType),
    [myOrders, productType]
  );
  const pendingOrders = useMemo(() => myTypedOrders.filter((o: any) => o.status === 'pending'), [myTypedOrders]);
  const sentOrders   = useMemo(() => myTypedOrders.filter((o: any) => o.status === 'sent'),    [myTypedOrders]);
  const sentSaleGroups = useMemo(() => {
    if (!isSale) return [] as any[][];
    const map = new Map<string, any[]>();
    for (const o of sentOrders) {
      const key = o.logRef || o.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.values()].sort(
      (a, b) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime(),
    );
  }, [isSale, sentOrders]);

  const editingOrder = useMemo(
    () => (editingId ? (myOrders as any[]).find((o: any) => o.id === editingId) : null),
    [editingId, myOrders],
  );
  const previewNextLogRef = isSale && basketLines.length > 0 && !editingId && !!saleDate;
  const { data: nextLogRef } = useStaffSaleNextLogRef(companyId, saleDate, previewNextLogRef);
  const basketLogRef = isSale ? (editingOrder?.logRef || nextLogRef || null) : null;

  // ─── لمس الكرت ──────────────────────────────────────────────────
  function tapProduct(product: any) {
    if (productHasVariants(product)) {
      setVariantModal(defaultVariantModalState(product));
      return;
    }
    const unit = product.unit || 'piece';
    const key = staffBasketLineKey({ productId: product.id, size: '', packaging: '', unit });
    const idx = basketLines.findIndex((l) => staffBasketLineKey(l) === key);
    if (idx >= 0) {
      setBasketLines((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      });
    } else {
      setQtyModal({ product, qty: 1, unit });
    }
  }

  function confirmQtyModal() {
    if (!qtyModal) return;
    const { product, qty, unit } = qtyModal;
    if (qty <= 0) { setQtyModal(null); return; }
    const sec = resolveItemSection(product, sectionFilter);
    const key = staffBasketLineKey({ productId: product.id, size: '', packaging: '', unit });
    const price = product.lastPrice ? String(product.lastPrice) : '0';
    setBasketLines((prev) => {
      const idx = prev.findIndex((l) => staffBasketLineKey(l) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: qty, unit, sectionName: sec };
        return next;
      }
      return [...prev, {
        lineId: `${product.id}-${Date.now()}`,
        productId: product.id,
        quantity: qty,
        unit,
        size: '',
        packaging: '',
        unitPrice: price,
        sectionName: sec,
      }];
    });
    setQtyModal(null);
  }

  function confirmVariantModal() {
    if (!variantModal) return;
    const { product, quantity, unitPrice } = variantModal;
    if (!quantity || parseFloat(quantity) <= 0) { setVariantModal(null); return; }
    const v = resolveVariantFromModal(product, variantModal);
    const sec = resolveItemSection(product, sectionFilter);
    setBasketLines((prev) => [...prev, {
      lineId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      quantity: parseFloat(quantity) || 1,
      unit: v.unit,
      size: v.size,
      packaging: v.packaging,
      unitPrice: v.unitPrice,
      sectionName: sec,
    }]);
    setVariantModal(null);
  }

  function removeLine(lineId: string) {
    setBasketLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  function removeProduct(productId: string) {
    setBasketLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function setLineQty(lineId: string, qty: number) {
    if (qty <= 0) { removeLine(lineId); return; }
    setBasketLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l)));
  }

  function resetForm() {
    setSectionFilter('');
    setSaleDate(getSaudiToday());
    setNotes('');
    setSearch('');
    setBasketLines([]);
    setEditingId(null);
    setEditingQtyId(null);
  }

  function openWhatsApp(text: string) {
    if (!text?.trim()) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  function loadForEdit(order: any) {
    setSectionFilter(order.sectionName || '');
    setSaleDate(order.saleDate ? toDateInputYmd(order.saleDate) : getSaudiToday());
    setNotes(order.notes || '');
    setSearch('');
    const lines: StaffBasketLine[] = (order.items || []).map((it: any, i: number) => ({
      lineId: `${it.productId}-${i}`,
      productId: it.productId,
      quantity: Number(it.quantity) || 1,
      unit: it.unit || 'piece',
      size: it.size || '',
      packaging: it.packaging || '',
      unitPrice: it.unitPrice != null ? String(it.unitPrice) : '0',
      sectionName: order.sectionName || undefined,
    }));
    setBasketLines(lines);
    setEditingId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSubmit = useCallback(async () => {
    if (basketLines.length === 0) { showToast(t('staffOrderItemsRequired'), 'error'); return; }
    if (isSale && !saleDate) { showToast(t('staffSaleDateRequired'), 'error'); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        orderType: productType,
        saleDate: isSale ? saleDate : undefined,
        lang,
        notes: notes.trim() || undefined,
        items: basketLines.map((it) => {
          const p = productsById.get(it.productId);
          const sectionName = it.sectionName || (p ? resolveItemSection(p, sectionFilter) : undefined);
          return {
            productId: it.productId,
            quantity: String(it.quantity),
            unit: it.unit || undefined,
            size: it.size || undefined,
            packaging: it.packaging || undefined,
            unitPrice: it.unitPrice || undefined,
            sectionName: sectionName || undefined,
          };
        }),
      };
      if (editingId) {
        payload.sectionName = sectionFilter || basketLines[0]?.sectionName || 'عام';
      }

      if (isSale) {
        const res = editingId
          ? await updateOrder.mutateAsync({ id: editingId, body: payload })
          : await createOrder.mutateAsync(payload);
        const saved = unwrapApiData(res as any, t('saveFailed')) as { id?: string; whatsAppText?: string };
        if (!saved?.id) throw new Error(t('saveFailed'));

        const savedLogRef = (saved as { logRef?: string })?.logRef;
        showToast(savedLogRef ? t('staffSaleSavedWithRef', savedLogRef) : t('staffSaleSaved'), 'success');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orderKeys.staffMy(companyId) }),
          queryClient.invalidateQueries({ queryKey: ['salesReport', companyId] }),
          queryClient.invalidateQueries({ queryKey: orderKeys.staffDigest(companyId) }),
        ]);
        resetForm();

        const waText = saved.whatsAppText;
        if (waText?.trim()) {
          openWhatsApp(waText);
        }
        return;
      }

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
  }, [sectionFilter, saleDate, notes, basketLines, productsById, editingId, companyId, productType, isSale, lang, t, showToast, createOrder, updateOrder, queryClient]);

  const handleResendSale = useCallback(async (order: any) => {
    try {
      const res: any = await resendSale.mutateAsync({ id: order.id, lang });
      const data = res?.data ?? res;
      const waText = data?.whatsAppText;
      if (waText) {
        openWhatsApp(waText);
        showToast(t('staffSaleResent'), 'success');
      }
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
    }
  }, [lang, resendSale, t, showToast]);

  const handleDelete = useCallback(async (order: any) => {
    const confirmKey = isSale ? 'staffSaleDeleteConfirm' : 'staffOrderDeleteConfirm';
    if (!window.confirm(t(confirmKey))) return;
    try {
      await deleteOrder.mutateAsync(order.id);
      if (editingId === order.id) resetForm();
      showToast(t('deleted'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('deleteFailed'), 'error');
    }
  }, [isSale, editingId, t, showToast, deleteOrder]);

  return (
    <div className="flex flex-col gap-4">
      {isSale ? (
        <div className="rounded-lg border border-noorix-amber/30 bg-noorix-amber/5 px-3 py-2 text-[12px] text-noorix-muted leading-relaxed">
          {t('staffInternalSalesHint')}
        </div>
      ) : null}
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
              qty={qtyMap.get(p.id) ?? 0}
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

      {/* ── خطأ تحميل المبيعات السابقة ── */}
      {ordersError && (
        <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 px-4 py-3 text-[13px] text-noorix-red">
          {t('staffOrdersLoadError')}
        </div>
      )}

      {/* ── ملخص الطلب ── */}
      {basketLines.length > 0 && (
        <div className="noorix-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-noorix-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-noorix-blue shrink-0">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span className="text-[14px] font-bold">
                {isSale ? t('staffSaleBasket') : t('staffOrderBasket')} ({basketLines.length})
              </span>
            </div>
            {isSale && basketLogRef ? (
              <div className="flex items-center gap-1.5 ms-auto">
                <span className="text-[11px] text-noorix-muted">{t('staffSaleLogRef')}</span>
                <span className="text-[13px] font-bold text-noorix-blue ltr">{basketLogRef}</span>
              </div>
            ) : null}
            {!isSale && basketTotalAmount.gt(0) ? (
              <span className="text-[13px] font-bold text-noorix-green ltr">
                {fmt(basketTotalAmount.toNumber())} <span className="nx-sar">SR</span>
              </span>
            ) : null}
          </div>
          <div className="divide-y divide-noorix-border">
            {basketLines.map((row) => {
              const p = productsById.get(row.productId);
              const name = p ? (lang === 'en' ? (p.nameEn || p.nameAr) : (p.nameAr || p.nameEn)) : row.productId;
              const variant = formatVariantLabel(row.size, row.packaging, row.unit);
              const lineAmt = basketLineAmount(row);
              const isEditingQty = editingQtyId === row.lineId;
              return (
                <div key={row.lineId} className="flex flex-col gap-1.5 px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-noorix-text">{name}</div>
                      {variant ? (
                        <div className="text-[11px] text-noorix-muted ltr">{variant}</div>
                      ) : null}
                    </div>
                    <button type="button" onClick={() => removeLine(row.lineId)}
                      className="text-noorix-red text-[16px] shrink-0 hover:opacity-70">×</button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setLineQty(row.lineId, row.quantity - 1)}
                        className="w-7 h-7 rounded-full border border-noorix-border text-[16px] flex items-center justify-center hover:bg-noorix-bg-muted">−</button>
                      {isEditingQty ? (
                        <input autoFocus type="number" min="1"
                          className="w-10 h-7 text-center text-[13px] border border-noorix-blue rounded-lg bg-noorix-bg focus:outline-none"
                          value={row.quantity}
                          onChange={(e) => setLineQty(row.lineId, Number(e.target.value))}
                          onBlur={() => setEditingQtyId(null)}
                        />
                      ) : (
                        <button type="button" onClick={() => setEditingQtyId(row.lineId)}
                          className="w-8 h-7 text-center text-[13px] font-bold text-noorix-blue hover:underline"
                        >{row.quantity}</button>
                      )}
                      <button type="button" onClick={() => setLineQty(row.lineId, row.quantity + 1)}
                        className="w-7 h-7 rounded-full border border-noorix-border text-[16px] flex items-center justify-center hover:bg-noorix-bg-muted">+</button>
                    </div>
                    <div className="text-[12px] text-noorix-muted ltr text-end">
                      {Number(row.unitPrice) > 0 ? (
                        <>
                          {fmt(row.unitPrice)} × {fmt(row.quantity, 0)} ={' '}
                          <span className="font-bold text-noorix-green">{fmt(lineAmt.toNumber())}</span>{' '}
                          <span className="nx-sar">SR</span>
                        </>
                      ) : null}
                    </div>
                  </div>
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
          <div className={cn('px-4 pb-4 gap-2', isSale ? 'flex flex-col' : 'grid grid-cols-2')}>
            {!isSale && (
              <Button variant="ghost" size="md" onClick={resetForm} disabled={submitting}>{t('cancel')}</Button>
            )}
            <Button
              variant={isSale ? 'success' : 'primary'}
              size="md"
              className={isSale ? 'min-h-[44px] w-full' : undefined}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? (isSale ? t('staffSaleSaving') : t('saving'))
                : isSale
                  ? t('staffSaleSaveAndSend')
                  : editingId
                    ? t('staffOrderUpdate')
                    : t('staffOrderSubmit')}
            </Button>
            {isSale && (
              <Button variant="ghost" size="sm" className="w-full" onClick={resetForm} disabled={submitting}>
                {t('cancel')}
              </Button>
            )}
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
                    const variant = formatVariantLabel(it.size, it.packaging, it.unit);
                    const lineTotal = new Decimal(it.quantity || 0).times(it.unitPrice || 0);
                    return (
                      <div key={i} className="flex justify-between gap-2 text-[13px]">
                        <div className="min-w-0">
                          <span>{name}</span>
                          {variant ? <div className="text-[10px] text-noorix-muted ltr">{variant}</div> : null}
                        </div>
                        <span className="font-semibold nx-font-numbers shrink-0 ltr text-end">
                          {fmt(it.quantity, 0)}
                          {Number(it.unitPrice) > 0 ? (
                            <> × {fmt(it.unitPrice)} = {fmt(lineTotal.toNumber())} <span className="nx-sar">SR</span></>
                          ) : (
                            <> {it.unit || ''}</>
                          )}
                        </span>
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

      {/* ── مُرسَل — بدون كرت خارجي إضافي؛ كل طلب مطوي افتراضياً ── */}
      {sentOrders.length > 0 && (
        <section className="flex flex-col gap-2 pt-1 border-t border-noorix-border">
          <div className="flex items-center justify-between gap-2 px-0.5 pt-3">
            <span className="text-[13px] font-bold text-noorix-muted">
              {isSale ? t('staffSaleMySent') : t('staffOrderMySent')}
            </span>
            <Badge color="green" size="sm">{isSale ? sentSaleGroups.length : sentOrders.length}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {isSale
              ? sentSaleGroups.map((group) => (
                  <StaffSentSaleGroup
                    key={group[0].logRef || group[0].id}
                    orders={group}
                    lang={lang}
                    t={t}
                    onResend={handleResendSale}
                    onEdit={loadForEdit}
                    onDelete={handleDelete}
                  />
                ))
              : sentOrders.map((o: any) => (
                  <StaffSentOrderRow
                    key={o.id}
                    order={o}
                    isSale={isSale}
                    lang={lang}
                    t={t}
                    onResend={undefined}
                    onEdit={loadForEdit}
                    onDelete={handleDelete}
                  />
                ))}
          </div>
        </section>
      )}

      {!isLoading && myTypedOrders.length === 0 && basketLines.length === 0 && (
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
            {qtyModal.product?.lastPrice != null && Number(qtyModal.product.lastPrice) > 0 ? (
              <div className="text-center text-[12px] text-noorix-muted ltr">
                {t('unitPrice')}: {fmt(qtyModal.product.lastPrice)} <span className="nx-sar">SR</span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="ghost" size="md" onClick={() => setQtyModal(null)}>{t('cancel')}</Button>
              <Button variant="success" size="md" onClick={confirmQtyModal}>{t('staffOrderAddItem')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── نافذة الحجم/المتغير ── */}
      {variantModal && (
        <VariantPickModal
          variantModal={variantModal}
          lang={lang}
          t={t}
          onClose={() => setVariantModal(null)}
          onChange={setVariantModal}
          onConfirm={confirmVariantModal}
        />
      )}
    </div>
  );
}

function VariantPickModal({
  variantModal,
  lang,
  t,
  onClose,
  onChange,
  onConfirm,
}: {
  variantModal: NonNullable<ReturnType<typeof defaultVariantModalState>>;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  onClose: () => void;
  onChange: (v: ReturnType<typeof defaultVariantModalState>) => void;
  onConfirm: () => void;
}) {
  const product = variantModal.product;
  const name = lang === 'en' ? (product.nameEn || product.nameAr) : (product.nameAr || product.nameEn);
  const variants = useMemo(() => {
    const raw = Array.isArray(product?.variants) ? product.variants : [];
    return raw.map((v: any, i: number) => ({
      ...v,
      _key: `${v.size || ''}|${v.packaging || ''}|${v.unit || 'piece'}|${i}`,
    }));
  }, [product]);
  const sizes = useMemo(() => {
    if (!product?.sizes) return [] as string[];
    return String(product.sizes).split(/[,،]/).map((x: string) => x.trim()).filter(Boolean);
  }, [product]);

  return (
    <Modal open onClose={onClose} title={name} size="sm">
      <div className="flex flex-col gap-4 p-1">
        {variants.length > 0 && (
          <Input
            type="select"
            label={t('ordersProductVariants')}
            value={variantModal.variantKey}
            onChange={(e: any) => {
              const key = e.target.value;
              const v = variants.find((x: any) => x._key === key);
              onChange({
                ...variantModal,
                variantKey: key,
                size: v?.size || '',
                packaging: v?.packaging || '',
                unit: v?.unit || 'piece',
                unitPrice: v?.lastPrice ? String(v.lastPrice) : variantModal.unitPrice,
              });
            }}
          >
            {variants.map((v: any) => (
              <option key={v._key} value={v._key}>
                {[v.size, v.packaging, v.unit].filter(Boolean).join(' / ') || '—'}
                {v.lastPrice ? ` — ${fmt(v.lastPrice)} SR` : ''}
              </option>
            ))}
          </Input>
        )}
        {variants.length === 0 && sizes.length > 0 && (
          <Input
            type="select"
            label={t('ordersProductSize')}
            value={variantModal.size}
            onChange={(e: any) => onChange({ ...variantModal, size: e.target.value })}
          >
            <option value="">—</option>
            {sizes.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </Input>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-noorix-muted">{t('quantity')}</label>
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              onClick={() => onChange({
                ...variantModal,
                quantity: String(Math.max(1, parseFloat(variantModal.quantity || '1') - 1)),
              })}
              className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
            >−</button>
            <input
              type="number"
              min="1"
              className="w-16 h-10 text-center text-[18px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg focus:outline-none focus:border-noorix-blue"
              value={variantModal.quantity}
              onChange={(e) => onChange({ ...variantModal, quantity: e.target.value })}
            />
            <button
              type="button"
              onClick={() => onChange({
                ...variantModal,
                quantity: String(parseFloat(variantModal.quantity || '0') + 1),
              })}
              className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
            >+</button>
          </div>
        </div>
        <Input
          type="number"
          min="0"
          step="0.01"
          label={`${t('unitPrice')} SR`}
          value={variantModal.unitPrice}
          onChange={(e: any) => onChange({ ...variantModal, unitPrice: e.target.value })}
          placeholder="0"
        />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="success" size="md" onClick={onConfirm}>{t('staffOrderAddItem')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── الشاشة الرئيسية ───────────────────────────────────────────────────────────
export function StaffOrdersView({
  companyId,
  embedded = false,
  salesOnly = false,
  defaultTab = 'order',
}: {
  companyId: string;
  embedded?: boolean;
  /** داخل واجهة المدير — تبويب مبيعات فقط (كاشير) */
  salesOnly?: boolean;
  defaultTab?: 'order' | 'sale';
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'order' | 'sale'>(defaultTab);

  const tabs = useMemo(() => [
    { id: 'order', label: t('staffOrdersTabOrders') },
    { id: 'sale',  label: t('staffOrdersTabSales') },
  ], [t]);

  if (salesOnly) {
    return <StaffOrderPanel companyId={companyId} productType="sale" />;
  }

  const tabContent = (
    <ScreenTabs
      items={tabs}
      value={activeTab}
      onChange={(v) => setActiveTab(v as 'order' | 'sale')}
      contentClassName="px-3 pt-3 pb-4 sm:px-4"
    >
      <StaffOrderPanel key={activeTab} companyId={companyId} productType={activeTab} />
    </ScreenTabs>
  );

  if (embedded) return tabContent;

  return (
    <ScreenShell>
      <ScreenTitle>{t('staffOrdersTitle')}</ScreenTitle>
      {tabContent}
    </ScreenShell>
  );
}
