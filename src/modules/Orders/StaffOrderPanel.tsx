import React, { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../../context/ToastContext';
import { getSaudiToday, toDateInputYmd } from '../../utils/saudiDate';
import { orderKeys } from '../../services/queryKeys';
import {
  type StaffBasketLine,
  defaultVariantModalState,
  productHasVariants,
  resolveVariantFromModal,
  staffBasketLineKey,
} from './utils/staffOrderBasketUtils';
import { withStandardCharcoalVariants } from './utils/charcoalPackaging';
import {
  buildProductsById,
  createDraftLineId,
  buildStaffOrderFrequencyMap,
  buildStaffOrderPayload,
  buildStaffQtyMap,
  filterStaffOrderProducts,
  filterStaffOrdersByType,
  filterStaffSaleOrdersToRecentWeek,
  groupSentSaleOrders,
  canMutateStaffSaleOrder,
  latestEditableStaffSaleScope,
  mapStaffOrderToBasketLines,
  summarizeSentSales,
  upsertPlainStaffBasketLine,
} from './utils/staffOrderPanelModel';
import { useApp } from '../../context/AppContext';
import { resolveItemSection } from './StaffOrdersViewParts';
import {
  StaffBasketSummary,
  StaffCancellationModeControl,
  StaffOrderPanelDialogs,
  StaffProductPicker,
  StaffSectionFilter,
  StaffSentOrdersSection,
} from './StaffOrderPanelSections';
import {
  useMyStaffOrders,
  useStaffSaleDateStatus,
  useStaffSaleNextLogRef,
  useCreateStaffOrderMutation,
  useUpdateStaffOrderMutation,
  useDeleteStaffOrderMutation,
  useResendStaffOrderMutation,
  useOrderProducts,
  useOrderSections,
} from '../../hooks/useOrders';
import type { OrderProduct, StaffOrder } from '../../types/api';
import type { StaffQtyModalState } from './StaffOrderPanelModals';

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
  const { userRole } = useApp();

  const { data: myOrders = [], isLoading, isError: ordersError } = useMyStaffOrders(companyId);
  const { data: allProducts = [] } = useOrderProducts(companyId, productType);
  const { data: sections = [] } = useOrderSections(companyId);
  const createOrder = useCreateStaffOrderMutation(companyId);
  const updateOrder = useUpdateStaffOrderMutation(companyId);
  const deleteOrder = useDeleteStaffOrderMutation(companyId);
  const resendOrder = useResendStaffOrderMutation(companyId);

  const isSale = productType === 'sale';
  const [saleWorkspaceTab, setSaleWorkspaceTab] = useState<'entry' | 'history'>('entry');
  const [sectionFilter, setSectionFilter] = useState('');
  const [saleDate, setSaleDate] = useState(() => getSaudiToday());
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [basketLines, setBasketLines] = useState<StaffBasketLine[]>([]);
  const [entryType, setEntryType] = useState<'issue' | 'cancellation'>('issue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendWhatsAppPrompt, setSendWhatsAppPrompt] = useState<string | null>(null);
  const [qtyModal, setQtyModal] = useState<StaffQtyModalState | null>(null);
  const [variantModal, setVariantModal] = useState<ReturnType<typeof defaultVariantModalState> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffOrder | null>(null);

  const freqMap = useMemo(
    () => buildStaffOrderFrequencyMap(myOrders, productType),
    [myOrders, productType],
  );

  const productsById = useMemo(() => buildProductsById(allProducts), [allProducts]);

  const products = useMemo(
    () => filterStaffOrderProducts({ allProducts, sectionFilter, search, freqMap, lang: displayLang }),
    [allProducts, sectionFilter, search, freqMap, displayLang],
  );

  const qtyMap = useMemo(() => buildStaffQtyMap(basketLines), [basketLines]);

  const myTypedOrders = useMemo(
    () => filterStaffOrdersByType(myOrders, productType),
    [myOrders, productType],
  );
  const visibleOrders = useMemo(
    () => (isSale ? filterStaffSaleOrdersToRecentWeek(myTypedOrders.filter((o) => o.status === 'sent')) : myTypedOrders),
    [isSale, myTypedOrders],
  );
  const sentSaleGroups = useMemo(
    () => groupSentSaleOrders(visibleOrders, isSale),
    [isSale, visibleOrders],
  );

  const sentSalesSummary = useMemo(
    () => summarizeSentSales({ isSale, sentSaleGroups, sentOrders: visibleOrders }),
    [isSale, sentSaleGroups, visibleOrders],
  );
  const saleHistoryCount = isSale ? sentSaleGroups.length : visibleOrders.length;
  const isPrivilegedStaffOrderUser = useMemo(() => {
    const role = String(userRole || '').toLowerCase();
    return role === 'owner' || role === 'super_admin';
  }, [userRole]);
  const latestEditableSaleScope = useMemo(
    () => latestEditableStaffSaleScope(visibleOrders),
    [visibleOrders],
  );
  const canMutateSaleOrder = useCallback(
    (order: StaffOrder) => canMutateStaffSaleOrder({
      order,
      latestScope: latestEditableSaleScope,
      isPrivileged: isPrivilegedStaffOrderUser,
    }),
    [isPrivilegedStaffOrderUser, latestEditableSaleScope],
  );

  const editingOrder = useMemo(
    () => (editingId ? myOrders.find((o) => o.id === editingId) : null),
    [editingId, myOrders],
  );
  const previewNextLogRef = isSale && basketLines.length > 0 && !editingId && !!saleDate;
  const { data: nextLogRef } = useStaffSaleNextLogRef(companyId, saleDate, previewNextLogRef);
  const { data: saleDateStatus } = useStaffSaleDateStatus(
    companyId,
    sectionFilter,
    isSale && !!sectionFilter && !editingId,
  );
  const basketLogRef = isSale ? (editingOrder?.logRef || nextLogRef || null) : null;

  React.useEffect(() => {
    if (isSale && !editingId && sectionFilter && saleDateStatus?.suggestedDate) {
      setSaleDate(saleDateStatus.suggestedDate);
    }
  }, [isSale, editingId, sectionFilter, saleDateStatus?.suggestedDate]);

  function tapProduct(product: OrderProduct) {
    const resolvedProduct = withStandardCharcoalVariants(product);
    if (productHasVariants(resolvedProduct)) {
      setVariantModal(defaultVariantModalState(resolvedProduct));
      return;
    }
    const unit = resolvedProduct.unit || 'piece';
    const key = staffBasketLineKey({ productId: resolvedProduct.id, size: '', packaging: '', unit });
    const idx = basketLines.findIndex((l) => staffBasketLineKey(l) === key);
    if (idx >= 0 && entryType === 'issue') {
      setBasketLines((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      });
    } else {
      setQtyModal({
        product: resolvedProduct,
        qty: 1,
        unit,
        cancellationReasons: [],
        cancellationNote: '',
      });
    }
  }

  function confirmQtyModal() {
    if (!qtyModal) return;
    const { product, qty, unit } = qtyModal;
    if (qty <= 0) { setQtyModal(null); return; }
    if (entryType === 'cancellation') {
      if (qtyModal.cancellationReasons.length === 0) {
        showToast(t('staffCancellationReasonRequired'), 'error');
        return;
      }
      if (qtyModal.cancellationReasons.includes('other') && !qtyModal.cancellationNote.trim()) {
        showToast(t('staffCancellationOtherNoteRequired'), 'error');
        return;
      }
      setBasketLines((prev) => [...prev, {
        lineId: createDraftLineId(product.id),
        productId: product.id,
        quantity: qty,
        unit,
        size: '',
        packaging: '',
        unitPrice: product.lastPrice ? String(product.lastPrice) : '0',
        sectionName: resolveItemSection(product, sectionFilter),
        cancellationReasons: qtyModal.cancellationReasons,
        cancellationNote: qtyModal.cancellationNote.trim(),
      }]);
      setQtyModal(null);
      return;
    }
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
    if (entryType === 'cancellation') {
      if (variantModal.cancellationReasons.length === 0) {
        showToast(t('staffCancellationReasonRequired'), 'error');
        return;
      }
      if (variantModal.cancellationReasons.includes('other') && !variantModal.cancellationNote.trim()) {
        showToast(t('staffCancellationOtherNoteRequired'), 'error');
        return;
      }
    }
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
      cancellationReasons: entryType === 'cancellation' ? variantModal.cancellationReasons : undefined,
      cancellationNote: entryType === 'cancellation' ? variantModal.cancellationNote.trim() : undefined,
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
    setEntryType('issue');
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
    setEntryType(order.entryType === 'cancellation' ? 'cancellation' : 'issue');
    setEditingId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const loadEditableOrder = useCallback((order: StaffOrder) => {
    if (isSale && !canMutateSaleOrder(order)) {
      showToast(t('staffSaleLatestOnly'), 'warning');
      return;
    }
    loadForEdit(order);
    if (isSale) setSaleWorkspaceTab('entry');
  }, [canMutateSaleOrder, isSale, showToast, t]);

  const handleSubmit = useCallback(async () => {
    if (basketLines.length === 0) { showToast(t('staffOrderItemsRequired'), 'error'); return; }
    if (isSale && !sectionFilter.trim()) {
      showToast(t('staffSaleSectionRequired'), 'error');
      return;
    }
    if (isSale) {
      const basketSections = new Set(
        basketLines
          .map((line) => String(line.sectionName || '').trim())
          .filter(Boolean),
      );
      if (basketSections.size !== 1 || !basketSections.has(sectionFilter.trim())) {
        showToast(t('staffSaleSingleSectionRequired'), 'error');
        return;
      }
    }
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
        entryType,
      });

      if (isSale) {
        const res = editingId
          ? await updateOrder.mutateAsync({ id: editingId, body: payload })
          : await createOrder.mutateAsync(payload);
        const saved = res.data && 'id' in res.data ? res.data : null;
        if (!saved?.id) throw new Error(t('saveFailed'));

        const savedLogRef = saved.logRef;
        showToast(
          entryType === 'cancellation'
            ? t('staffCancellationSaved')
            : (savedLogRef ? t('staffSaleSavedWithRef', savedLogRef) : t('staffSaleSaved')),
          'success',
        );
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orderKeys.staffMy(companyId) }),
          queryClient.invalidateQueries({ queryKey: ['salesReport', companyId] }),
        ]);
        resetForm();

        const waText = saved.whatsAppText?.trim();
        if (waText) {
          setSendWhatsAppPrompt(waText);
        }
        return;
      }

      const res = await createOrder.mutateAsync(payload);
      const saved = res.data && 'id' in res.data ? res.data : null;
      if (!saved?.id) throw new Error(t('saveFailed'));
      showToast(t('staffOrderCreated'), 'success');
      resetForm();
      const waText = saved.whatsAppText?.trim();
      if (waText) setSendWhatsAppPrompt(waText);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [sectionFilter, saleDate, notes, basketLines, productsById, editingId, entryType, companyId, productType, isSale, displayLang, t, showToast, createOrder, updateOrder, queryClient]);

  const handleResendOrder = useCallback(async (order: StaffOrder) => {
    try {
      const res = await resendOrder.mutateAsync({ id: order.id, lang: displayLang });
      const data = res.data;
      const waText = data?.whatsAppText;
      if (waText) {
        openWhatsApp(waText);
        showToast(t('staffSaleResent'), 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('saveFailed'), 'error');
    }
  }, [displayLang, resendOrder, t, showToast]);

  const handleDelete = useCallback(async (order: StaffOrder) => {
    if (isSale && !canMutateSaleOrder(order)) {
      showToast(t('staffSaleLatestOnly'), 'warning');
      return;
    }
    setDeleteTarget(order);
  }, [canMutateSaleOrder, isSale, showToast, t]);

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

  const showEntryWorkspace = !isSale || saleWorkspaceTab === 'entry';
  const showHistoryWorkspace = !isSale || saleWorkspaceTab === 'history';

  return (
    <div className="flex flex-col gap-4">
      <StaffOrderPanelDialogs
        deleteTarget={deleteTarget}
        isSale={isSale}
        t={t}
        lang={lang}
        deleteBusy={deleteOrder.isPending}
        sendWhatsAppPrompt={sendWhatsAppPrompt}
        qtyModal={qtyModal}
        variantModal={variantModal}
        isCancellation={entryType === 'cancellation'}
        setDeleteTarget={setDeleteTarget}
        confirmDelete={confirmDelete}
        setSendWhatsAppPrompt={setSendWhatsAppPrompt}
        openWhatsApp={openWhatsApp}
        showToast={showToast}
        setQtyModal={setQtyModal}
        confirmQtyModal={confirmQtyModal}
        setVariantModal={setVariantModal}
        confirmVariantModal={confirmVariantModal}
      />
      {isSale ? (
        <div className="noorix-surface-card p-1 flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            className={`min-h-9 rounded-lg px-4 text-[13px] font-bold transition whitespace-nowrap ${
              saleWorkspaceTab === 'entry'
                ? 'bg-noorix-green text-white shadow-sm'
                : 'text-noorix-muted hover:bg-noorix-soft'
            }`}
            onClick={() => setSaleWorkspaceTab('entry')}
          >
            {t('staffSaleEntryTab')}
          </button>
          <button
            type="button"
            className={`min-h-9 rounded-lg px-4 text-[13px] font-bold transition whitespace-nowrap ${
              saleWorkspaceTab === 'history'
                ? 'bg-noorix-green text-white shadow-sm'
                : 'text-noorix-muted hover:bg-noorix-soft'
            }`}
            onClick={() => setSaleWorkspaceTab('history')}
          >
            {t('staffSaleHistoryTab')}
            <span className="ms-2 rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-noorix-green">
              {saleHistoryCount}
            </span>
          </button>
        </div>
      ) : null}

      {showEntryWorkspace ? (
        <>
          <StaffSectionFilter
            sections={sections}
            sectionFilter={sectionFilter}
            lang={lang}
            setSectionFilter={setSectionFilter}
            setSearch={setSearch}
          />
          {isSale ? (
            <StaffCancellationModeControl
              isCancellation={entryType === 'cancellation'}
              t={t}
              onChange={(nextEntryType) => {
                setEntryType(nextEntryType);
                setBasketLines([]);
                setEditingId(null);
                setEditingQtyId(null);
              }}
            />
          ) : null}

          <StaffProductPicker
            products={products}
            lang={lang}
            t={t}
            search={search}
            sectionFilter={sectionFilter}
            qtyMap={qtyMap}
            freqMap={freqMap}
            setSearch={setSearch}
            tapProduct={tapProduct}
            removeProduct={removeProduct}
          />
        </>
      ) : null}

      {ordersError && (
        <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 px-4 py-3 text-[13px] text-noorix-red">
          {t('staffOrdersLoadError')}
        </div>
      )}

      {showEntryWorkspace ? (
        <StaffBasketSummary
          basketLines={basketLines}
          productsById={productsById}
          lang={lang}
          t={t}
          isSale={isSale}
          isCancellation={entryType === 'cancellation'}
          basketLogRef={basketLogRef}
          saleDateHint={isSale && sectionFilter
            ? (saleDateStatus?.lastSectionDate
                ? t('staffSaleAutoDateHint', sectionFilter, saleDateStatus.lastSectionDate)
                : t('staffSaleAutoDateFirstHint', sectionFilter))
            : undefined}
          editingQtyId={editingQtyId}
          saleDate={saleDate}
          notes={notes}
          submitting={submitting}
          editingId={editingId}
          setEditingQtyId={setEditingQtyId}
          setLineQty={setLineQty}
          removeLine={removeLine}
          setSaleDate={setSaleDate}
          setNotes={setNotes}
          resetForm={resetForm}
          handleSubmit={handleSubmit}
        />
      ) : null}

      {showHistoryWorkspace ? (
        <StaffSentOrdersSection
          isSale={isSale}
          sentOrders={visibleOrders}
          sentSaleGroups={sentSaleGroups}
          sentSalesSummary={sentSalesSummary}
          lang={lang}
          t={t}
          handleResendOrder={handleResendOrder}
          loadForEdit={loadEditableOrder}
          handleDelete={handleDelete}
          canMutateOrder={canMutateSaleOrder}
        />
      ) : null}

      {!isLoading && !isSale && myTypedOrders.length === 0 && basketLines.length === 0 && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('staffOrderNoOrders')}
        </div>
      )}
      {!isLoading && isSale && saleWorkspaceTab === 'history' && visibleOrders.length === 0 && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('staffSaleNoRecords')}
        </div>
      )}
    </div>
  );
}


