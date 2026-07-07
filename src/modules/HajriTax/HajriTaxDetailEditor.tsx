/**
 * شكل إدخال الإقرار الضريبي التخطيطي — عمود رئيسي + شريط جانبي (ملخص + محاكي سداد)
 */
import React, { useState, useEffect } from 'react';
import {
  OUTPUT_ROWS,
  INPUT_ROWS,
  roundMoney2,
  type TaxDisclosureField,
  type TaxDisclosureRowKey,
} from '../../constants/taxDisclosure';
import { Button, Checkbox, Input, FmtNum } from '../../ui';
import HajriTaxDetailSidebar from './HajriTaxDetailSidebar';
import HajriTaxDisclosureRows from './HajriTaxDisclosureRows';
import type {
  HajriTaxTranslate,
  HajriTaxLanguage,
  VatPlanningSourceSnapshot,
} from '../../types/api/domains/hajriTax';

type SummaryInlineEdit = {
  id: string;
  text: string;
};

type HajriTaxDetailEditorProps = {
  t: HajriTaxTranslate;
  lang: HajriTaxLanguage;
  periodLabel: string;
  companyName: string;
  taxNumber: string;
  closeDetail: () => void;
  handleImportFromTaxReport: () => void | Promise<void>;
  importingReport: boolean;
  handleSaveDetail: () => void | Promise<void>;
  savePending: boolean;
  printDetail: () => void;
  exportDetailExcel: () => void;
  saveHint: string;
  outputTotal: number;
  inputTotal: number;
  netPayableDraft: number;
  netVat: number;
  priorAdj: number;
  balanceCarried: number;
  paymentTargetStr: string;
  setPaymentTargetStr: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  sourceSnapshot: VatPlanningSourceSnapshot | null;
  showSimulator: boolean;
  setShowSimulator: (value: boolean) => void;
  handleBalancePayment: () => void;
  simulatorRequiredInputVat: number | null;
  simulatorEstimatedBaseAt15: number | null;
  simulatorInvalidTarget?: boolean;
  paymentTargetParsed: number | null;
  renderEditableCell: (key: TaxDisclosureRowKey, field: TaxDisclosureField) => React.ReactNode;
  updateRow: (key: TaxDisclosureRowKey, field: TaxDisclosureField | null, value: string) => void;
  salesAmountIncludesVat: boolean;
  setSalesAmountIncludesVat: (value: boolean) => void;
  readOnly?: boolean;
  onSwitchToEdit: () => void;
  filingSubmitted?: boolean;
  onApproveFiling: () => void | Promise<void>;
  onReopenFiling: () => void | Promise<void>;
  filingActionPending?: boolean;
};

