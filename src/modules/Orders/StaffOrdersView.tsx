/**
 * StaffOrdersView — واجهة الموظف لإرسال طلبات القسم
 * جوال أولاً 100%، بدون تفاصيل مالية، بدون تعقيد
 */
import React, { useState, useMemo, useCallback } from 'react';
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
} from '../../hooks/useOrders';
import { Button, Input, Badge, ScreenShell, ScreenTitle } from '../../ui';

const SECTION_SUGGESTIONS = ['مطبخ', 'بار', 'كاشير', 'مخزن', 'سناك'];

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge color={status === 'sent' ? 'green' : 'amber'} size="sm">
      {status === 'sent' ? t('staffOrderSent') : t('staffOrderPending')}
    </Badge>
  );
}

interface ItemRow {
  productId: string;
  quantity: string;
  unit: string;
}

export function StaffOrdersView({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const { data: myOrders = [], isLoading } = useMyStaffOrders(companyId);
  const { data: products = [] } = useOrderProducts(companyId);
  const createOrder = useCreateStaffOrderMutation(companyId);
  const updateOrder = useUpdateStaffOrderMutation(companyId);
  const deleteOrder = useDeleteStaffOrderMutation(companyId);

  const [sectionName, setSectionName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ productId: '', quantity: '', unit: '' }]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const productsById = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  const filteredSuggestions = useMemo(() =>
    SECTION_SUGGESTIONS.filter((s) => !sectionName || s.includes(sectionName)),
    [sectionName],
  );

  function addItemRow() {
    setItems((prev) => [...prev, { productId: '', quantity: '', unit: '' }]);
  }

  function removeItemRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItemRow(idx: number, field: keyof ItemRow, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'productId') {
        const p = productsById.get(value);
        next[idx].unit = p?.unit || 'piece';
      }
      return next;
    });
  }

  function resetForm() {
    setSectionName('');
    setNotes('');
    setItems([{ productId: '', quantity: '', unit: '' }]);
    setEditingId(null);
  }

  function loadForEdit(order: any) {
    setSectionName(order.sectionName || '');
    setNotes(order.notes || '');
    setItems(
      (order.items || []).map((it: any) => ({
        productId: it.productId || '',
        quantity: String(it.quantity ?? ''),
        unit: it.unit || '',
      })),
    );
    setEditingId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSubmit = useCallback(async () => {
    if (!sectionName.trim()) { showToast(t('staffOrderSectionRequired'), 'error'); return; }
    const validItems = items.filter((it) => it.productId && parseFloat(it.quantity) > 0);
    if (!validItems.length) { showToast(t('staffOrderItemsRequired'), 'error'); return; }

    setSubmitting(true);
    try {
      const payload = {
        companyId,
        sectionName: sectionName.trim(),
        notes: notes.trim() || undefined,
        items: validItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
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
  }, [sectionName, notes, items, editingId, companyId]);

  const handleDelete = useCallback(async (order: any) => {
    if (!window.confirm(t('staffOrderDeleteConfirm'))) return;
    try {
      await deleteOrder.mutateAsync(order.id);
      showToast(t('deleted'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('deleteFailed'), 'error');
    }
  }, []);

  const pendingOrders = useMemo(() => myOrders.filter((o: any) => o.status === 'pending'), [myOrders]);
  const sentOrders = useMemo(() => myOrders.filter((o: any) => o.status === 'sent'), [myOrders]);

  return (
    <ScreenShell>
      <ScreenTitle>{t('staffOrdersTitle')}</ScreenTitle>

      {/* ── نموذج الإضافة/التعديل ── */}
      <div className="noorix-surface-card p-4 flex flex-col gap-3">
        <div className="text-[14px] font-bold text-noorix-text">
          {editingId ? t('staffOrderEdit') : t('staffOrderNew')}
        </div>

        {/* القسم */}
        <div className="relative">
          <Input
            label={t('staffOrderSection')}
            value={sectionName}
            onChange={(e: any) => { setSectionName(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={t('staffOrderSectionPlaceholder')}
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-10 top-full start-0 end-0 mt-1 bg-noorix-surface border border-noorix-border rounded-lg shadow-lg overflow-hidden">
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-start px-3 py-2 text-[14px] hover:bg-noorix-bg-muted transition-colors"
                  onMouseDown={() => { setSectionName(s); setShowSuggestions(false); }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* الأصناف */}
        <div className="flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-muted">{t('staffOrderItems')}</div>
          {items.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <select
                  className="w-full h-9 rounded-lg border border-noorix-border bg-noorix-surface px-2 text-[13px] text-noorix-text"
                  value={row.productId}
                  onChange={(e) => updateItemRow(idx, 'productId', e.target.value)}
                >
                  <option value="">{t('staffOrderSelectProduct')}</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nameAr || p.nameEn}</option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  placeholder={t('quantity')}
                  value={row.quantity}
                  onChange={(e: any) => updateItemRow(idx, 'quantity', e.target.value)}
                  min="0"
                />
              </div>
              <div className="w-24">
                <select
                  className="w-full h-9 rounded-lg border border-noorix-border bg-noorix-surface px-2 text-[13px] text-noorix-text"
                  value={row.unit}
                  onChange={(e) => updateItemRow(idx, 'unit', e.target.value)}
                >
                  <option value="piece">{t('ordersUnitPiece')}</option>
                  <option value="kg">{t('ordersUnitKg')}</option>
                  <option value="box">{t('ordersUnitBox')}</option>
                  <option value="dozen">{t('ordersUnitDozen')}</option>
                </select>
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItemRow(idx)}
                  className="text-noorix-red text-[18px] leading-none px-1 flex-shrink-0"
                  aria-label={t('delete')}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={addItemRow}>
            + {t('staffOrderAddItem')}
          </Button>
        </div>

        {/* ملاحظات */}
        <Input
          label={t('notes')}
          value={notes}
          onChange={(e: any) => setNotes(e.target.value)}
          placeholder={t('optional')}
        />

        {/* أزرار */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t('saving') : editingId ? t('save') : t('staffOrderSubmit')}
          </Button>
          {editingId && (
            <Button size="md" variant="ghost" onClick={resetForm}>
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>

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
                <div className="grid grid-cols-1 gap-1">
                  {(o.items || []).map((it: any, i: number) => {
                    const p = it.product;
                    const name = p?.nameAr || p?.nameEn || '—';
                    const unit = it.unit ? ` ${it.unit}` : '';
                    return (
                      <div key={i} className="flex justify-between text-[13px]">
                        <span className="text-noorix-text">{name}</span>
                        <span className="font-semibold nx-font-numbers">{fmt(it.quantity, 0)}{unit}</span>
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

      {!isLoading && myOrders.length === 0 && (
        <div className="noorix-surface-card p-8 text-center text-noorix-muted text-[14px]">
          {t('staffOrderNoOrders')}
        </div>
      )}
    </ScreenShell>
  );
}
