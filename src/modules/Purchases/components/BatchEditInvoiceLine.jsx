/**
 * سطر واحد في لوحة تعديل الدفعة — جدول أو بطاقة (مصدر واحد للمنطق)
 */
import React from 'react';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { Button, Input, FmtNum, Card, FormRow } from '../../../ui';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { useBatchRowFieldIds } from './useBatchRowLogic';

export function BatchEditInvoiceLine({
  inv,
  i,
  suppliers,
  lang,
  t,
  updateInv,
  variant,
}) {
  const ids = useBatchRowFieldIds();
  const cancelled = inv.status === 'cancelled';

  if (variant === 'card') {
    return (
      <Card
        padding="sm"
        className={`min-w-0 ${cancelled ? 'opacity-60 bg-noorix-bg' : ''}`}
        aria-label={t('batchRowLineAriaLabel', i + 1)}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-[13px] font-bold text-noorix-text">#{i + 1}</span>
          {cancelled ? (
            <span className="text-[12px] font-semibold text-noorix-red">{t('cancelled')}</span>
          ) : (
            <Button
              size="sm"
              variant="danger"
              className="min-h-[40px]"
              onClick={() => updateInv(i, 'status', 'cancelled')}
            >
              {t('cancel')}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor={ids.supplier} className="text-[11px] font-semibold text-noorix-muted mb-1 block">
              {t('supplier')}
            </label>
            {cancelled ? (
              <span className="nx-cell-muted text-[13px]">
                {(lang === 'en' ? inv.supplier?.nameEn || inv.supplier?.nameAr : inv.supplier?.nameAr || inv.supplier?.nameEn) || '—'}
              </span>
            ) : (
              <SupplierSelect
                id={ids.supplier}
                suppliers={suppliers}
                value={inv.supplierId || ''}
                onChange={(v) => updateInv(i, 'supplierId', v)}
                bookmarkedIds={[]}
                placeholder={t('selectSupplierPlaceholder')}
              />
            )}
          </div>

          <FormRow cols={1} gap="sm">
            {cancelled ? (
              <>
                <div>
                  <span className="text-[11px] font-semibold text-noorix-muted mb-1 block">{t('supplierInvoiceNumber')}</span>
                  <span className="nx-cell-muted">{inv.supplierInvoiceNumber || inv.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-noorix-muted mb-1 block">{t('total')}</span>
                  <FmtNum n={inv.totalAmount} className="nx-cell-num" />
                </div>
              </>
            ) : (
              <>
                <Input
                  id={ids.invoiceNumber}
                  label={t('supplierInvoiceNumber')}
                  size="sm"
                  value={inv.supplierInvoiceNumber ?? inv.invoiceNumber ?? ''}
                  onChange={(e) => updateInv(i, 'supplierInvoiceNumber', e.target.value)}
                />
                <Input
                  id={ids.totalInclusive}
                  label={t('total')}
                  type="number"
                  min="0"
                  step="0.1"
                  size="sm"
                  value={inv.totalAmount ?? ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) {
                      const { net, tax } = splitTaxFromTotalAsNumbers(v, true);
                      updateInv(i, { totalAmount: v, netAmount: net, taxAmount: tax });
                    }
                  }}
                  className="nx-font-numbers"
                />
              </>
            )}
          </FormRow>

          {cancelled ? (
            <div>
              <span className="text-[11px] font-semibold text-noorix-muted mb-1 block">{t('kind')}</span>
              <span className="nx-cell-muted-sm">{inv.kind === 'purchase' ? t('purchaseType') : t('expenseType')}</span>
            </div>
          ) : (
            <Input
              id={ids.kind}
              label={t('kind')}
              type="select"
              size="sm"
              value={inv.kind || 'purchase'}
              onChange={(e) => updateInv(i, 'kind', e.target.value)}
            >
              <option value="purchase">{t('purchaseType')}</option>
              <option value="expense">{t('expenseType')}</option>
            </Input>
          )}
        </div>
      </Card>
    );
  }

  /* جدول */
  return (
    <tr
      className={`border-b border-noorix-border ${cancelled ? 'opacity-50 bg-noorix-bg' : ''}`}
    >
      <td className="text-center text-noorix-muted font-semibold p-1.5">{i + 1}</td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="nx-cell-muted">{(lang === 'en' ? inv.supplier?.nameEn || inv.supplier?.nameAr : inv.supplier?.nameAr || inv.supplier?.nameEn) || '—'}</span>
        ) : (
          <SupplierSelect
            suppliers={suppliers}
            value={inv.supplierId || ''}
            onChange={(v) => updateInv(i, 'supplierId', v)}
            bookmarkedIds={[]}
            placeholder={t('selectSupplierPlaceholder')}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="nx-cell-muted">{inv.supplierInvoiceNumber || inv.invoiceNumber}</span>
        ) : (
          <Input
            size="sm"
            value={inv.supplierInvoiceNumber ?? inv.invoiceNumber ?? ''}
            onChange={(e) => updateInv(i, 'supplierInvoiceNumber', e.target.value)}
            className="w-full"
            aria-label={`${t('supplierInvoiceNumber')} — ${t('batchRowLineAriaLabel', i + 1)}`}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <FmtNum n={inv.totalAmount} className="nx-cell-num" />
        ) : (
          <Input
            type="number"
            min="0"
            step="0.1"
            size="sm"
            value={inv.totalAmount ?? ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v) && v > 0) {
                const { net, tax } = splitTaxFromTotalAsNumbers(v, true);
                updateInv(i, { totalAmount: v, netAmount: net, taxAmount: tax });
              }
            }}
            className="w-full nx-font-numbers text-end"
            aria-label={`${t('total')} — ${t('batchRowLineAriaLabel', i + 1)}`}
          />
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="nx-cell-muted-sm">{inv.kind === 'purchase' ? t('purchaseType') : t('expenseType')}</span>
        ) : (
          <Input
            type="select"
            size="sm"
            value={inv.kind || 'purchase'}
            onChange={(e) => updateInv(i, 'kind', e.target.value)}
            className="w-full"
            aria-label={`${t('kind')} — ${t('batchRowLineAriaLabel', i + 1)}`}
          >
            <option value="purchase">{t('purchaseType')}</option>
            <option value="expense">{t('expenseType')}</option>
          </Input>
        )}
      </td>
      <td className="p-1.5">
        {cancelled ? (
          <span className="text-[12px] font-semibold text-noorix-red">{t('cancelled')}</span>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => updateInv(i, 'status', 'cancelled')}
            aria-label={`${t('cancel')} — ${t('batchRowLineAriaLabel', i + 1)}`}
          >
            {t('cancel')}
          </Button>
        )}
      </td>
    </tr>
  );
}