export default function HajriTaxDetailEditor({
  t,
  lang,
  periodLabel,
  companyName,
  taxNumber,
  closeDetail,
  handleImportFromTaxReport,
  importingReport,
  handleSaveDetail,
  savePending,
  printDetail,
  exportDetailExcel,
  saveHint,
  outputTotal,
  inputTotal,
  netPayableDraft,
  netVat,
  priorAdj,
  balanceCarried,
  paymentTargetStr,
  setPaymentTargetStr,
  notes,
  setNotes,
  sourceSnapshot,
  showSimulator,
  setShowSimulator,
  handleBalancePayment,
  simulatorRequiredInputVat,
  simulatorEstimatedBaseAt15,
  simulatorInvalidTarget = false,
  paymentTargetParsed,
  renderEditableCell,
  updateRow,
  salesAmountIncludesVat,
  setSalesAmountIncludesVat,
  readOnly = false,
  onSwitchToEdit,
  filingSubmitted = false,
  onApproveFiling,
  onReopenFiling,
  filingActionPending = false,
}: HajriTaxDetailEditorProps) {
  /** نفس منطق الجدول: كتابة حتى blur ثم تقريب */
  const [summaryInline, setSummaryInline] = useState<SummaryInlineEdit | null>(null);

  useEffect(() => {
    setSummaryInline(null);
  }, [readOnly]);

  const formatSummaryCommitted = (v: unknown) => {
    if (v === '' || v === null || v === undefined) return '';
    const x = Number(v);
    if (!Number.isFinite(x)) return '';
    if (Math.abs(roundMoney2(x)) < 0.0005) return '';
    return roundMoney2(x).toFixed(2);
  };

  return (
    <div className="space-y-5">
      {filingSubmitted ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50/90 px-4 py-3 text-[13px] text-emerald-950 dark:border-emerald-600/50 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('hajriTaxFilingApprovedBanner')}</span>
            {onReopenFiling ? (
              <Button
                type="button"
                variant="warning"
                size="sm"
                className="shrink-0"
                loading={filingActionPending}
                disabled={filingActionPending}
                onClick={onReopenFiling}
              >
                {t('hajriTaxReopenFiling')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {readOnly ? (
        <div className="rounded-lg border border-noorix-blue/30 bg-[var(--noorix-blue-6)] px-4 py-3 text-[13px] text-noorix-text">
          {t('hajriTaxViewModeBanner')}
        </div>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="m-0 text-[17px] font-bold text-noorix-text">{companyName}</h2>
          <p className="mt-1 text-[13px] text-noorix-muted">
            {taxNumber ? `${taxNumber} · ` : ''}
            {t('vatDeclarationPeriodLabel', { period: periodLabel })}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
          {!readOnly ? (
            <label className="flex max-w-xl cursor-pointer items-start gap-2 rounded-lg border border-noorix-border bg-[var(--noorix-blue-6)] px-3 py-2 text-[12px] leading-snug text-noorix-text">
              <Checkbox
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-noorix-border"
                checked={salesAmountIncludesVat}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSalesAmountIncludesVat(e.target.checked)}
              />
              <span>
                <span className="font-semibold">{t('taxImportSalesInclusiveLabel')}</span>
                <span className="block text-[11px] text-noorix-muted mt-0.5">{t('taxImportSalesInclusiveHint')}</span>
              </span>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeDetail}>
            {t('vatBackToList')}
          </Button>
          {readOnly && onSwitchToEdit ? (
            <Button type="button" variant="primary" size="sm" onClick={onSwitchToEdit}>
              {t('hajriTaxActionEdit')}
            </Button>
          ) : null}
          {!readOnly && !filingSubmitted && onApproveFiling ? (
            <Button
              type="button"
              variant="success"
              size="sm"
              loading={filingActionPending}
              disabled={filingActionPending}
              onClick={onApproveFiling}
            >
              {t('hajriTaxApproveFiling')}
            </Button>
          ) : null}
          {!readOnly ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={importingReport}
                onClick={handleImportFromTaxReport}
              >
                {t('vatFetchFromAccounting')}
              </Button>
              <Button type="button" size="sm" disabled={savePending} onClick={handleSaveDetail}>
                {t('save')}
              </Button>
            </>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={printDetail}>
            {t('print')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={exportDetailExcel}>
            {t('exportExcel')}
          </Button>
          </div>
        </div>
      </div>

      {saveHint ? <div className="text-[13px] font-medium text-noorix-green">{saveHint}</div> : null}

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-6">
        <div className="min-w-0 space-y-6">
          <section className="noorix-surface-card overflow-hidden p-0 shadow-sm">
            <div className="flex items-center gap-2 border-b border-noorix-border bg-[var(--noorix-blue-6)] px-4 py-3">
              <span className="text-[15px] font-bold text-noorix-blue">{t('vatSectionOutputTitle')}</span>
            </div>
            <p className="m-0 border-b border-noorix-border bg-[var(--noorix-blue-6)] px-4 pb-3 text-[11px] leading-snug text-noorix-muted">
              {t('vatHajriSalesAuto15Hint')}
            </p>
            <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_88px] gap-2 border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-4 py-2 text-[11px] font-bold text-white sm:grid">
              <div>{t('reportItem')}</div>
              <div className="text-end">{t('vatColumnBase')}</div>
              <div className="text-end">{t('vatColumnVat')}</div>
              <div className="text-center">{t('vatColumnAdjustment')}</div>
            </div>
            <HajriTaxDisclosureRows
              rows={OUTPUT_ROWS}
              sectionTotal={outputTotal}
              lang={lang}
              t={t}
              renderEditableCell={renderEditableCell}
            />
          </section>

          <section className="noorix-surface-card overflow-hidden p-0 shadow-sm">
            <div className="flex items-center gap-2 border-b border-noorix-border bg-[var(--noorix-green-6)] px-4 py-3">
              <span className="text-[15px] font-bold text-noorix-green">{t('vatSectionInputTitle')}</span>
            </div>
            <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_88px] gap-2 border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-4 py-2 text-[11px] font-bold text-white sm:grid">
              <div>{t('reportItem')}</div>
              <div className="text-end">{t('vatColumnBase')}</div>
              <div className="text-end">{t('vatColumnRecoverable')}</div>
              <div className="text-center">{t('vatColumnAdjustment')}</div>
            </div>
            <HajriTaxDisclosureRows
              rows={INPUT_ROWS}
              sectionTotal={inputTotal}
              lang={lang}
              t={t}
              renderEditableCell={renderEditableCell}
              totalVatLabelKey="vatColumnRecoverable"
            />
          </section>

          <section className="noorix-surface-card p-4">
            <h3 className="m-0 mb-3 text-[14px] font-bold text-noorix-text">{t('vatAdjustmentsFooter')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                type="text"
                inputMode="decimal"
                readOnly={readOnly}
                label={lang === 'ar' ? 'تصحيحات من فترة سابقة' : 'Prior period adjustments'}
                value={
                  summaryInline?.id === 'prior_adjustments'
                    ? summaryInline.text
                    : formatSummaryCommitted(priorAdj)
                }
                onFocus={() => {
                  if (readOnly) return;
                  setSummaryInline({
                    id: 'prior_adjustments',
                    text: formatSummaryCommitted(priorAdj),
                  });
                }}
                onBlur={() => {
                  setSummaryInline((cur) => {
                    if (cur?.id !== 'prior_adjustments') return cur;
                    updateRow('prior_adjustments', null, cur.text);
                    return null;
                  });
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (readOnly) return;
                  setSummaryInline({ id: 'prior_adjustments', text: e.target.value });
                }}
                placeholder=" "
              />
              <Input
                type="text"
                inputMode="decimal"
                readOnly={readOnly}
                label={lang === 'ar' ? 'رصيد مرحّل' : 'Balance carried forward'}
                value={
                  summaryInline?.id === 'balance_carried'
                    ? summaryInline.text
                    : formatSummaryCommitted(balanceCarried)
                }
                onFocus={() => {
                  if (readOnly) return;
                  setSummaryInline({
                    id: 'balance_carried',
                    text: formatSummaryCommitted(balanceCarried),
                  });
                }}
                onBlur={() => {
                  setSummaryInline((cur) => {
                    if (cur?.id !== 'balance_carried') return cur;
                    updateRow('balance_carried', null, cur.text);
                    return null;
                  });
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (readOnly) return;
                  setSummaryInline({ id: 'balance_carried', text: e.target.value });
                }}
                placeholder=" "
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-noorix-border pt-3">
              <span className="text-[13px] font-semibold text-noorix-text">{t('vatNetVatLine')}</span>
              <span className="nx-font-numbers text-[15px] font-bold">
                <FmtNum n={netVat} tax /> <span className="nx-sar">SR</span>
              </span>
            </div>
          </section>
        </div>

        <HajriTaxDetailSidebar
          t={t}
          lang={lang}
          readOnly={readOnly}
          outputTotal={outputTotal}
          inputTotal={inputTotal}
          netPayableDraft={netPayableDraft}
          paymentTargetStr={paymentTargetStr}
          setPaymentTargetStr={setPaymentTargetStr}
          notes={notes}
          setNotes={setNotes}
          sourceSnapshot={sourceSnapshot}
          showSimulator={showSimulator}
          setShowSimulator={setShowSimulator}
          handleBalancePayment={handleBalancePayment}
          simulatorRequiredInputVat={simulatorRequiredInputVat}
          simulatorEstimatedBaseAt15={simulatorEstimatedBaseAt15}
          simulatorInvalidTarget={simulatorInvalidTarget}
          paymentTargetParsed={paymentTargetParsed}
          savePending={savePending}
          handleSaveDetail={handleSaveDetail}
        />
      </div>
    </div>
  );
}
