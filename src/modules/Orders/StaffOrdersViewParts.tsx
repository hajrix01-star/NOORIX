import React, { useMemo } from 'react';
import { fmt } from '../../utils/format';
import { Button, EditableNumberCell, Modal, Input } from '../../ui';
import {
  type StaffBasketLine,
  basketTotal,
  basketLineAmount,
  displayProductPrice,
  formatVariantLabel,
  defaultVariantModalState,
} from './utils/staffOrderBasketUtils';
import type { OrderProduct, OrderProductVariant } from '../../types/api';
import { StaffCancellationReasonButtons } from './StaffOrderPanelModals';
import { STAFF_CANCELLATION_REASON_LABEL_KEYS } from './constants/staffCancellationReasons';

type SelectableOrderProductVariant = OrderProductVariant & { _key: string };

export function resolveItemSection(product: OrderProduct | null | undefined, activeFilter: string): string {
  const secs = product?.sections;
  if (activeFilter && Array.isArray(secs) && secs.includes(activeFilter)) return activeFilter;
  if (Array.isArray(secs) && secs.length === 1) return secs[0];
  if (Array.isArray(secs) && secs.length > 0) return secs[0];
  return activeFilter || 'عام';
}

export function StaffBasketTable({
  basketLines,
  productsById,
  lang,
  t,
  showPrices,
  editingQtyId,
  setEditingQtyId,
  setLineQty,
  removeLine,
  isCancellation = false,
}: {
  basketLines: StaffBasketLine[];
  productsById: Map<string, OrderProduct>;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  showPrices: boolean;
  editingQtyId: string | null;
  setEditingQtyId: (id: string | null) => void;
  setLineQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  isCancellation?: boolean;
}) {
  const quantitySign = isCancellation ? -1 : 1;
  const totalQty = basketLines.reduce((n, l) => n + (l.quantity || 0), 0) * quantitySign;
  const totalAmount = basketTotal(basketLines).times(quantitySign);

  return (
    <table className="w-full text-[12px] border-collapse min-w-[300px] border border-noorix-border rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-noorix-bg-muted border-b border-noorix-border">
          <th className="text-start py-1.5 px-2 font-bold text-[11px] text-noorix-muted">{t('product')}</th>
          <th className="text-center py-1.5 px-1 font-bold text-[11px] text-noorix-muted w-[5.5rem]">{t('quantity')}</th>
          {showPrices ? (
            <>
              <th className="text-end py-1.5 px-2 font-bold text-[11px] text-noorix-muted w-14">{t('unitPrice')}</th>
              <th className="text-end py-1.5 px-2 font-bold text-[11px] text-noorix-muted w-[4.5rem]">{t('staffSaleGrandTotal')}</th>
            </>
          ) : null}
          <th className="w-7 p-0" aria-label={t('delete')} />
        </tr>
      </thead>
      <tbody>
        {basketLines.map((row) => {
          const p = productsById.get(row.productId);
          const name = (p ? (lang === 'en' ? (p.nameEn || p.nameAr) : (p.nameAr || p.nameEn)) : row.productId) || '—';
          const variant = formatVariantLabel(row.size, row.packaging, row.unit);
          const lineAmt = basketLineAmount(row).times(quantitySign);
          const isEditingQty = editingQtyId === row.lineId;
          const quantityStep = ['pack', 'carton'].includes(row.unit) ? 0.25 : 1;
          return (
            <tr key={row.lineId} className="border-b border-noorix-border last:border-b-0">
              <td className="py-1.5 px-2 align-middle text-start max-w-[9rem] sm:max-w-none">
                <div className="font-medium text-noorix-text leading-tight truncate" title={name}>{name}</div>
                {variant ? (
                  <div className="text-[11px] text-noorix-muted ltr truncate" title={variant}>{variant}</div>
                ) : null}
                {row.cancellationReasons?.length ? (
                  <div className="mt-0.5 text-[10px] leading-snug text-noorix-red">
                    {row.cancellationReasons
                      .map((reason) => t(STAFF_CANCELLATION_REASON_LABEL_KEYS[reason]))
                      .join('، ')}
                  </div>
                ) : null}
              </td>
              <td className="py-1.5 px-1 align-middle">
                <div className="inline-flex items-center justify-center gap-0.5 w-full">
                  <Button
                    variant="raw"
                    type="button"
                    onClick={() => setLineQty(row.lineId, row.quantity - quantityStep)}
                    className="w-6 h-6 rounded-md border border-noorix-border text-[14px] leading-none flex items-center justify-center hover:bg-noorix-bg-muted shrink-0"
                  >−</Button>
                  {isEditingQty ? (
                    <EditableNumberCell
                      autoFocus
                      min={quantityStep}
                      step={quantityStep}
                      align="start"
                      className="w-8 h-6 text-center text-[12px] border border-noorix-blue rounded-md bg-noorix-bg focus:outline-none nx-font-numbers"
                      value={row.quantity}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLineQty(row.lineId, Number(e.target.value))}
                      onBlur={() => setEditingQtyId(null)}
                    />
                  ) : (
                    <Button
                      variant="raw"
                      type="button"
                      onClick={() => setEditingQtyId(row.lineId)}
                      className="min-w-[1.25rem] h-6 px-0.5 text-[12px] font-bold text-noorix-blue nx-font-numbers"
                    >{isCancellation ? `-${row.quantity}` : row.quantity}</Button>
                  )}
                  <Button
                    variant="raw"
                    type="button"
                    onClick={() => setLineQty(row.lineId, row.quantity + quantityStep)}
                    className="w-6 h-6 rounded-md border border-noorix-border text-[14px] leading-none flex items-center justify-center hover:bg-noorix-bg-muted shrink-0"
                  >+</Button>
                </div>
              </td>
              {showPrices ? (
                <>
                  <td className="py-1.5 px-2 text-end nx-font-numbers ltr align-middle whitespace-nowrap text-[12px]">
                    {Number(row.unitPrice) > 0 ? (
                      <>{fmt(row.unitPrice)} <span className="nx-sar">SR</span></>
                    ) : (
                      <span className="text-noorix-muted">—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-end nx-font-numbers ltr font-bold text-noorix-green align-middle whitespace-nowrap">
                    {!lineAmt.isZero() ? (
                      <>{fmt(lineAmt.toNumber())} <span className="nx-sar">SR</span></>
                    ) : (
                      <span className="text-noorix-muted">—</span>
                    )}
                  </td>
                </>
              ) : null}
              <td className="py-1.5 px-0.5 text-center align-middle">
                <Button
                  variant="raw"
                  type="button"
                  onClick={() => removeLine(row.lineId)}
                  className="w-6 h-6 text-noorix-red text-[15px] leading-none hover:opacity-70"
                  aria-label={t('delete')}
                >×</Button>
              </td>
            </tr>
          );
        })}
      </tbody>
      {showPrices && !totalAmount.isZero() ? (
        <tfoot>
          <tr className="bg-noorix-bg-muted/60 border-t border-noorix-border">
            <td className="py-2 px-2 text-[11px] font-semibold text-noorix-muted whitespace-nowrap">
              {t('staffSaleTotalQty')}:{' '}
              <span className="text-noorix-blue nx-font-numbers ltr">{fmt(totalQty, 0)}</span>
            </td>
            <td colSpan={3} className="py-2 px-2 text-end text-[12px] whitespace-nowrap">
              <span className="text-noorix-muted">{t('staffSaleGrandTotal')}: </span>
              <span className="font-bold text-noorix-green nx-font-numbers ltr">
                {fmt(totalAmount.toNumber())} <span className="nx-sar">SR</span>
              </span>
            </td>
            <td />
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

// ─── كرت صنف واحد ─────────────────────────────────────────────────────────────
export function ProductCard({
  product, lang, qty, freqCount, onTap, onRemove,
}: {
  product: OrderProduct; lang: string; qty: number; freqCount: number;
  onTap: () => void; onRemove: () => void;
}) {
  const name = lang === 'en' ? (product.nameEn || product.nameAr) : (product.nameAr || product.nameEn);
  const selected = qty > 0;
  const priceLabel = displayProductPrice(product);
  const unitLabel = product.unit === 'pack'
    ? (lang === 'en' ? 'Pack' : 'علبة')
    : product.unit === 'carton'
      ? (lang === 'en' ? 'Carton' : 'كرتون')
    : product.unit;

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
        <Button
          variant="raw"
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 start-1 z-10 w-5 h-5 rounded-full bg-noorix-red text-white text-[11px] flex items-center justify-center shadow leading-none"
        >×</Button>
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
          <div className="text-[11px] text-noorix-muted mt-0.5 capitalize">{unitLabel}</div>
        )}
        {freqCount > 0 && !selected && (
          <div className="text-[11px] text-noorix-blue/70 mt-0.5">×{freqCount}</div>
        )}
      </div>
    </div>
  );
}

export function VariantPickModal({
  variantModal,
  lang,
  t,
  onClose,
  onChange,
  onConfirm,
  isCancellation = false,
}: {
  variantModal: NonNullable<ReturnType<typeof defaultVariantModalState>>;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
  onClose: () => void;
  onChange: (v: ReturnType<typeof defaultVariantModalState>) => void;
  onConfirm: () => void;
  isCancellation?: boolean;
}) {
  const product = variantModal.product;
  const name = lang === 'en' ? (product.nameEn || product.nameAr) : (product.nameAr || product.nameEn);
  const variants = useMemo(() => {
    const raw = Array.isArray(product?.variants) ? product.variants : [];
    return (raw as OrderProductVariant[]).map<SelectableOrderProductVariant>((v, i) => ({
      ...v,
      _key: `${v.size || ''}|${v.packaging || ''}|${v.unit || 'piece'}|${i}`,
    }));
  }, [product]);
  const sizes = useMemo(() => {
    if (!product?.sizes) return [] as string[];
    return String(product.sizes).split(/[,،]/).map((x: string) => x.trim()).filter(Boolean);
  }, [product]);
  const selectedVariant = variants.find((variant) => variant._key === variantModal.variantKey);
  const quantityStep = ['pack', 'carton'].includes(variantModal.unit) ? 0.25 : 1;

  return (
    <Modal open onClose={onClose} title={name} size="sm">
      <div className="flex flex-col gap-4 p-1">
        {variants.length > 0 && (
          <Input
            type="select"
            label={t('ordersProductVariants')}
            value={variantModal.variantKey}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const key = e.target.value;
              const v = variants.find((x) => x._key === key);
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
            {variants.map((v) => (
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
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...variantModal, size: e.target.value })}
          >
            <option value="">—</option>
            {sizes.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </Input>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-noorix-muted">{t('quantity')}</label>
          <div className="flex items-center gap-3 justify-center">
            <Button
              variant="raw"
              type="button"
              onClick={() => onChange({
                ...variantModal,
                quantity: String(Math.max(
                  quantityStep,
                  parseFloat(variantModal.quantity || String(quantityStep)) - quantityStep,
                )),
              })}
              className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
            >−</Button>
            <EditableNumberCell
              min={quantityStep}
              step={quantityStep}
              align="start"
              className="w-16 h-10 text-center text-[18px] font-bold border-2 border-noorix-border rounded-xl bg-noorix-bg focus:outline-none focus:border-noorix-blue"
              value={variantModal.quantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...variantModal, quantity: e.target.value })}
            />
            <Button
              variant="raw"
              type="button"
              onClick={() => onChange({
                ...variantModal,
                quantity: String(parseFloat(variantModal.quantity || '0') + quantityStep),
              })}
              className="w-9 h-9 rounded-full border-2 border-noorix-border text-[20px] flex items-center justify-center hover:border-noorix-blue"
            >+</Button>
          </div>
        </div>
        <Input
          type="number"
          min="0"
          step="0.01"
          label={`${t('unitPrice')} SR`}
          value={variantModal.unitPrice}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...variantModal, unitPrice: e.target.value })}
          placeholder="0"
        />
        {isCancellation ? (
          <StaffCancellationReasonButtons
            reasons={variantModal.cancellationReasons}
            note={variantModal.cancellationNote}
            t={t}
            onReasonsChange={(cancellationReasons) => onChange({ ...variantModal, cancellationReasons })}
            onNoteChange={(cancellationNote) => onChange({ ...variantModal, cancellationNote })}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onClose}>{t('cancel')}</Button>
          <Button
            variant={isCancellation ? 'danger' : 'success'}
            size="md"
            onClick={onConfirm}
            disabled={isCancellation && (
              variantModal.cancellationReasons.length === 0
              || (variantModal.cancellationReasons.includes('other') && !variantModal.cancellationNote.trim())
            )}
          >
            {t(isCancellation ? 'staffCancellationAddItem' : 'staffOrderAddItem')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── الشاشة الرئيسية ───────────────────────────────────────────────────────────


