/**
 * أجزاء مشتركة لصف إدخال دفعة المشتريات — مصدر واحد للجدول والبطاقة
 */
import React from 'react';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { Input, Button } from '../../../ui';

/** زر اختصار المورد — مضغوط (جدول) أو لمس (بطاقة) */
export function BatchSupplierBookmarkButton({
  row, bookmarkedIds, onBookmark, t, size = 'compact',
}) {
  if (!row.supplierId) return null;
  const isOn = bookmarkedIds.includes(row.supplierId);
  const title = isOn ? t('removeFromShortcuts') : t('addToShortcuts');
  if (size === 'touch') {
    return (
      <Button
        type="button"
        size="sm"
        onClick={() => onBookmark(row.supplierId)}
        title={title}
        className="min-h-[40px] min-w-[40px]"
        style={{
          background: isOn ? 'var(--noorix-yellow-15)' : 'var(--noorix-bg-page)',
        }}
        aria-pressed={isOn}
      >
        {isOn ? '★' : '☆'}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      onClick={() => onBookmark(row.supplierId)}
      title={title}
      className="text-[14px] w-8 h-8 min-w-8 min-h-8 rounded-md shrink-0"
      style={{
        background: isOn ? 'var(--noorix-yellow-15)' : 'var(--noorix-bg-page)',
      }}
      aria-pressed={isOn}
    >
      {isOn ? '★' : '☆'}
    </Button>
  );
}

/** محتوى اختيار المورد + اختصار — يُلفّ بـ td أو ببطاقة */
export function BatchSupplierPickInner({
  suppliers,
  row,
  bookmarkedIds,
  onBookmark,
  handleSupplierChange,
  t,
  /** compact = بجانب المورد في الجدول | touch = بطاقة جوال | none = إخفاء (الاختصار في الرأس) */
  bookmarkSize = 'compact',
  supplierInputId,
}: Record<string, any>) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <SupplierSelect
          id={supplierInputId}
          suppliers={suppliers}
          value={row.supplierId}
          onChange={handleSupplierChange}
          bookmarkedIds={bookmarkedIds}
          placeholder={t('selectSupplier')}
        />
      </div>
      {bookmarkSize !== 'none' && (
        <BatchSupplierBookmarkButton
          row={row}
          bookmarkedIds={bookmarkedIds}
          onBookmark={onBookmark}
          t={t}
          size={bookmarkSize === 'touch' ? 'touch' : 'compact'}
        />
      )}
    </div>
  );
}

/** عرض صافي / ضريبة للقراءة فقط */
export function BatchNetTaxReadonly({ net, tax, variant = 'table', t }) {
  if (variant === 'stack') {
    return (
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-noorix-bg py-2 px-2.5">
        <div>
          <div className="text-[10px] text-noorix-muted mb-0.5">{t('net')}</div>
          <div className="text-[13px] font-semibold text-noorix-text" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            {net || '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-noorix-muted mb-0.5">{t('tax')}</div>
          <div className="text-[13px] font-semibold text-noorix-amber" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            {tax || '—'}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="text-[11px]" style={{ fontFamily: 'var(--noorix-font-numbers)', lineHeight: 1.5 }}>
      <div className="text-noorix-muted">{net || '—'}</div>
      <div style={{ color: 'var(--noorix-accent-amber)' }}>{tax || '—'}</div>
    </div>
  );
}

/** زر تبديل الضريبة 15% / إعفاء — نصوص من i18n */
export function BatchTaxToggleButton({ row, index, onUpdate, t, density = 'table' }) {
  const active = row.isTaxable !== false;
  const title = active ? t('batchRowTaxToggleTitleOn') : t('batchRowTaxToggleTitleOff');
  const label = active ? t('batchRowTaxIncludeVat') : t('batchRowTaxExemptShort');

  if (density === 'stack') {
    return (
      <div>
        <div className="text-[11px] font-semibold text-noorix-muted mb-1">{t('taxPct')}</div>
        <Button
          type="button"
          variant="raw"
          onClick={() => onUpdate(index, 'isTaxable', active ? false : true)}
          className="w-full min-h-[44px] text-[12px] font-bold"
          title={title}
          aria-pressed={active}
          style={{
            borderRadius: 8,
            border: `1px solid ${!active ? 'var(--noorix-border)' : 'var(--noorix-accent-amber)'}`,
            background: !active ? 'var(--noorix-bg-page)' : 'var(--noorix-amber-8)',
            color: !active ? 'var(--noorix-text-muted)' : 'var(--noorix-accent-amber)',
          }}
        >
          {label}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => onUpdate(index, 'isTaxable', active ? false : true)}
      className="w-full text-[11px] font-bold whitespace-nowrap"
      title={title}
      aria-pressed={active}
      style={{
        padding: '5px 4px',
        borderRadius: 5,
        border: `1px solid ${!active ? 'var(--noorix-border)' : 'var(--noorix-accent-amber)'}`,
        background: !active ? 'var(--noorix-bg-page)' : 'var(--noorix-amber-8)',
        color: !active ? 'var(--noorix-text-muted)' : 'var(--noorix-accent-amber)',
      }}
    >
      {label}
    </Button>
  );
}

/** خيارات نوع السطر — مشتركة بين الجدول والبطاقة */
export function BatchKindOptions({ t }) {
  return (
    <>
      <option value="purchase">{t('purchaseType')}</option>
      <option value="expense">{t('expenseType')}</option>
      <option value="fixed_expense">{t('fixedExpenseType') || 'مصروف ثابت'}</option>
    </>
  );
}
