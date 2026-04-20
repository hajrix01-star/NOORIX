/**
 * ExpenseFormModal — نموذج تسجيل مصروف (إصدار فاتورة)
 * افتراضياً: خزنة واحدة للمبلغ كاملاً. اختياري: إضافة خزنة ثانية بمبلغ محدد (الباقي من الأولى).
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import { createInvoice, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { getSaudiToday } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { splitTaxFromTotalAsNumbers } from '../../../utils/math-engine';
import { Button, AdaptiveSheet, Input } from '../../../ui';
import {
  canExemptThisExpensePayment,
  isExpensePaymentTaxable,
  supplierAppliesVat,
} from '../utils/expenseTax';

export default function ExpenseFormModal({ companyId, onClose, onSaved }) {
  const { t, lang } = useTranslation();
  const defaultYear = useMemo(() => parseInt(getSaudiToday().slice(0, 4), 10), []);
  const [form, setForm] = useState({
    expenseLineId: '',
    totalAmount: '',
    transactionDate: getSaudiToday(),
    primaryVaultId: '',
    supplierInvoiceNumber: '',
    notes: '',
    warrantyFollowUp: false,
    coverageMode: 'quarter',
    expenseCoverageYear: defaultYear,
    expenseCoverageQuarter: 1,
    expenseCoverageMonthStart: 1,
    expenseMonthsCovered: 3,
  });
  const [secondVaultEnabled, setSecondVaultEnabled] = useState(false);
  const [secondVaultId, setSecondVaultId] = useState('');
  const [secondAmount, setSecondAmount] = useState('');
  const [error, setError] = useState('');
  /** إعفاء ضريبي استثنائي لهذه الدفعة فقط */
  const [exemptThisPayment, setExemptThisPayment] = useState(false);

  const { data: expenseLines = [] } = useQuery({
    queryKey: ['expense-lines', companyId],
    queryFn: async () => {
      const res = await getExpenseLines(companyId);
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!companyId,
  });

  const { paymentVaults: activeVaults = [] } = useVaults({ companyId });

  const selectedLine = expenseLines.find((l) => l.id === form.expenseLineId);

  const isTaxable = useMemo(
    () => isExpensePaymentTaxable(selectedLine, exemptThisPayment),
    [selectedLine, exemptThisPayment],
  );

  const taxPreview = useMemo(() => {
    const totalNum = parseFloat(String(form.totalAmount).replace(/,/g, ''));
    if (!Number.isFinite(totalNum) || totalNum <= 0) return null;
    return splitTaxFromTotalAsNumbers(totalNum, isTaxable);
  }, [form.totalAmount, isTaxable]);

  const taxStatusKind = useMemo(() => {
    if (!selectedLine) return null;
    if (selectedLine.category?.account?.taxExempt) return 'account_exempt';
    if (!supplierAppliesVat(selectedLine.supplier)) return 'supplier_not_registered';
    return 'default_taxable';
  }, [selectedLine]);

  useEffect(() => {
    setExemptThisPayment(false);
  }, [form.expenseLineId]);

  const lastExpenseLineIdForPrefillRef = useRef(null);
  useEffect(() => {
    if (!form.expenseLineId) {
      lastExpenseLineIdForPrefillRef.current = null;
      return;
    }
    const line = expenseLines.find((l) => l.id === form.expenseLineId);
    if (!line) return;
    if (lastExpenseLineIdForPrefillRef.current === form.expenseLineId) return;
    lastExpenseLineIdForPrefillRef.current = form.expenseLineId;
    setForm((p) => ({
      ...p,
      totalAmount: line.referenceAmount != null ? String(line.referenceAmount) : '',
    }));
  }, [form.expenseLineId, expenseLines]);

  const lastCoverageLineIdRef = useRef(null);
  useEffect(() => {
    const line = expenseLines.find((l) => l.id === form.expenseLineId);
    if (!line || line.kind !== 'fixed_expense') {
      lastCoverageLineIdRef.current = null;
      return;
    }
    const y = form.transactionDate?.slice(0, 4);
    const yearNum = y ? parseInt(y, 10) : parseInt(getSaudiToday().slice(0, 4), 10);
    const lineChanged = lastCoverageLineIdRef.current !== line.id;
    lastCoverageLineIdRef.current = line.id;
    setForm((p) => ({
      ...p,
      expenseCoverageYear: yearNum,
      ...(lineChanged ? { expenseMonthsCovered: line.installmentIntervalMonths ?? 3 } : {}),
    }));
  }, [form.expenseLineId, form.transactionDate, expenseLines]);

  const amountLocked = Boolean(
    selectedLine &&
      selectedLine.referenceAmount != null &&
      selectedLine.allowPaymentAmountOverride === false,
  );

  const createMutation = useApiMutation({
    mutationFn: (body) => createInvoice(body),
    showErrorToast: false,
    onSuccess: () => onSaved?.(),
    onError: (err) => setError(err?.message || 'حدث خطأ'),
  });

  const vaultOptions = useMemo(
    () => activeVaults.map((v) => ({ id: v.id, label: v.nameAr || v.nameEn || v.id })),
    [activeVaults],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.expenseLineId) {
      setError('اختر بند المصروف');
      return;
    }
    if (!form.totalAmount || Number(form.totalAmount) <= 0) {
      setError('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }
    if (!selectedLine) {
      setError('بند المصروف غير صالح');
      return;
    }

    if (isTaxable && !form.supplierInvoiceNumber?.trim()) {
      setError('رقم فاتورة المورد مطلوب للفواتير الخاضعة للضريبة');
      return;
    }

    if (!form.primaryVaultId?.trim()) {
      setError(t('selectVault'));
      return;
    }

    const total = Number(form.totalAmount);
    if (amountLocked && selectedLine?.referenceAmount != null) {
      const refN = Number(selectedLine.referenceAmount);
      if (Number.isFinite(refN) && Math.abs(total - refN) > 0.009) {
        setError(t('expensePaymentAmountLocked'));
        return;
      }
    }

    if (selectedLine.kind === 'fixed_expense') {
      const y = Number(form.expenseCoverageYear);
      if (!Number.isFinite(y) || y < 2000 || y > 2100) {
        setError(t('expenseCoverageYearInvalid'));
        return;
      }
      if (form.coverageMode === 'month_range') {
        const ms = Number(form.expenseCoverageMonthStart);
        const mc = Number(form.expenseMonthsCovered);
        if (!Number.isFinite(ms) || !Number.isFinite(mc)) {
          setError(t('expenseCoverageRangeInvalid'));
          return;
        }
        if (ms < 1 || ms > 12 || mc < 1 || mc > 12 || ms + mc - 1 > 12) {
          setError(t('expenseCoverageRangeInvalid'));
          return;
        }
      }
    }

    const basePayload = {
      companyId,
      expenseLineId: form.expenseLineId,
      categoryId: selectedLine.categoryId,
      supplierId: selectedLine.supplierId,
      supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
      kind: selectedLine.kind,
      totalAmount: total,
      isTaxable,
      transactionDate: form.transactionDate,
      notes: form.notes?.trim() || undefined,
      ...(form.warrantyFollowUp ? { warrantyFollowUp: true } : {}),
    };

    if (selectedLine.kind === 'fixed_expense') {
      basePayload.expenseCoverageYear = Number(form.expenseCoverageYear);
      if (form.coverageMode === 'quarter') {
        basePayload.expenseCoverageQuarter = Number(form.expenseCoverageQuarter);
      } else {
        basePayload.expenseCoverageMonthStart = Number(form.expenseCoverageMonthStart);
        basePayload.expenseMonthsCovered = Number(form.expenseMonthsCovered);
      }
    }

    if (secondVaultEnabled) {
      const a2 = parseFloat(secondAmount);
      if (!secondVaultId?.trim()) {
        setError(t('selectVault'));
        return;
      }
      if (secondVaultId === form.primaryVaultId) {
        setError(t('invoiceVaultsMustDiffer'));
        return;
      }
      if (Number.isNaN(a2) || a2 <= 0) {
        setError(t('secondVaultAmountInvalid'));
        return;
      }
      if (a2 >= total - 0.01) {
        setError(t('vaultSplitsMustMatchTotal'));
        return;
      }
      const a1 = Math.round((total - a2) * 100) / 100;
      if (a1 <= 0) {
        setError(t('vaultSplitsMustMatchTotal'));
        return;
      }
      createMutation.mutate({
        ...basePayload,
        vaultSplits: [
          { vaultId: form.primaryVaultId.trim(), amount: a1 },
          { vaultId: secondVaultId.trim(), amount: a2 },
        ],
      });
      return;
    }

    createMutation.mutate({
      ...basePayload,
      vaultId: form.primaryVaultId.trim(),
    });
  };

  const footer = (
    <>
      <Button onClick={onClose}>{t('cancel')}</Button>
      <Button variant="primary" type="submit" form="expense-form-modal" disabled={createMutation.isPending}>
        {createMutation.isPending ? t('saving') : 'حفظ وإصدار الفاتورة'}
      </Button>
    </>
  );

  return (
    <AdaptiveSheet open={true} onClose={onClose} title="تسجيل مصروف" size="md" side="start" className="expense-form-drawer" footer={footer}>
      <form id="expense-form-modal" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {error}
          </div>
        )}

        <Input
          type="select"
          label="بند المصروف *"
          value={form.expenseLineId}
          onChange={(e) => setForm((p) => ({ ...p, expenseLineId: e.target.value }))}
          required
        >
          <option value="">— اختر البند —</option>
          {expenseLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nameAr || l.nameEn} ({l.kind === 'fixed_expense' ? 'ثابت' : 'متغير'})
            </option>
          ))}
        </Input>

        <Input
          type="text"
          label={
            lang === 'en'
              ? `Supplier invoice #${isTaxable ? ' *' : ' (optional)'}`
              : `رقم فاتورة المورد ${isTaxable ? '*' : '(اختياري)'}`
          }
          value={form.supplierInvoiceNumber}
          onChange={(e) => setForm((p) => ({ ...p, supplierInvoiceNumber: e.target.value }))}
          placeholder="الرقم الموجود على فاتورة المورد (مثال: INV-2024-001)"
        />

        {selectedLine && taxStatusKind === 'account_exempt' && (
          <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxAccountExemptHint')}</p>
        )}
        {selectedLine && taxStatusKind === 'supplier_not_registered' && (
          <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxSupplierNotRegisteredHint')}</p>
        )}
        {selectedLine && taxStatusKind === 'default_taxable' && (
          <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxDefaultFromSupplierHint')}</p>
        )}

        {selectedLine && canExemptThisExpensePayment(selectedLine) && (
          <label className="flex items-start gap-2.5 min-h-[44px] cursor-pointer rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2.5">
            <input
              type="checkbox"
              checked={exemptThisPayment}
              onChange={(e) => setExemptThisPayment(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
            />
            <span className="text-[13px] font-semibold text-noorix-text leading-snug">{t('expenseTaxExemptThisPayment')}</span>
          </label>
        )}

        <Input
          type="number"
          label={lang === 'en' ? 'Amount (VAT-inclusive) *' : 'المبلغ (شامل الضريبة) *'}
          step="0.01"
          min="0.01"
          value={form.totalAmount}
          onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))}
          placeholder="0.00"
          required
          disabled={amountLocked}
          className="ltr"
        />
        {taxPreview && (
          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2.5 text-[12px] leading-relaxed text-noorix-text">
            <div className="mb-1 font-semibold text-noorix-muted">{t('expenseTaxBreakdownTitle')}</div>
            {isTaxable ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 nx-font-numbers">
                <span>
                  {t('expenseTaxBreakdownNet')}: {fmt(taxPreview.net)} <span className="nx-sar text-[11px]">SR</span>
                </span>
                <span>
                  {t('expenseTaxBreakdownVat')}: {fmt(taxPreview.tax)} <span className="nx-sar text-[11px]">SR</span>
                </span>
              </div>
            ) : (
              <span>{t('expenseTaxBreakdownNoVat')}</span>
            )}
          </div>
        )}
        {selectedLine?.referenceAmount != null && selectedLine.allowPaymentAmountOverride !== false && !amountLocked && (
          <p className="text-[11px] text-noorix-muted -mt-2">{t('expensePaymentPrefilledFromLine')}</p>
        )}
        {amountLocked && (
          <p className="text-[11px] text-noorix-muted -mt-2">{t('expensePaymentAmountLocked')}</p>
        )}

        {selectedLine?.kind === 'fixed_expense' && (
          <div className="rounded-xl border border-noorix-border bg-noorix-surface p-3 flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-noorix-text">{t('expenseCoverageSection')}</div>
            <p className="text-[11px] text-noorix-muted m-0">{t('expenseCoverageHint')}</p>
            <Input
              type="number"
              label={t('expenseCoverageYear')}
              min={2000}
              max={2100}
              step={1}
              value={form.expenseCoverageYear}
              onChange={(e) => setForm((p) => ({ ...p, expenseCoverageYear: Number(e.target.value) }))}
              className="ltr"
              required
            />
            <Input
              type="select"
              label={t('expenseCoverageModeLabel')}
              value={form.coverageMode}
              onChange={(e) => setForm((p) => ({ ...p, coverageMode: e.target.value }))}
            >
              <option value="quarter">{t('expenseCoverageModeQuarter')}</option>
              <option value="month_range">{t('expenseCoverageModeMonths')}</option>
            </Input>
            {form.coverageMode === 'quarter' ? (
              <Input
                type="select"
                label={t('expenseCoverageQuarter')}
                value={String(form.expenseCoverageQuarter)}
                onChange={(e) => setForm((p) => ({ ...p, expenseCoverageQuarter: Number(e.target.value) }))}
              >
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </Input>
            ) : (
              <>
                <Input
                  type="select"
                  label={t('expenseCoverageMonthStart')}
                  value={String(form.expenseCoverageMonthStart)}
                  onChange={(e) => setForm((p) => ({ ...p, expenseCoverageMonthStart: Number(e.target.value) }))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>{m}</option>
                  ))}
                </Input>
                <Input
                  type="select"
                  label={t('expenseCoverageMonthsCount')}
                  value={String(form.expenseMonthsCovered)}
                  onChange={(e) => setForm((p) => ({ ...p, expenseMonthsCovered: Number(e.target.value) }))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>{m}</option>
                  ))}
                </Input>
              </>
            )}
          </div>
        )}

        <Input
          type="date"
          label="تاريخ العملية *"
          value={form.transactionDate}
          onChange={(e) => setForm((p) => ({ ...p, transactionDate: e.target.value }))}
          required
        />

        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceVaultColumn')} *</div>
          <Input
            type="select"
            label={t('selectVault')}
            value={form.primaryVaultId}
            onChange={(e) => setForm((p) => ({ ...p, primaryVaultId: e.target.value }))}
            required
          >
            <option value="">— {t('selectVault')} —</option>
            {vaultOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </Input>

          {!secondVaultEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => {
                setSecondVaultEnabled(true);
                setError('');
              }}
            >
              {t('addSecondVaultBtn')}
            </Button>
          ) : (
            <>
              <div className="text-[11px] text-noorix-muted">{t('secondVaultHint')}</div>
              <Input
                type="select"
                label={t('secondVaultSelectLabel')}
                value={secondVaultId}
                onChange={(e) => setSecondVaultId(e.target.value)}
              >
                <option value="">— {t('selectVault')} —</option>
                {vaultOptions.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id === form.primaryVaultId}>{v.label}</option>
                ))}
              </Input>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                label={t('secondVaultAmountLabel')}
                value={secondAmount}
                onChange={(e) => setSecondAmount(e.target.value)}
                className="ltr"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() => {
                  setSecondVaultEnabled(false);
                  setSecondVaultId('');
                  setSecondAmount('');
                  setError('');
                }}
              >
                {t('removeSecondVaultBtn')}
              </Button>
            </>
          )}
        </div>

        <Input
          multiline
          label="ملاحظات (للخدمة ورقمها)"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="مثال: كهرباء - عداد 12345 - 1,200 SR"
          rows={3}
        />

        <label className="flex items-start gap-2.5 min-h-[44px] cursor-pointer rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={!!form.warrantyFollowUp}
            onChange={(e) => setForm((p) => ({ ...p, warrantyFollowUp: e.target.checked }))}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
          />
          <span className="text-[13px] font-semibold text-noorix-text leading-snug">{t('warrantyFollowUpStack')}</span>
        </label>
      </form>
    </AdaptiveSheet>
  );
}
