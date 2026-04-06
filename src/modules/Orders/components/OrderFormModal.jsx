/**
 * OrderFormModal — نافذة إدخال الطلب
 */
import React, { useState, useMemo, useEffect } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { getSaudiToday } from '../../../utils/saudiDate';
import { ProductSearchInput } from '../../../components/common/ProductSearchInput';
import { Button, Input, Modal } from '../../../ui';

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
}) {
  const { t } = useTranslation();
  const isEdit = !!initialOrder?.id;
  const [orderDate, setOrderDate] = useState(() => initialOrder?.orderDate ? new Date(initialOrder.orderDate).toISOString().slice(0, 10) : getSaudiToday());
  const [orderType, setOrderType] = useState(initialOrder?.orderType || 'external');
  const [pettyCashAmount, setPettyCashAmount] = useState(initialOrder?.pettyCashAmount ? String(initialOrder.pettyCashAmount) : '');
  const [notes, setNotes] = useState(initialOrder?.notes || '');
  const [items, setItems] = useState(() => {
    if (initialOrder?.items?.length) {
      return initialOrder.items.map((it) => ({
        productId: it.productId,
        size: it.size || '',
        quantity: String(it.quantity ?? ''),
        unitPrice: String(it.unitPrice ?? ''),
      }));
    }
    return [];
  });
  const [addRow, setAddRow] = useState({ productId: '', variantKey: '', size: '', packaging: '', unit: '', quantity: '', unitPrice: '' });
  const [savedOrder, setSavedOrder] = useState(null);

  const productsById = useMemo(() => {
    const m = new Map();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const enrichedItems = useMemo(() => {
    return items.map((it) => {
      const p = productsById.get(it.productId);
      const qty = new Decimal(it.quantity || 0);
      const price = new Decimal(it.unitPrice || (p?.lastPrice ?? 0));
      return { ...it, amount: qty.times(price), product: p };
    });
  }, [items, productsById]);

  const productVariants = useMemo(() => {
    const p = productsById.get(addRow.productId);
    const v = p?.variants;
    if (!Array.isArray(v) || v.length === 0) return [];
    return v.map((x, i) => ({ ...x, _key: `${x.size || ''}|${x.packaging || ''}|${x.unit || ''}|${i}` }));
  }, [addRow.productId, productsById]);

  const totalAmount = useMemo(() => {
    return enrichedItems.reduce((sum, it) => sum.plus(it.amount), new Decimal(0));
  }, [enrichedItems]);

  function addItemFromRow() {
    const { productId, size, packaging, unit, quantity, unitPrice } = addRow;
    if (!productId || parseFloat(quantity) <= 0) return;
    const p = productsById.get(productId);
    const variants = Array.isArray(p?.variants) ? p.variants : [];
    let price = unitPrice;
    if (!price && variants.length > 0) {
      const v = variants.find((x) => (x.size || '') === (size || '') && (x.packaging || '') === (packaging || '') && (x.unit || 'piece') === (unit || 'piece'));
      price = v?.lastPrice ? String(v.lastPrice) : '';
    }
    if (!price) price = p?.lastPrice ? String(p.lastPrice) : '';
    setItems((prev) => [...prev, { productId, size: size || '', packaging: packaging || '', unit: unit || '', quantity, unitPrice: price }]);
    setAddRow({ productId: '', variantKey: '', size: '', packaging: '', unit: '', quantity: '', unitPrice: '' });
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    setItems((prev) => {
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
      .map((it) => ({
        productId: it.productId,
        size: it.size?.trim() || undefined,
        packaging: it.packaging?.trim() || undefined,
        unit: it.unit?.trim() || undefined,
        quantity: String(it.quantity || 0),
        unitPrice: String(it.unitPrice || 0),
      }))
      .filter((it) => it.productId && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) {
      onError?.(t('ordersAddAtLeastOneItem'));
      return;
    }
    const payload = {
      orderDate,
      orderType,
      pettyCashAmount: orderType === 'external' && pettyCashAmount ? String(pettyCashAmount) : undefined,
      notes: notes.trim() || undefined,
      items: validItems,
    };
    if (isEdit && updateOrder) {
      if (updateOrder.isPending) return;
      updateOrder.mutate(
        { id: initialOrder.id, body: payload },
        {
          onSuccess: (res) => {
            const data = res?.data ?? res ?? { ...initialOrder, ...payload };
            setSavedOrder(data);
            onSuccess?.(data);
          },
          onError: (e) => onError?.(e?.message || t('saveFailed')),
        },
      );
    } else {
      if (!companyId || createOrder.isPending) return;
      createOrder.mutate(
        { companyId, ...payload },
        {
          onSuccess: (res) => {
            const data = res?.data ?? res;
            setSavedOrder(data);
            onSuccess?.(data);
          },
          onError: (e) => onError?.(e?.message || t('saveFailed')),
        },
      );
    }
  }

  function resetForm() {
    setOrderDate(getSaudiToday());
    setOrderType('external');
    setPettyCashAmount('');
    setNotes('');
    setItems([]);
    setAddRow({ productId: '', variantKey: '', size: '', packaging: '', unit: '', quantity: '', unitPrice: '' });
    setSavedOrder(null);
  }

  const cellInputStyle = {
    width: '100%', padding: '6px 8px', borderRadius: 6,
    border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
    color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
    minHeight: 36,
  };

  // شاشة النجاح بعد الحفظ
  if (savedOrder) {
    return (
      <Modal
        open
        onClose={() => { resetForm(); onClose?.(); }}
        size="sm"
        hideClose={false}
      >
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}></div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{t('orderSaved')}</h3>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--noorix-text-muted)' }}>
            {t('orderNumber')}: <strong style={{ color: 'var(--noorix-accent-blue)' }}>{savedOrder.orderNumber}</strong>
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('total')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(savedOrder.totalAmount ?? 0, 2)} ﷼</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <Button variant="success" fullWidth onClick={() => onWhatsApp?.(savedOrder)}>
              {t('sendWhatsApp')} — {t('order')}
            </Button>
            <div className="nx-toolbar" style={{ justifyContent: 'center' }}>
              <Button onClick={() => { resetForm(); }}>{t('ordersAddNewOrder')}</Button>
              <Button onClick={() => { onClose?.(); resetForm(); }}>{t('close')}</Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? t('ordersEditOrder') : t('ordersNewOrder')}
      size="lg"
      footer={
        <Button
          variant="success"
          fullWidth
          disabled={(isEdit ? updateOrder?.isPending : createOrder.isPending) || totalAmount.lte(0) || products.length === 0}
          loading={isEdit ? updateOrder?.isPending : createOrder.isPending}
          onClick={handleSave}
        >
          {t('save')}
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 16, marginBottom: 18 }}>
        <Input
          type="date"
          label={`${t('orderDate')} *`}
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
        />
        <Input
          type="select"
          label={`${t('orderType')} *`}
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
        >
          <option value="external">{t('orderTypeExternal')}</option>
          <option value="internal">{t('orderTypeInternal')}</option>
        </Input>
        {orderType === 'external' && (
          <Input
            type="number"
            label={t('pettyCashAmount')}
            min="0"
            step="0.01"
            value={pettyCashAmount}
            onChange={(e) => setPettyCashAmount(e.target.value)}
            placeholder="0.00"
          />
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 10 }}>{t('orderItems')}</label>
        {products.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 10, fontSize: 13 }}>
            {t('ordersNoProducts')}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(120px,1fr) minmax(70px,1fr) minmax(80px,1fr) auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('product')}</label>
                <ProductSearchInput
                  products={products}
                  productsById={productsById}
                  value={addRow.productId}
                  onChange={(pid) => setAddRow((r) => ({ ...r, productId: pid }))}
                  onSelectProduct={(sel) => setAddRow((r) => ({
                    ...r,
                    productId: sel.productId,
                    variantKey: sel.variantKey || '',
                    size: sel.size || '',
                    packaging: sel.packaging || '',
                    unit: sel.unit || 'piece',
                    unitPrice: sel.unitPrice || '',
                  }))}
                  placeholder={t('searchProduct') ? `${t('searchProduct')} — ${t('selectProduct')}` : 'ابحث بالعربي أو الإنجليزي — اختر الصنف'}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{productVariants.length > 0 ? t('ordersProductVariants') : t('ordersProductSize')}</label>
                {productVariants.length > 0 ? (
                  <Input
                    type="select"
                    value={addRow.variantKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      const v = productVariants.find((x) => x._key === key);
                      if (v) setAddRow((r) => ({ ...r, variantKey: key, size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', unitPrice: v.lastPrice ? String(v.lastPrice) : '' }));
                    }}
                  >
                    <option value="">—</option>
                    {productVariants.map((v) => (
                      <option key={v._key} value={v._key}>
                        {[v.size, v.packaging, v.unit].filter(Boolean).join(' / ') || '—'} — {fmt(v.lastPrice ?? 0, 2)} ﷼
                      </option>
                    ))}
                  </Input>
                ) : (
                  <Input
                    type="select"
                    value={addRow.size}
                    onChange={(e) => setAddRow((r) => ({ ...r, size: e.target.value }))}
                  >
                    <option value="">—</option>
                    {(productsById.get(addRow.productId)?.sizes || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Input>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('quantity')}</label>
                <Input type="number" min="0" step="0.01" value={addRow.quantity} onChange={(e) => setAddRow((r) => ({ ...r, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('unitPrice')}</label>
                <Input type="number" min="0" step="0.01" value={addRow.unitPrice} onChange={(e) => setAddRow((r) => ({ ...r, unitPrice: e.target.value }))} placeholder="0" />
              </div>
              <Button variant="primary" onClick={addItemFromRow}>+ {t('add')}</Button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--noorix-border)', background: 'var(--noorix-bg-muted)' }}>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('product')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('ordersProductSize')} / {t('ordersProductPackaging')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('quantity')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('unitPrice')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('total')}</th>
                    <th style={{ width: 44, padding: '8px 4px' }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const p = productsById.get(it.productId);
                    const variantsArr = Array.isArray(p?.variants) ? p.variants : [];
                    const sizesArr = p?.sizes ? String(p.sizes).split(/[,،]/).map((x) => x.trim()).filter(Boolean) : [];
                    const variantLabel = [it.size, it.packaging, it.unit].filter(Boolean).join(' / ') || '—';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                        <td style={{ padding: '8px 10px', minWidth: 140 }}>
                          <ProductSearchInput
                            products={products}
                            productsById={productsById}
                            value={it.productId}
                            onChange={(pid) => updateItem(idx, 'productId', pid)}
                            onSelectProduct={(sel) => {
                              setItems((prev) => {
                                const next = [...prev];
                                next[idx] = {
                                  ...next[idx],
                                  productId: sel.productId,
                                  size: sel.size || '',
                                  packaging: sel.packaging || '',
                                  unit: sel.unit || 'piece',
                                  unitPrice: sel.unitPrice || next[idx].unitPrice,
                                };
                                return next;
                              });
                            }}
                            placeholder={t('selectProduct')}
                            compact
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {variantsArr.length > 0 ? (
                            <Input
                              type="select"
                              value={`${it.size || ''}|${it.packaging || ''}|${it.unit || ''}`}
                              onChange={(e) => {
                                const v = variantsArr.find((x) => `${x.size || ''}|${x.packaging || ''}|${x.unit || ''}` === e.target.value);
                                if (v) {
                                  setItems((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], size: v.size || '', packaging: v.packaging || '', unit: v.unit || 'piece', unitPrice: v.lastPrice ? String(v.lastPrice) : next[idx].unitPrice };
                                    return next;
                                  });
                                }
                              }}
                            >
                              {variantsArr.map((v) => (
                                <option key={`${v.size}|${v.packaging}|${v.unit}`} value={`${v.size || ''}|${v.packaging || ''}|${v.unit || ''}`}>
                                  {[v.size, v.packaging, v.unit].filter(Boolean).join(' / ') || '—'}
                                </option>
                              ))}
                            </Input>
                          ) : sizesArr.length > 0 ? (
                            <Input type="select" value={it.size} onChange={(e) => updateItem(idx, 'size', e.target.value)}>
                              <option value="">—</option>
                              {sizesArr.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </Input>
                          ) : (
                            <span className="nx-cell-muted">{variantLabel}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <Input type="number" min="0" step="0.01" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} style={{ width: 70 }} />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <Input type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} style={{ width: 80 }} />
                        </td>
                        <td className="nx-cell-num" style={{ padding: '8px 10px', fontWeight: 600 }}>{fmt(enrichedItems[idx]?.amount ?? 0, 2)}</td>
                        <td style={{ padding: '8px 4px' }}>
                          <Button size="sm" variant="danger" onClick={() => removeItem(idx)}>✕</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('ordersSelectProductAndAdd') || 'اختر صنفاً واضغط إضافة'}</div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <Input
          multiline
          label={t('notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={t('notesPlaceholder')}
        />
      </div>

      <div className="noorix-summary-bar">
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">{t('total')}</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--green">{fmt(totalAmount, 2)} ﷼</div>
        </div>
      </div>
    </Modal>
  );
}
