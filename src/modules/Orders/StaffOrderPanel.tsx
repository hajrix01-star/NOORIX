import React, { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { fmt } from '../../utils/format';
import { formatSaudiDate, getSaudiToday, toDateInputYmd } from '../../utils/saudiDate';
import { orderKeys } from '../../services/queryKeys';
import {
  type StaffBasketLine,
  defaultVariantModalState,
  formatVariantLabel,
  productHasVariants,
  resolveVariantFromModal,
  staffBasketLineKey,
} from './utils/staffOrderBasketUtils';
import {
  buildProductsById,
  buildStaffOrderFrequencyMap,
  buildStaffOrderPayload,
  buildStaffQtyMap,
  filterStaffOrderProducts,
  filterStaffOrdersByType,
  groupSentSaleOrders,
  mapStaffOrderToBasketLines,
  summarizeSentSales,
  upsertPlainStaffBasketLine,
} from './utils/staffOrderPanelModel';
import {
  ProductCard,
  StaffBasketTable,
  VariantPickModal,
  resolveItemSection,
} from './StaffOrdersViewParts';
import {
  StaffItemPriceSuffix,
  StaffSaleLogMetrics,
  StaffSentOrderRow,
  StaffSentSaleGroup,
  StatusBadge,
} from './StaffOrdersSentPanels';
import { StaffQtyModal, StaffWhatsAppPromptModal } from './StaffOrderPanelModals';
import { OrderConfirmModal } from './components/OrderConfirmModal';
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
import { Badge, Button, DateField, Input, cn } from '../../ui';
import type { OrderProduct, OrderSection, StaffOrder } from '../../types/api';

function createDraftLineId(productId: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${productId}-${crypto.randomUUID()}`;
  }
  return `${productId}-${performance.now().toString(36)}`;
}
export function StaffOrderPanel({
  companyId,
  productType,
}: {
  companyId: string;
  productType: 'order' | 'sale';
}) {
  const { t, lang } = useTranslation();
  const displayLang = lang === 'en' ? 'en' : 'ar';
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
  /** Filter item sections only; not required for submit. */
  const [sectionFilter, setSectionFilter] = useState('');
  const [saleDate, setSaleDate] = useState(() => getSaudiToday());
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [basketLines, setBasketLines] = useState<StaffBasketLine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendWhatsAppPrompt, setSendWhatsAppPrompt] = useState<string | null>(null);
  const [qtyModal, setQtyModal] = useState<{ product: OrderProduct; qty: number; unit: string } | null>(null);
  const [variantModal, setVariantModal] = useState<ReturnType<typeof defaultVariantModalState> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffOrder | null>(null);

  // Repeat orders
  const freqMap = useMemo(
    () => buildStaffOrderFrequencyMap(myOrders, productType),
    [myOrders, productType],
  );

  const productsById = useMemo(() => buildProductsById(allProducts), [allProducts]);

  function sectionLabel(s: OrderSection) {
    return lang === 'en' ? (s.nameEn || s.nameAr) : (s.nameAr || s.nameEn);
  }

  const products = useMemo(
    () => filterStaffOrderProducts({ allProducts, sectionFilter, search, freqMap, lang: displayLang }),
    [allProducts, sectionFilter, search, freqMap, displayLang],
  );

  const qtyMap = useMemo(() => buildStaffQtyMap(basketLines), [basketLines]);

  // Orders of this type only
  const myTypedOrders = useMemo(
    () => filterStaffOrdersByType(myOrders, productType),
    [myOrders, productType],
  );
  const pendingOrders = useMemo(() => myTypedOrders.filter((o) => o.status === 'pending'), [myTypedOrders]);
  const sentOrders   = useMemo(() => myTypedOrders.filter((o) => o.status === 'sent'),    [myTypedOrders]);
  const sentSaleGroups = useMemo(() => groupSentSaleOrders(sentOrders, isSale), [isSale, sentOrders]);

  const sentSalesSummary = useMemo(
    () => summarizeSentSales({ isSale, sentSaleGroups, sentOrders }),
    [isSale, sentSaleGroups, sentOrders],
  );

  const editingOrder = useMemo(
    () => (editingId ? myOrders.find((o) => o.id === editingId) : null),
    [editingId, myOrders],
  );
  const previewNextLogRef = isSale && basketLines.length > 0 && !editingId && !!saleDate;
  const { data: nextLogRef } = useStaffSaleNextLogRef(companyId, saleDate, previewNextLogRef);
  const basketLogRef = isSale ? (editingOrder?.logRef || nextLogRef || null) : null;

  // Card touch handling
  function tapProduct(product: OrderProduct) {
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
    setBasketLines((prev) => {
      return upsertPlainStaffBasketLine({
        currentLines: prev,
        product,
        qty,
        unit,
        sectionFilter,
        lineId: createDraftLineId(product.id),
      });
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
      lineId: createDraftLineId(product.id),
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

  function loadForEdit(order: StaffOrder) {
    setSectionFilter(order.sectionName || '');
    setSaleDate(order.saleDate ? toDateInputYmd(order.saleDate) : getSaudiToday());
    setNotes(order.notes || '');
    setSearch('');
    setBasketLines(mapStaffOrderToBasketLines(order));
    setEditingId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSubmit = useCallback(async () => {
    if (basketLines.length === 0) { showToast(t('staffOrderItemsRequired'), 'error'); return; }
    if (isSale && !saleDate) { showToast(t('staffSaleDateRequired'), 'error'); return; }
    setSubmitting(true);
    try {
      const payload = buildStaffOrderPayload({
        companyId,
        productType,
        isSale,
        saleDate,
        lang: displayLang,
        notes,
        basketLines,
        productsById,
        sectionFilter,
        editingId,
      });

      if (isSale) {
        const res = editingId
          ? await updateOrder.mutateAsync({ id: editingId, body: payload })
          : await createOrder.mutateAsync(payload);
        const saved = res.data && 'id' in res.data ? res.data : null;
        if (!saved?.id) throw new Error(t('saveFailed'));

        const savedLogRef = saved.logRef;
        showToast(savedLogRef ? t('staffSaleSavedWithRef', savedLogRef) : t('staffSaleSaved'), 'success');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orderKeys.staffMy(companyId) }),
          queryClient.invalidateQueries({ queryKey: ['salesReport', companyId] }),
          queryClient.invalidateQueries({ queryKey: orderKeys.staffDigest(companyId) }),
        ]);
        resetForm();

        const waText = saved.whatsAppText?.trim();
        if (waText) {
          setSendWhatsAppPrompt(waText);
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [sectionFilter, saleDate, notes, basketLines, productsById, editingId, companyId, productType, isSale, displayLang, t, showToast, createOrder, updateOrder, queryClient]);

  const handleResendSale = useCallback(async (order: StaffOrder) => {
    try {
      const res = await resendSale.mutateAsync({ id: order.id, lang });
      const data = res?.data ?? res;
      const waText = data?.whatsAppText;
      if (waText) {
        openWhatsApp(waText);
        showToast(t('staffSaleResent'), 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('saveFailed'), 'error');
    }
  }, [lang, resendSale, t, showToast]);

  const handleDelete = useCallback(async (order: StaffOrder) => {
    setDeleteTarget(order);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteOrder.mutateAsync(deleteTarget.id);
      if (editingId === deleteTarget.id) resetForm();
      showToast(t('deleted'), 'success');
      setDeleteTarget(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('deleteFailed'), 'error');
    }
  }, [deleteTarget, isSale, editingId, t, showToast, deleteOrder]);

  return (
    <div className="flex flex-col gap-4">
      <OrderConfirmModal
        open={!!deleteTarget}
        title={t('confirmDelete')}
        message={t(isSale ? 'staffSaleDeleteConfirm' : 'staffOrderDeleteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={deleteOrder.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      {/* Section buttons */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => {
          const active = sectionFilter === s.nameAr;
          return (
            <Button
              key={s.id}
              type="button"
              variant="raw"
              size="auto"
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
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute start-3 top-1/2 -translate-y-1/2 text-noorix-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <Input
          type="search"
          containerClassName="contents"
          className="w-full h-9 rounded-xl border border-noorix-border bg-noorix-surface ps-9 pe-3 text-[13px] text-noorix-text placeholder:text-noorix-muted focus:outline-none focus:ring-1 focus:ring-noorix-blue"
          placeholder={t('staffOrderSearchProduct')}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      {/* Product grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {products.map((p) => (
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

      {/* Previous sales load error */}
      {ordersError && (
        <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 px-4 py-3 text-[13px] text-noorix-red">
          {t('staffOrdersLoadError')}
        </div>
      )}

      {/* Order summary */}
      {basketLines.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-noorix-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-noorix-blue shrink-0">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span className="text-[14px] font-bold">
                {isSale ? t('staffSaleBasket') : t('staffOrderBasket')} ({basketLines.length})
              </span>
            </div>
            {isSale && basketLogRef ? (
              <span className="text-[11px] text-noorix-muted whitespace-nowrap">
                {t('staffSaleLogRef')}:{' '}
                <span className="font-bold text-noorix-blue ltr">{basketLogRef}</span>
              </span>
            ) : null}
          </div>
          <div className="overflow-x-auto -mx-0.5 px-0.5">
            <StaffBasketTable
              basketLines={basketLines}
              productsById={productsById}
              lang={lang}
              t={t}
              showPrices={isSale}
              editingQtyId={editingQtyId}
              setEditingQtyId={setEditingQtyId}
              setLineQty={setLineQty}
              removeLine={removeLine}
            />
          </div>
          <div className="flex flex-col gap-2">
            {isSale && (
              <DateField
                label={t('staffSaleDate')}
                value={saleDate}
                onValueChange={setSaleDate}
              />
            )}
            <Input label={t('notes')} value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} placeholder={t('optional')} />
          </div>
          <div className={cn('gap-2', isSale ? 'flex flex-col' : 'grid grid-cols-2')}>
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
                  ? t('staffSaleSave')
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

      {/* Pending section orders */}
      {!isSale && pendingOrders.length > 0 && (
        <div className="noorix-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-noorix-border flex items-center justify-between">
            <span className="text-[13px] font-bold">{t('staffOrderMyPending')}</span>
            <Badge color="amber" size="sm">{pendingOrders.length}</Badge>
          </div>
          <div className="divide-y divide-noorix-border">
            {pendingOrders.map((o) => (
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
                  {(o.items || []).map((it, i) => {
                    const p = it.product;
                    const name = lang === 'en' ? (p?.nameEn || p?.nameAr || '-') : (p?.nameAr || p?.nameEn || '-');
                    const variant = formatVariantLabel(it.size, it.packaging, it.unit);
                    return (
                      <div key={i} className="flex justify-between gap-2 text-[13px]">
                        <div className="min-w-0">
                          <span>{name}</span>
                          {variant ? <div className="text-[10px] text-noorix-muted ltr">{variant}</div> : null}
                        </div>
                        <span className="font-semibold nx-font-numbers shrink-0 ltr text-end">
                          {fmt(it.quantity, 0)}
                          <StaffItemPriceSuffix it={it} product={p} />
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

      {/* Sender */}
      {sentOrders.length > 0 && (
        <section className="flex flex-col gap-3 pt-4 border-t border-noorix-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px] font-bold text-noorix-text">
              {isSale ? t('staffSaleMySent') : t('staffOrderMySent')}
            </span>
            <Badge color="green" size="sm">{isSale ? sentSaleGroups.length : sentOrders.length}</Badge>
          </div>
          {isSale && sentSaleGroups.length > 1 && (sentSalesSummary.totalQty > 0 || sentSalesSummary.totalAmount.gt(0)) ? (
            <StaffSaleLogMetrics
              totalQty={sentSalesSummary.totalQty}
              totalAmount={sentSalesSummary.totalAmount}
              avgPerOrder={sentSalesSummary.avgPerOrder}
              t={t}
              showDivider={false}
            />
          ) : null}
          {isSale ? (
            <div className="noorix-surface-card overflow-hidden divide-y divide-noorix-border">
              {sentSaleGroups.map((group) => (
                <StaffSentSaleGroup
                  key={group[0].logRef || group[0].id}
                  orders={group}
                  lang={lang}
                  t={t}
                  onResend={handleResendSale}
                  onEdit={loadForEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : sentOrders.map((o) => (
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
        </section>
      )}

      {!isLoading && myTypedOrders.length === 0 && basketLines.length === 0 && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {isSale ? t('staffSaleNoRecords') : t('staffOrderNoOrders')}
        </div>
      )}

      <StaffWhatsAppPromptModal
        text={sendWhatsAppPrompt}
        t={t}
        onClose={() => setSendWhatsAppPrompt(null)}
        onConfirm={(text) => {
          openWhatsApp(text);
          setSendWhatsAppPrompt(null);
          showToast(t('staffSaleResent'), 'success');
        }}
      />

      <StaffQtyModal
        qtyModal={qtyModal}
        lang={lang}
        t={t}
        onChange={setQtyModal}
        onClose={() => setQtyModal(null)}
        onConfirm={confirmQtyModal}
      />
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


