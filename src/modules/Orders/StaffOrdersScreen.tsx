/**
 * Staff order requests — mobile-first, catalog + custom lines, drafts until manager digest.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  useOrderProducts,
  useStaffMyOrders,
  useCreateStaffOrderMutation,
  useUpdateStaffOrderMutation,
  useCancelStaffOrderMutation,
} from '../../hooks/useOrders';
import { getSaudiToday, toDateInputYmd, formatSaudiDate } from '../../utils/saudiDate';
import { ProductSearchInput } from '../../components/common/ProductSearchInput';
import { ScreenShell, ScreenTitle, Button, Input, FmtNum } from '../../ui';

type LineRow = {
  key: string;
  mode: 'product' | 'custom';
  productId?: string;
  labelHint?: string;
  customLabelAr?: string;
  customLabelEn?: string;
  size?: string;
  packaging?: string;
  unit?: string;
  quantity: string;
  unitPrice: string;
};

function newLineKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function StaffOrdersScreen() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const { showToast } = useToast();
  const companyId = activeCompanyId ?? '';

  const todayYmd = useMemo(() => getSaudiToday(), []);
  const [orderDate, setOrderDate] = useState(todayYmd);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'form' | 'list'>('form');
  const [pickerKey, setPickerKey] = useState(0);

  const ym = useMemo(() => {
    const p = (orderDate || todayYmd).split('-');
    const y = parseInt(p[0] || '0', 10);
    const m = parseInt(p[1] || '0', 10);
    return { year: y, month: m };
  }, [orderDate, todayYmd]);

  const { data: products = [] } = useOrderProducts(companyId);
  const { data: myOrders = [], isLoading: listLoading, refetch } = useStaffMyOrders(companyId, ym.year, ym.month);
  const createMut = useCreateStaffOrderMutation();
  const updateMut = useUpdateStaffOrderMutation(companyId);
  const cancelMut = useCancelStaffOrderMutation(companyId);

  const productsForSearch = useMemo(
    () =>
      products.map((p: any) => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        lastPrice: p.lastPrice,
        variants: p.variants,
      })),
    [products],
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setOrderDate(getSaudiToday());
    setNotes('');
    setLines([]);
    setPickerKey((k) => k + 1);
  }, []);

  const loadForEdit = useCallback((o: any) => {
    setEditingId(o.id);
    setOrderDate(toDateInputYmd(o.orderDate) || getSaudiToday());
    setNotes(o.notes || '');
    const next: LineRow[] = (o.items || []).map((it: any) => {
      if (it.productId) {
        const p = products.find((x: any) => x.id === it.productId);
        const hint = lang === 'ar' ? p?.nameAr || it.product?.nameAr : p?.nameEn || it.product?.nameEn || p?.nameAr || it.product?.nameAr;
        return {
          key: newLineKey(),
          mode: 'product' as const,
          productId: it.productId,
          labelHint: hint || '—',
          size: it.size || '',
          packaging: it.packaging || '',
          unit: it.unit || '',
          quantity: String(it.quantity ?? ''),
          unitPrice: String(it.unitPrice ?? ''),
        };
      }
      return {
        key: newLineKey(),
        mode: 'custom' as const,
        customLabelAr: it.customLabelAr || '',
        customLabelEn: it.customLabelEn || '',
        size: it.size || '',
        packaging: it.packaging || '',
        unit: it.unit || '',
        quantity: String(it.quantity ?? ''),
        unitPrice: String(it.unitPrice ?? ''),
      };
    });
    setLines(next);
    setTab('form');
    setPickerKey((k) => k + 1);
  }, [products, lang]);

  const addCustomLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: newLineKey(),
        mode: 'custom',
        customLabelAr: '',
        customLabelEn: '',
        quantity: '1',
        unitPrice: '0',
      },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((r) => r.key !== key));
  };

  const updateLine = (key: string, patch: Partial<LineRow>) => {
    setLines((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const buildPayloadItems = () => {
    return lines.map((r) => {
      if (r.mode === 'product' && r.productId) {
        return {
          productId: r.productId,
          size: r.size?.trim() || undefined,
          packaging: r.packaging?.trim() || undefined,
          unit: r.unit?.trim() || undefined,
          quantity: String(r.quantity || 0),
          unitPrice: String(r.unitPrice ?? 0),
        };
      }
      return {
        customLabelAr: (r.customLabelAr || '').trim(),
        customLabelEn: (r.customLabelEn || '').trim() || undefined,
        size: r.size?.trim() || undefined,
        packaging: r.packaging?.trim() || undefined,
        unit: r.unit?.trim() || undefined,
        quantity: String(r.quantity || 0),
        unitPrice: String(r.unitPrice ?? 0),
      };
    });
  };

  const handleSave = () => {
    if (!companyId) return;
    const items = buildPayloadItems();
    if (items.length === 0) {
      showToast(t('ordersAddAtLeastOneItem'), 'error');
      return;
    }
    for (const it of items) {
      const hasP = !!(it as any).productId;
      const hasC = !!(it as any).customLabelAr?.trim();
      if (!hasP && !hasC) {
        showToast(t('ordersStaffCustomNameAr'), 'error');
        return;
      }
    }
    const body = {
      companyId,
      orderDate,
      notes: notes.trim() || undefined,
      items,
    };
    if (editingId) {
      updateMut.mutate(
        { id: editingId, body },
        {
          onSuccess: () => {
            showToast(t('ordersStaffUpdated'), 'success');
            resetForm();
            refetch();
            setTab('list');
          },
          onError: (e: any) => showToast(e?.message || t('saveFailed'), 'error'),
        },
      );
    } else {
      createMut.mutate(body, {
        onSuccess: () => {
          showToast(t('ordersStaffSaved'), 'success');
          resetForm();
          refetch();
          setTab('list');
        },
        onError: (e: any) => showToast(e?.message || t('saveFailed'), 'error'),
      });
    }
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <ScreenShell className="min-w-0 pb-[calc(76px+env(safe-area-inset-bottom,0px))]">
      <ScreenTitle>{t('ordersStaffScreenTitle')}</ScreenTitle>
      <p className="text-[13px] text-noorix-muted leading-relaxed mb-4 max-w-xl">
        {t('ordersStaffScreenSubtitle')}
      </p>

      {!companyId && (
        <div className="noorix-surface-card nx-empty-state text-center">{t('ordersStaffSelectCompany')}</div>
      )}

      {companyId && (
        <>
          <div className="flex gap-2 mb-4 sticky top-0 z-10 bg-[var(--noorix-bg)] py-1 -mx-1 px-1">
            <Button type="button" size="sm" variant={tab === 'form' ? 'primary' : 'ghost'} className="flex-1" onClick={() => setTab('form')}>
              {editingId ? t('ordersStaffUpdateDraft') : t('ordersStaffNewRequest')}
            </Button>
            <Button type="button" size="sm" variant={tab === 'list' ? 'primary' : 'ghost'} className="flex-1" onClick={() => setTab('list')}>
              {t('ordersStaffMyRequests')}
            </Button>
          </div>

          {tab === 'list' && (
            <div className="flex flex-col gap-3 min-h-[200px]">
              {listLoading && <div className="text-center text-noorix-muted py-8">{t('loading')}</div>}
              {!listLoading && myOrders.length === 0 && (
                <div className="text-center text-noorix-muted py-8">{t('ordersNoOrdersInPeriod')}</div>
              )}
              {myOrders.map((o: any) => {
                const pending = o.isStaffRequest && !o.staffDigestSentAt;
                return (
                  <div
                    key={o.id}
                    className="noorix-surface-card p-4 flex flex-col gap-2 border border-noorix-border rounded-xl"
                  >
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div>
                        <div className="font-bold text-noorix-navy nx-font-numbers">#{o.orderNumber}</div>
                        <div className="text-[12px] text-noorix-muted">{formatSaudiDate(o.orderDate)}</div>
                      </div>
                      <div className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-noorix-bg-muted border border-noorix-border">
                        {pending ? t('ordersStaffPendingDigest') : t('ordersStaffSentDigest')}
                      </div>
                    </div>
                    <div className="text-[13px] text-noorix-muted">
                      {(o.items || []).length} {t('ordersTotalItems')} ·{' '}
                      <FmtNum n={Number(o.totalAmount ?? 0)} /> SR
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => loadForEdit(o)} disabled={!pending}>
                        {t('ordersStaffEdit')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-noorix-accent-red"
                        disabled={!pending || cancelMut.isPending}
                        onClick={() => {
                          if (!window.confirm(t('ordersStaffCancelConfirm', o.orderNumber))) return;
                          cancelMut.mutate(o.id, {
                            onSuccess: () => {
                              showToast(t('ordersStaffCancelled'), 'success');
                              refetch();
                            },
                            onError: (e: any) => showToast(e?.message || t('deleteFailed'), 'error'),
                          });
                        }}
                      >
                        {t('ordersStaffCancel')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'form' && (
            <div className="flex flex-col gap-3 max-w-2xl mx-auto w-full min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-noorix-muted mb-0.5">{t('ordersStaffOrderDate')}</label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e: any) => setOrderDate(e.target.value)}
                    className="w-full h-10 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-noorix-muted mb-0.5">{t('ordersStaffNotes')}</label>
                  <textarea
                    className="w-full min-h-[2.5rem] max-h-20 rounded-lg border border-noorix-border bg-noorix-bg px-2.5 py-1.5 text-[14px] leading-snug resize-y"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={1}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/25 px-2.5 py-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-noorix-muted mb-1">{t('ordersStaffAddFromCatalog')}</div>
                    {productsForSearch.length === 0 ? (
                      <p className="text-[12px] text-noorix-muted m-0">{t('ordersStaffNoProductsHint')}</p>
                    ) : (
                      <ProductSearchInput
                        key={pickerKey}
                        products={productsForSearch}
                        compact
                        onSelectProduct={(p) => {
                          setLines((prev) => [
                            ...prev,
                            {
                              key: newLineKey(),
                              mode: 'product',
                              productId: p.productId,
                              labelHint:
                                lang === 'ar'
                                  ? productsForSearch.find((x: any) => x.id === p.productId)?.nameAr
                                  : productsForSearch.find((x: any) => x.id === p.productId)?.nameEn ||
                                    productsForSearch.find((x: any) => x.id === p.productId)?.nameAr,
                              size: p.size,
                              packaging: p.packaging,
                              unit: p.unit,
                              quantity: '1',
                              unitPrice: p.unitPrice || '0',
                            },
                          ]);
                          setPickerKey((k) => k + 1);
                        }}
                        placeholder={t('ordersSearchProducts')}
                      />
                    )}
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="shrink-0 h-9 border border-dashed border-noorix-border" onClick={addCustomLine}>
                    + {t('ordersStaffAddCustomLine')}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-noorix-border overflow-hidden bg-noorix-bg">
                <div className="flex items-center justify-between px-2 py-1.5 bg-noorix-bg-muted/80 border-b border-noorix-border">
                  <span className="text-[11px] font-bold text-noorix-muted uppercase tracking-wide">{t('ordersStaffLinesTable')}</span>
                  <span className="text-[11px] text-noorix-muted nx-font-numbers">{lines.length}</span>
                </div>
                {lines.length === 0 ? (
                  <div className="text-center text-noorix-muted text-[12px] py-6 px-2">{t('ordersSelectProductAndAdd')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px] border-collapse min-w-[300px]">
                      <thead>
                        <tr className="border-b border-noorix-border bg-noorix-bg-muted/50 text-[10px] font-semibold text-noorix-muted uppercase tracking-wide">
                          <th className="w-8 p-1.5 text-center" aria-hidden />
                          <th className="p-1.5 text-start font-semibold">{t('product')}</th>
                          <th className="w-[4.25rem] sm:w-16 p-1.5 text-center font-semibold">{t('ordersStaffQuantity')}</th>
                          <th className="w-[5.25rem] sm:w-[5.5rem] p-1.5 text-center font-semibold">{t('ordersStaffUnitPrice')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((row) => (
                          <tr key={row.key} className="border-b border-noorix-border last:border-b-0 align-middle">
                            <td className="p-1 text-center align-middle">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-noorix-accent-red hover:bg-red-500/10 text-[18px] leading-none font-light"
                                onClick={() => removeLine(row.key)}
                                aria-label={t('ordersStaffDeleteLineAria')}
                              >
                                ×
                              </button>
                            </td>
                            <td className="p-1.5 pe-2 align-middle min-w-0">
                              {row.mode === 'product' ? (
                                <div className="min-w-0">
                                  <div className="font-semibold text-[13px] leading-snug line-clamp-2 break-words">{row.labelHint || '—'}</div>
                                  {[row.size, row.packaging, row.unit].filter(Boolean).length > 0 && (
                                    <div className="text-[10px] text-noorix-muted leading-tight mt-0.5 line-clamp-1">
                                      {[row.size, row.packaging, row.unit].filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 min-w-0">
                                  <Input
                                    placeholder={t('ordersStaffCustomNameAr')}
                                    value={row.customLabelAr || ''}
                                    onChange={(e: any) => updateLine(row.key, { customLabelAr: e.target.value })}
                                    className="h-9 text-[14px] py-1 px-2 w-full min-w-0"
                                  />
                                  <Input
                                    placeholder={t('ordersStaffCustomNameEn')}
                                    value={row.customLabelEn || ''}
                                    onChange={(e: any) => updateLine(row.key, { customLabelEn: e.target.value })}
                                    className="h-8 text-[12px] py-1 px-2 w-full min-w-0"
                                  />
                                </div>
                              )}
                            </td>
                            <td className="p-1 align-middle">
                              <Input
                                inputMode="decimal"
                                value={row.quantity}
                                onChange={(e: any) => updateLine(row.key, { quantity: e.target.value })}
                                className="h-9 text-[14px] py-1 px-1 text-center w-full min-w-0"
                              />
                            </td>
                            <td className="p-1 align-middle">
                              <Input
                                inputMode="decimal"
                                value={row.unitPrice}
                                onChange={(e: any) => updateLine(row.key, { unitPrice: e.target.value })}
                                className="h-9 text-[14px] py-1 px-1 text-center w-full min-w-0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-2.5 bg-[var(--noorix-bg)]/95 border-t border-noorix-border backdrop-blur-sm flex gap-2 z-20 max-w-2xl mx-auto pb-[max(0.625rem,env(safe-area-inset-bottom,0px))]">
                {editingId && (
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 h-11" onClick={resetForm}>
                    {t('cancel')}
                  </Button>
                )}
                <Button type="button" variant="primary" size="sm" className="flex-1 h-11 text-[15px] font-semibold" disabled={busy} onClick={handleSave}>
                  {busy ? t('saving') : editingId ? t('ordersStaffUpdateDraft') : t('ordersStaffSaveDraft')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}
