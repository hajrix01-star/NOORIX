/**
 * OrderFormModal — نموذج إنشاء/تعديل طلب
 * اختيار الأصناف: كروت POS + أزرار أقسام + بحث
 */
import React, { useState, useMemo, useCallback } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import type { ProductSearchItem } from '../../../components/common/ProductSearchInput';
import { DialogActions, Input, AdaptiveSheet, SummaryBar } from '../../../ui';
import { useOrderSections } from '../../../hooks/useOrders';
import type { CreateOrderPayload, OrderType, OrderProduct, OrderRecord, UpdateOrderPayload } from '../../../types/api';
import { OrderDraftItemsTable, OrderProductPicker, OrderSavedSuccess } from './OrderFormModalPieces';
import { OrderBasicFields } from './OrderBasicFields';
import { OrderProductAddModal as AddModal } from './OrderProductAddModal';
import {
  buildOrderDraftLines,
  orderMutationData,
  type OrderAddModalState,
  type OrderDraftLine,
  type OrderMutation,
} from '../utils/orderFormModel';
import { buildProductUnitSelectionModel } from '../utils/productUnitConversionModel';

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
}: {
  companyId: string;
  products?: OrderProduct[];
  initialOrder?: OrderRecord | null;
  createOrder: OrderMutation<CreateOrderPayload, OrderRecord>;
  updateOrder?: OrderMutation<{ id: string; body: UpdateOrderPayload }, OrderRecord>;
  onSuccess?: (order: OrderRecord) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
  onWhatsApp?: (order: OrderRecord) => void;
}) {
  const { t, lang } = useTranslation();
  const isEdit = !!initialOrder?.id;

  const [orderDate, setOrderDate] = useState(() =>
    (initialOrder?.orderDate ? toDateInputYmd(initialOrder.orderDate) || getSaudiToday() : getSaudiToday()));
  const [orderType, setOrderType] = useState<OrderType>(
    initialOrder?.orderType === 'internal' || initialOrder?.orderType === 'transfer'
      ? initialOrder.orderType
      : 'external',
  );
  const [pettyCashAmount, setPettyCashAmount] = useState(initialOrder?.pettyCashAmount ? String(initialOrder.pettyCashAmount) : '');
  const [notes, setNotes] = useState(initialOrder?.notes || '');
  const [items, setItems] = useState<OrderDraftLine[]>(() => buildOrderDraftLines(initialOrder));
  const [savedOrder, setSavedOrder] = useState<OrderRecord | null>(null);

  const [sectionFilter, setSectionFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [addModal, setAddModal] = useState<OrderAddModalState | null>(null);

  const { data: sections = [] } = useOrderSections(companyId);

  const productsById = useMemo(() => {
    const m = new Map<string, OrderProduct>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const searchProducts = useMemo<ProductSearchItem[]>(
    () => products.map((product) => ({
      id: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn || undefined,
      lastPrice: product.lastPrice ?? undefined,
      variants: Array.isArray(product.variants)
        ? product.variants.map((variant) => ({
            size: variant.size || undefined,
            packaging: variant.packaging || undefined,
            unit: variant.unit || undefined,
            lastPrice: variant.lastPrice ?? undefined,
          }))
        : undefined,
    })),
    [products],
  );

  const searchProductsById = useMemo(
    () => new Map(searchProducts.map((product) => [product.id, product])),
    [searchProducts],
  );

  const qtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const prev = m.get(it.productId) ?? 0;
      m.set(it.productId, prev + Math.max(0, parseFloat(it.quantity) || 0));
    }
    return m;
  }, [items]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => (p.productType || 'order') === 'order');
    if (sectionFilter) {
      list = list.filter((p) => {
        const secs = p.sections;
        return Array.isArray(secs) && secs.includes(sectionFilter);
      });
    }
    const q = productSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        (p.nameAr || '').toLowerCase().includes(q) ||
        (p.nameEn || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, sectionFilter, productSearch]);

  const enrichedItems = useMemo(() => {
    return items.map((it) => {
      const p = productsById.get(it.productId);
      const qty = new Decimal(it.quantity || 0);
      const price = new Decimal(it.unitPrice || (p?.lastPrice ?? 0));
      return { ...it, amount: qty.times(price), product: p };
    });
  }, [items, productsById]);

  const totalAmount = useMemo(() =>
    enrichedItems.reduce((sum, it) => sum.plus(it.amount), new Decimal(0)),
    [enrichedItems]);

  const tapProduct = useCallback((p: OrderProduct) => {
    const choice = buildProductUnitSelectionModel(p).pricedChoices[0];
    if (!choice) {
      onError?.(lang === 'en'
        ? 'Define a valid priced unit for this product first.'
        : 'عرّف وحدة مسعّرة صالحة لهذا الصنف أولاً.');
      return;
    }
    setAddModal({
      product: p,
      variantKey: choice.key,
      size: choice.size,
      packaging: choice.packaging,
      unit: choice.unit,
      quantity: '1',
      unitPrice: choice.unitPrice,
    });
  }, [lang, onError]);

  function confirmAddModal() {
    if (!addModal) return;
    const { product, variantKey, size, packaging, unit, quantity, unitPrice } = addModal;
    if (!quantity || parseFloat(quantity) <= 0) { setAddModal(null); return; }
    const choices = buildProductUnitSelectionModel(product).pricedChoices;
    let resolvedSize = size, resolvedPackaging = packaging, resolvedUnit = unit, resolvedPrice = unitPrice;
    if (variantKey && choices.length > 0) {
      const choice = choices.find((value) => value.key === variantKey) || choices[0];
      resolvedSize = choice.size;
      resolvedPackaging = choice.packaging;
      resolvedUnit = choice.unit;
      if (!resolvedPrice) resolvedPrice = choice.unitPrice;
    }
    setItems((prev) => [...prev, {
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
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof OrderDraftLine, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'productId') {
        const p = productsById.get(value);
        const choice = p ? buildProductUnitSelectionModel(p).pricedChoices[0] : undefined;
        next[idx].unitPrice = choice?.unitPrice || '';
        next[idx].size = choice?.size || '';
        next[idx].packaging = choice?.packaging || '';
        next[idx].unit = choice?.unit || '';
      }
      return next;
    });
  }

  function handleSave() {
    const validItems = items
      .map((it) => ({
        productId: it.productId,
        size: it.size?.trim() || undefined,
        packaging: it.packaging?.trim() || undefined,
        unit: it.unit?.trim() || undefined,
        quantity: String(it.quantity || 0),
        unitPrice: String(it.unitPrice || 0),
      }))
      .filter((it) => it.productId && Number.parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { onError?.(t('ordersAddAtLeastOneItem')); return; }
    const payload: UpdateOrderPayload = {
      orderDate, orderType,
      pettyCashAmount: orderType === 'external' && pettyCashAmount ? String(pettyCashAmount) : undefined,
      notes: notes.trim() || undefined,
      items: validItems,
    };
    if (isEdit && updateOrder) {
      if (updateOrder.isPending) return;
      updateOrder.mutate({ id: initialOrder.id, body: payload }, {
        onSuccess: (res) => {
          const d = orderMutationData(res);
          if (!d) return;
          setSavedOrder(d);
          onSuccess?.(d);
        },
        onError: (e) => onError?.(e?.message || t('saveFailed')),
      });
    } else {
      if (!companyId || createOrder.isPending) return;
      const createPayload: CreateOrderPayload = {
        companyId,
        orderDate,
        orderType,
        pettyCashAmount: payload.pettyCashAmount,
        notes: payload.notes,
        items: validItems,
      };
      createOrder.mutate(createPayload, {
        onSuccess: (res) => {
          const d = orderMutationData(res);
          if (!d) return;
          setSavedOrder(d);
          onSuccess?.(d);
        },
        onError: (e) => onError?.(e?.message || t('saveFailed')),
      });
    }
  }

  function resetForm() {
    setOrderDate(getSaudiToday()); setOrderType('external'); setPettyCashAmount('');
    setNotes(''); setItems([]); setSavedOrder(null);
    setSectionFilter(''); setProductSearch('');
  }

  if (savedOrder) {
    return (
      <OrderSavedSuccess
        order={savedOrder}
        t={t}
        onAddNew={resetForm}
        onClose={() => { onClose?.(); resetForm(); }}
        onWhatsApp={onWhatsApp}
      />
    );
  }

  const addModalChoices = addModal
    ? buildProductUnitSelectionModel(addModal.product).pricedChoices
    : [];

  const productName = addModal
    ? (lang === 'en' ? (addModal.product.nameEn || addModal.product.nameAr || '') : (addModal.product.nameAr || addModal.product.nameEn || ''))
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
          <DialogActions
            className="w-full"
            actions={[{
              key: 'save',
              label: t('save'),
              role: 'save',
              className: 'w-full justify-center',
              disabled: (isEdit ? updateOrder?.isPending : createOrder.isPending) || totalAmount.lte(0) || products.length === 0,
              loading: isEdit ? updateOrder?.isPending : createOrder.isPending,
              onClick: handleSave,
            }]}
          />
        }
      >
        <OrderBasicFields
          orderDate={orderDate}
          orderType={orderType}
          pettyCashAmount={pettyCashAmount}
          t={t}
          onOrderDateChange={setOrderDate}
          onOrderTypeChange={setOrderType}
          onPettyCashAmountChange={setPettyCashAmount}
        />

        <OrderProductPicker
          products={products}
          sections={sections}
          filteredProducts={filteredProducts}
          lang={lang}
          sectionFilter={sectionFilter}
          productSearch={productSearch}
          qtyMap={qtyMap}
          t={t}
          onSectionFilterChange={setSectionFilter}
          onProductSearchChange={setProductSearch}
          onProductTap={tapProduct}
          onProductRemove={(productId) => setItems((prev) => prev.filter((item) => item.productId !== productId))}
        />

        <OrderDraftItemsTable
          items={items}
          enrichedItems={enrichedItems}
          productsById={productsById}
          searchProducts={searchProducts}
          searchProductsById={searchProductsById}
          t={t}
          updateItem={updateItem}
          updateItems={setItems}
          removeItem={removeItem}
        />

        <div className="mb-4">
          <Input multiline label={t('notes')} value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} />
        </div>

        <SummaryBar
          items={[
            { key: 'total', label: t('total'), value: totalAmount.toNumber(), tone: 'green', currency: 'SR' },
          ]}
        />
      </AdaptiveSheet>

      {addModal && (
        <AddModal
          addModal={addModal}
          productName={productName}
          choices={addModalChoices}
          t={t}
          setAddModal={setAddModal}
          onConfirm={confirmAddModal}
        />
      )}
    </>
  );
}
