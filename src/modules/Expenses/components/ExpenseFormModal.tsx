/**
 * ExpenseFormModal ظ¤ ┘┘à┘ê╪░╪ش ╪ز╪│╪ش┘è┘ ┘à╪╡╪▒┘ê┘ (╪ح╪╡╪»╪د╪▒ ┘╪د╪ز┘ê╪▒╪ر)
 * ╪د┘╪ز╪▒╪د╪╢┘è╪د┘ï: ╪«╪▓┘╪ر ┘ê╪د╪ص╪»╪ر ┘┘┘à╪ذ┘╪║ ┘â╪د┘à┘╪د┘ï. ╪د╪«╪ز┘è╪د╪▒┘è: ╪ح╪╢╪د┘╪ر ╪«╪▓┘╪ر ╪س╪د┘┘è╪ر ╪ذ┘à╪ذ┘╪║ ┘à╪ص╪»╪» (╪د┘╪ذ╪د┘é┘è ┘à┘ ╪د┘╪ث┘ê┘┘ë).
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useToast } from '../../../context/ToastContext';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import { createInvoice, getExpenseLines, uploadInvoiceAttachment } from '../../../services/api';
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

export default function ExpenseFormModal({ companyId, onClose, onSaved }: any) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
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
  /** ╪ح╪╣┘╪د╪ة ╪╢╪▒┘è╪ذ┘è ╪د╪│╪ز╪س┘╪د╪خ┘è ┘┘ç╪░┘ç ╪د┘╪»┘╪╣╪ر ┘┘é╪╖ */
  const [exemptThisPayment, setExemptThisPayment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<any>(null);
  const receiptInputRef = useRef<any>(null);

  const { data: expenseLines = [] } = useQuery({
    queryKey: ['expense-lines', companyId],
    queryFn: async () => {
      const res = await getExpenseLines(companyId);
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
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
          rejectIfApiFailed(up);
        } catch (e: any) {
          uploadErr = e?.message || t('invoiceReceiptUploadFailed');
        }
      }
      if (receiptInputRef.current) receiptInputRef.current.value = '';
      setReceiptFile(null);
      if (uploadErr) showToast(uploadErr, 'error');
      onSaved?.();
    },
    onError: (err: any) => setError(err?.message || '╪ص╪»╪س ╪«╪╖╪ث'),
  });

  const vaultOptions = useMemo(
    () => activeVaults.map((v: any) => ({ id: v.id, label: v.nameAr || v.nameEn || v.id })),
    [activeVaults],
  );

  const handleSubmit = (e: any) => {
    e.preventDefault();
    setError('');
    if (!form.expenseLineId) {
      setError('╪د╪«╪ز╪▒ ╪ذ┘╪» ╪د┘┘à╪╡╪▒┘ê┘');
      return;
    }
    if (!form.totalAmount || Number(form.totalAmount) <= 0) {
      setError('╪د┘┘à╪ذ┘╪║ ┘è╪ش╪ذ ╪ث┘ ┘è┘â┘ê┘ ╪ث┘â╪ذ╪▒ ┘à┘ ╪╡┘╪▒');
      return;
    }
    if (!selectedLine) {
      setError('╪ذ┘╪» ╪د┘┘à╪╡╪▒┘ê┘ ╪║┘è╪▒ ╪╡╪د┘╪ص');
      return;
    }

    if (isTaxable && !form.supplierInvoiceNumber?.trim()) {
      setError('╪▒┘é┘à ┘╪د╪ز┘ê╪▒╪ر ╪د┘┘à┘ê╪▒╪» ┘à╪╖┘┘ê╪ذ ┘┘┘┘ê╪د╪ز┘è╪▒ ╪د┘╪«╪د╪╢╪╣╪ر ┘┘╪╢╪▒┘è╪ذ╪ر');
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
        {createMutation.isPending ? t('saving') : '╪ص┘╪╕ ┘ê╪ح╪╡╪»╪د╪▒ ╪د┘┘╪د╪ز┘ê╪▒╪ر'}
      </Button>
    </>
  );

  return (
    <AdaptiveSheet open={true} onClose={onClose} title="╪ز╪│╪ش┘è┘ ┘à╪╡╪▒┘ê┘" size="md" side="start" className="expense-form-drawer" footer={footer}>
      <form id="expense-form-modal" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {error}
          </div>
        )}

        <Input
          type="select"
          label="╪ذ┘╪» ╪د┘┘à╪╡╪▒┘ê┘ *"
          value={form.expenseLineId}
          onChange={(e: any) => setForm((p: any) => ({ ...p, expenseLineId: e.target.value }))}
          required
        >
          <option value="">ظ¤ ╪د╪«╪ز╪▒ ╪د┘╪ذ┘╪» ظ¤</option>
          {expenseLines.map((l: any) => (
            <option key={l.id} value={l.id}>
              {l.nameAr || l.nameEn} ({l.kind === 'fixed_expense' ? '╪س╪د╪ذ╪ز' : '┘à╪ز╪║┘è╪▒'})
            </option>
          ))}
        </Input>

        <Input
          type="text"
          label={
            lang === 'en'
              ? `Supplier invoice #${isTaxable ? ' *' : ' (optional)'}`
              : `╪▒┘é┘à ┘╪د╪ز┘ê╪▒╪ر ╪د┘┘à┘ê╪▒╪» ${isTaxable ? '*' : '(╪د╪«╪ز┘è╪د╪▒┘è)'}`
          }
          value={form.supplierInvoiceNumber}
          onChange={(e: any) => setForm((p: any) => ({ ...p, supplierInvoiceNumber: e.target.value }))}
          placeholder="╪د┘╪▒┘é┘à ╪د┘┘à┘ê╪ش┘ê╪» ╪╣┘┘ë ┘╪د╪ز┘ê╪▒╪ر ╪د┘┘à┘ê╪▒╪» (┘à╪س╪د┘: INV-2024-001)"
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
          label={lang === 'en' ? 'Amount (VAT-inclusive) *' : '╪د┘┘à╪ذ┘╪║ (╪┤╪د┘à┘ ╪د┘╪╢╪▒┘è╪ذ╪ر) *'}
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
            <Input
              type="select"
              label={t('expenseCoverageModeLabel')}
              value={form.coverageMode}
              onChange={(e: any) => setForm((p: any) => ({ ...p, coverageMode: e.target.value }))}
            >
              <option value="quarter">{t('expenseCoverageModeQuarter')}</option>
              <option value="month_range">{t('expenseCoverageModeMonths')}</option>
            </Input>
            {form.coverageMode === 'quarter' ? (
              <Input
                type="select"
                label={t('expenseCoverageQuarter')}
                value={String(form.expenseCoverageQuarter)}
                onChange={(e: any) => setForm((p: any) => ({ ...p, expenseCoverageQuarter: Number(e.target.value) }))}
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
                  onChange={(e: any) => setForm((p: any) => ({ ...p, expenseCoverageMonthStart: Number(e.target.value) }))}
                >
                  {Array.from({ length: 12 }, (_: any, i: any) => i + 1).map((m: any) => (
                    <option key={m} value={String(m)}>{m}</option>
                  ))}
                </Input>
                <Input
                  type="select"
                  label={t('expenseCoverageMonthsCount')}
                  value={String(form.expenseMonthsCovered)}
                  onChange={(e: any) => setForm((p: any) => ({ ...p, expenseMonthsCovered: Number(e.target.value) }))}
                >
                  {Array.from({ length: 12 }, (_: any, i: any) => i + 1).map((m: any) => (
                    <option key={m} value={String(m)}>{m}</option>
                  ))}
                </Input>
              </>
            )}
          </div>
        )}

        <Input
          type="date"
          label="╪ز╪د╪▒┘è╪« ╪د┘╪╣┘à┘┘è╪ر *"
          value={form.transactionDate}
          onChange={(e: any) => setForm((p: any) => ({ ...p, transactionDate: e.target.value }))}
          required
        />

        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceVaultColumn')} *</div>
          <Input
            type="select"
            label={t('selectVault')}
            value={form.primaryVaultId}
            onChange={(e: any) => setForm((p: any) => ({ ...p, primaryVaultId: e.target.value }))}
            required
          >
            <option value="">ظ¤ {t('selectVault')} ظ¤</option>
            {vaultOptions.map((v: any) => (
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
                onChange={(e: any) => setSecondVaultId(e.target.value)}
              >
                <option value="">ظ¤ {t('selectVault')} ظ¤</option>
                {vaultOptions.map((v: any) => (
                  <option key={v.id} value={v.id} disabled={v.id === form.primaryVaultId}>{v.label}</option>
                ))}
              </Input>
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
          label="┘à┘╪د╪ص╪╕╪د╪ز (┘┘╪«╪»┘à╪ر ┘ê╪▒┘é┘à┘ç╪د)"
          value={form.notes}
          onChange={(e: any) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
          placeholder="┘à╪س╪د┘: ┘â┘ç╪▒╪ذ╪د╪ة - ╪╣╪»╪د╪» 12345 - 1,200 SR"
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
