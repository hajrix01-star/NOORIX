/**
 * Record an expense payment (creates an invoice). Single vault for full amount;
 * optional second vault with split amounts.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { createInvoice, getExpenseLines, throwIfApiFailed, uploadInvoiceAttachment } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { expenseKeys } from '../../../services/queryKeys';
import { getSaudiToday } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { splitTaxFromTotalAsNumbers } from '@noorix/finance-core';
import { vatRateDecimalFromCompany } from '../../../utils/vatRate';
import { useApp } from '../../../context/AppContext';
import { Button, AdaptiveSheet, Input } from '../../../ui';
import { SearchableOptionsPicker } from '../../../components/common/SearchableOptionsPicker';
import {
  canExemptThisExpensePayment,
  isExpensePaymentTaxable,
  supplierAppliesVat,
} from '../utils/expenseTax';
import { vaultDisplayName } from '../../../utils/vaultDisplay';

export default function ExpenseFormModal({ companyId, onClose, onSaved }: any) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { companies } = useApp();
  const vatRateDecimal = useMemo(
    () => vatRateDecimalFromCompany(companies.find((c: any) => c.id === companyId)),
    [companies, companyId],
  );
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
  /** Optional VAT exemption for this payment only */
  const [exemptThisPayment, setExemptThisPayment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<any>(null);
  const receiptInputRef = useRef<any>(null);

  const { data: expenseLines = [] } = useApiListQuery<any>({
    queryKey: expenseKeys.lines(companyId),
    queryFn: () => getExpenseLines(companyId),
    fallbackMessage: t('loadingError'),
    enabled: !!companyId,
  });

  const { paymentVaults: activeVaults = [] } = useVaults({ companyId });

  const selectedLine = expenseLines.find((l: any) => l.id === form.expenseLineId);

  const isTaxable = useMemo(
    () => isExpensePaymentTaxable(selectedLine, exemptThisPayment),
    [selectedLine, exemptThisPayment],
  );

  const taxPreview = useMemo(() => {
    const totalNum = parseFloat(String(form.totalAmount).replace(/,/g, ''));
    if (!Number.isFinite(totalNum) || totalNum <= 0) return null;
    return splitTaxFromTotalAsNumbers(totalNum, isTaxable, vatRateDecimal);
  }, [form.totalAmount, isTaxable, vatRateDecimal]);

  const taxStatusKind = useMemo(() => {
    if (!selectedLine) return null;
    if (selectedLine.category?.account?.taxExempt) return 'account_exempt';
    if (!supplierAppliesVat(selectedLine.supplier)) return 'supplier_not_registered';
    return 'default_taxable';
  }, [selectedLine]);

  useEffect(() => {
    setExemptThisPayment(false);
  }, [form.expenseLineId]);

  const lastExpenseLineIdForPrefillRef = useRef<any>(null);
  useEffect(() => {
    if (!form.expenseLineId) {
      lastExpenseLineIdForPrefillRef.current = null;
      return;
    }
    const line = expenseLines.find((l: any) => l.id === form.expenseLineId);
    if (!line) return;
    if (lastExpenseLineIdForPrefillRef.current === form.expenseLineId) return;
    lastExpenseLineIdForPrefillRef.current = form.expenseLineId;
    setForm((p: any) => ({
      ...p,
      totalAmount: line.referenceAmount != null ? String(line.referenceAmount) : '',
    }));
  }, [form.expenseLineId, expenseLines]);

  const lastCoverageLineIdRef = useRef<any>(null);
  useEffect(() => {
    const line = expenseLines.find((l: any) => l.id === form.expenseLineId);
    if (!line || line.kind !== 'fixed_expense') {
      lastCoverageLineIdRef.current = null;
      return;
    }
    const y = form.transactionDate?.slice(0, 4);
    const yearNum = y ? parseInt(y, 10) : parseInt(getSaudiToday().slice(0, 4), 10);
    const lineChanged = lastCoverageLineIdRef.current !== line.id;
    lastCoverageLineIdRef.current = line.id;
    setForm((p: any) => ({
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
    mutationFn: (body: any) => createInvoice(body),
    showErrorToast: false,
    onSuccess: async (result: any) => {
      let uploadErr = null;
      const payload = result?.data;
      const inv = payload?.invoice ?? payload;
      const invId = inv?.id;
      if (receiptFile && invId && companyId) {
        try {
          const up = await uploadInvoiceAttachment(invId, companyId, receiptFile);
          throwIfApiFailed(up);
        } catch (e: any) {
          uploadErr = e?.message || t('invoiceReceiptUploadFailed');
        }
      }
      if (receiptInputRef.current) receiptInputRef.current.value = '';
      setReceiptFile(null);
      if (uploadErr) showToast(uploadErr, 'error');
      onSaved?.();
    },
    onError: (err: any) => setError(err?.message || t('saveFailed')),
  });

  const vaultOptions = useMemo(
    () => activeVaults.map((v: any) => ({ id: v.id, label: vaultDisplayName(v, lang) })),
    [activeVaults, lang],
  );

  const expenseLinePickerOptions = useMemo(
    () =>
      expenseLines.map((l: any) => ({
        value: l.id,
        label: `${l.nameAr || l.nameEn} (${l.kind === 'fixed_expense' ? (lang === 'en' ? 'Fixed' : 'À«» ') : (lang === 'en' ? 'Variable' : '„ €Ì—')})`,
      })),
    [expenseLines, lang],
  );

  const vaultPickerOptions = useMemo(
    () => vaultOptions.map((v: any) => ({ value: v.id, label: v.label })),
    [vaultOptions],
  );

  const coverageModeOptions = useMemo(
    () => [
      { value: 'quarter', label: t('expenseCoverageModeQuarter') },
      { value: 'month_range', label: t('expenseCoverageModeMonths') },
    ],
    [t],
  );

  const quarterOptions = useMemo(
    () =>
      [1, 2, 3, 4].map((q) => ({
        value: String(q),
        label: `Q${q}`,
      })),
    [],
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return { value: String(m), label: String(m) };
      }),
    [],
  );

  const handleSubmit = (e: any) => {
    e.preventDefault();
    setError('');
    if (!form.expenseLineId) {
      setError(lang === 'en' ? 'Select an expense line' : '«Œ — »‰œ «·„’—Ê›');
      return;
    }
    if (!form.totalAmount || Number(form.totalAmount) <= 0) {
      setError(lang === 'en' ? 'Amount must be greater than zero' : '«·„»·€ ÌÃ» √‰ ÌﬂÊ‰ √ﬂ»— „‰ ’›—');
      return;
    }
    if (!selectedLine) {
      setError(lang === 'en' ? 'Expense line is invalid' : '»‰œ «·„’—Ê› €Ì— ’«·Õ');
      return;
    }

    if (isTaxable && !form.supplierInvoiceNumber?.trim()) {
      setError(
        lang === 'en'
          ? 'Supplier invoice number is required for taxable payments'
          : '—ﬁ„ ›« Ê—… «·„Ê—œ „ÿ·Ê» ··›Ê« Ì— «·Œ«÷⁄… ··÷—Ì»…',
      );
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

    const basePayload: {
      companyId: any;
      expenseLineId: string;
      categoryId: any;
      supplierId: any;
      supplierInvoiceNumber: string;
      kind: any;
      totalAmount: number;
      isTaxable: boolean;
      transactionDate: string;
      notes: string | undefined;
      warrantyFollowUp?: boolean;
      expenseCoverageYear?: number;
      expenseCoverageQuarter?: number;
      expenseCoverageMonthStart?: number;
      expenseMonthsCovered?: number;
    } = {
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
        {createMutation.isPending ? t('saving') : lang === 'en' ? 'Save and issue invoice' : 'Õ›Ÿ Ê≈’œ«— «·›« Ê—…'}
      </Button>
    </>
  );

  return (
    <AdaptiveSheet open={true} onClose={onClose} title={lang === 'en' ? 'Record expense' : ' ”ÃÌ· „’—Ê›'} size="md" side="start" className="expense-form-drawer" footer={footer}>
      <form id="expense-form-modal" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {error}
          </div>
        )}

        <SearchableOptionsPicker
          label={lang === 'en' ? 'Expense line *' : '»‰œ «·„’—Ê› *'}
          allowEmpty
          emptyValue=""
          emptyLabel={lang === 'en' ? 'ó Select line ó' : 'ó «Œ — «·»‰œ ó'}
          value={form.expenseLineId}
          onChange={(v) => setForm((p: any) => ({ ...p, expenseLineId: v }))}
          options={expenseLinePickerOptions}
          aria-label={lang === 'en' ? 'Expense line' : '»‰œ «·„’—Ê›'}
        />

        <Input
          type="text"
          label={
            lang === 'en'
              ? `Supplier invoice #${isTaxable ? ' *' : ' (optional)'}`
              : `—ﬁ„ ›« Ê—… «·„Ê—œ ${isTaxable ? '*' : '(«Œ Ì«—Ì)'}`
          }
          value={form.supplierInvoiceNumber}
          onChange={(e: any) => setForm((p: any) => ({ ...p, supplierInvoiceNumber: e.target.value }))}
          placeholder={lang === 'en' ? 'As on supplier invoice (e.g. INV-2024-001)' : '«·—ﬁ„ «·„ÊÃÊœ ⁄·Ï ›« Ê—… «·„Ê—œ („À«·: INV-2024-001)'}
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
              onChange={(e: any) => setExemptThisPayment(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
            />
            <span className="text-[13px] font-semibold text-noorix-text leading-snug">{t('expenseTaxExemptThisPayment')}</span>
          </label>
        )}

        <Input
          type="number"
          label={lang === 'en' ? 'Amount (VAT-inclusive) *' : '«·„»·€ (‘«„· «·÷—Ì»…) *'}
          step="0.01"
          min="0.01"
          value={form.totalAmount}
          onChange={(e: any) => setForm((p: any) => ({ ...p, totalAmount: e.target.value }))}
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
              onChange={(e: any) => setForm((p: any) => ({ ...p, expenseCoverageYear: Number(e.target.value) }))}
              className="ltr"
              required
            />
            <SearchableOptionsPicker
              label={t('expenseCoverageModeLabel')}
              value={form.coverageMode}
              onChange={(v) => setForm((p: any) => ({ ...p, coverageMode: v }))}
              options={coverageModeOptions}
              aria-label={t('expenseCoverageModeLabel')}
            />
            {form.coverageMode === 'quarter' ? (
              <SearchableOptionsPicker
                label={t('expenseCoverageQuarter')}
                value={String(form.expenseCoverageQuarter)}
                onChange={(v) => setForm((p: any) => ({ ...p, expenseCoverageQuarter: Number(v) }))}
                options={quarterOptions}
                aria-label={t('expenseCoverageQuarter')}
              />
            ) : (
              <>
                <SearchableOptionsPicker
                  label={t('expenseCoverageMonthStart')}
                  value={String(form.expenseCoverageMonthStart)}
                  onChange={(v) => setForm((p: any) => ({ ...p, expenseCoverageMonthStart: Number(v) }))}
                  options={monthOptions}
                  aria-label={t('expenseCoverageMonthStart')}
                />
                <SearchableOptionsPicker
                  label={t('expenseCoverageMonthsCount')}
                  value={String(form.expenseMonthsCovered)}
                  onChange={(v) => setForm((p: any) => ({ ...p, expenseMonthsCovered: Number(v) }))}
                  options={monthOptions}
                  aria-label={t('expenseCoverageMonthsCount')}
                />
              </>
            )}
          </div>
        )}

        <Input
          type="date"
          label={lang === 'en' ? 'Transaction date *' : ' «—ÌŒ «·⁄„·Ì… *'}
          value={form.transactionDate}
          onChange={(e: any) => setForm((p: any) => ({ ...p, transactionDate: e.target.value }))}
          required
        />

        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceVaultColumn')} *</div>
          <SearchableOptionsPicker
            label={t('selectVault')}
            allowEmpty
            emptyValue=""
            emptyLabel={`ó ${t('selectVault')} ó`}
            value={form.primaryVaultId}
            onChange={(v) => setForm((p: any) => ({ ...p, primaryVaultId: v }))}
            options={vaultPickerOptions}
            aria-label={t('selectVault')}
          />

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
              <SearchableOptionsPicker
                label={t('secondVaultSelectLabel')}
                allowEmpty
                emptyValue=""
                emptyLabel={`ó ${t('selectVault')} ó`}
                value={secondVaultId}
                onChange={(v) => setSecondVaultId(v)}
                options={vaultPickerOptions}
                getOptionDisabled={(opt) => opt.value === form.primaryVaultId}
                aria-label={t('secondVaultSelectLabel')}
              />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                label={t('secondVaultAmountLabel')}
                value={secondAmount}
                onChange={(e: any) => setSecondAmount(e.target.value)}
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
          label={lang === 'en' ? 'Notes (for your reference)' : '„·«ÕŸ«  (··„—Ã⁄ «·œ«Œ·Ì)'}
          value={form.notes}
          onChange={(e: any) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
          placeholder={lang === 'en' ? 'e.g. electricity ó meter 12345 ó 1,200 SR' : '„À«·: ﬂÂ—»«¡ ó ⁄œ«œ 12345 ó 1,200 SR'}
          rows={3}
        />

        <div className="rounded-xl border border-noorix-border bg-noorix-surface px-3 py-2.5 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceReceiptAttachment')}</div>
          <p className="text-[11px] text-noorix-muted m-0">{t('invoiceReceiptAttachmentHint')}</p>
          <input
            ref={receiptInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
            className="text-[13px] max-w-full"
            onChange={(e: any) => setReceiptFile(e.target.files?.[0] || null)}
          />
          {receiptFile ? (
            <span className="text-[11px] text-noorix-muted truncate" title={receiptFile.name}>{receiptFile.name}</span>
          ) : null}
        </div>

        <label className="flex items-start gap-2.5 min-h-[44px] cursor-pointer rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={!!form.warrantyFollowUp}
            onChange={(e: any) => setForm((p: any) => ({ ...p, warrantyFollowUp: e.target.checked }))}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
          />
          <span className="text-[13px] font-semibold text-noorix-text leading-snug">{t('warrantyFollowUpStack')}</span>
        </label>
      </form>
    </AdaptiveSheet>
  );
}
