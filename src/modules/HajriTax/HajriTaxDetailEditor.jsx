/**
 * شكل إدخال الإقرار الضريبي التخطيطي — عمود رئيسي + شريط جانبي (ملخص + محاكي سداد)
 */
import React from 'react';
import { OUTPUT_ROWS, INPUT_ROWS } from '../../constants/taxDisclosure';
import { fmt } from '../../utils/format';
import { Button, Input, FmtNum } from '../../ui';

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
  paymentTargetParsed,
  renderEditableCell,
  updateRow,
  salesAmountIncludesVat,
  setSalesAmountIncludesVat,
  readOnly = false,
  onSwitchToEdit,
}) {
  const dueNet = netPayableDraft >= 0;

  const renderSectionRows = (rows, sectionTotal, totalVatLabelKey = 'vatColumnVat') =>
    rows.map((r) => {
      const label = lang === 'ar' ? r.labelAr : r.labelEn;
      if (r.isTotal) {
        return (
          <div
            key={r.key}
            className="flex flex-col gap-1 border-b border-noorix-border bg-[var(--noorix-navy-4)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-bold text-[13px] text-noorix-text">{label}</span>
            <div className="flex flex-wrap items-baseline gap-2 sm:gap-6">
              <span className="text-[11px] text-noorix-muted">{t(totalVatLabelKey)}</span>
              <span className="nx-font-numbers text-[16px] font-bold">
                {fmt(sectionTotal)} <span className="nx-sar text-[13px]">SR</span>
              </span>
            </div>
          </div>
        );
      }
      return (
        <div
          key={r.key}
          className="grid grid-cols-1 items-center gap-2 border-b border-noorix-border px-4 py-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_88px]"
        >
          <div className="min-w-0 text-[13px] leading-snug text-noorix-text">{label}</div>
          <div className="min-w-0">{renderEditableCell(r.key, 'amount')}</div>
          <div className="min-w-0">{renderEditableCell(r.key, 'vat')}</div>
          <div className="min-w-0">{renderEditableCell(r.key, 'adjustment')}</div>
        </div>
      );
    });

  return (
    <div className="space-y-5">
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
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-noorix-border"
                checked={salesAmountIncludesVat}
                onChange={(e) => setSalesAmountIncludesVat(e.target.checked)}
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
            <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_88px] gap-2 border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-4 py-2 text-[11px] font-bold text-noorix-muted sm:grid">
              <div>{t('reportItem')}</div>
              <div className="text-end">{t('vatColumnBase')}</div>
              <div className="text-end">{t('vatColumnVat')}</div>
              <div className="text-center">{t('vatColumnAdjustment')}</div>
            </div>
            {renderSectionRows(OUTPUT_ROWS, outputTotal)}
          </section>

          <section className="noorix-surface-card overflow-hidden p-0 shadow-sm">
            <div className="flex items-center gap-2 border-b border-noorix-border bg-[var(--noorix-green-6)] px-4 py-3">
              <span className="text-[15px] font-bold text-noorix-green">{t('vatSectionInputTitle')}</span>
            </div>
            <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_88px] gap-2 border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-4 py-2 text-[11px] font-bold text-noorix-muted sm:grid">
              <div>{t('reportItem')}</div>
              <div className="text-end">{t('vatColumnBase')}</div>
              <div className="text-end">{t('vatColumnRecoverable')}</div>
              <div className="text-center">{t('vatColumnAdjustment')}</div>
            </div>
            {renderSectionRows(INPUT_ROWS, inputTotal, 'vatColumnRecoverable')}
          </section>

          <section className="noorix-surface-card p-4">
            <h3 className="m-0 mb-3 text-[14px] font-bold text-noorix-text">{t('vatAdjustmentsFooter')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                type="text"
                inputMode="decimal"
                readOnly={readOnly}
                label={lang === 'ar' ? 'تصحيحات من فترة سابقة' : 'Prior period adjustments'}
                value={priorAdj || ''}
                onChange={(e) => updateRow('prior_adjustments', null, e.target.value)}
                placeholder="0"
              />
              <Input
                type="text"
                inputMode="decimal"
                readOnly={readOnly}
                label={lang === 'ar' ? 'رصيد مرحّل' : 'Balance carried forward'}
                value={balanceCarried || ''}
                onChange={(e) => updateRow('balance_carried', null, e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-noorix-border pt-3">
              <span className="text-[13px] font-semibold text-noorix-text">{t('vatNetVatLine')}</span>
              <span className="nx-font-numbers text-[15px] font-bold">
                <FmtNum n={netVat} /> <span className="nx-sar">SR</span>
              </span>
            </div>
          </section>
        </div>

        <aside className="mt-6 space-y-4 xl:sticky xl:top-2 xl:mt-0 xl:w-[320px] xl:shrink-0">
          <div>
            <h3 className="mb-2 text-[14px] font-bold text-noorix-text">{t('vatSidebarSummary')}</h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-noorix-blue/25 bg-[var(--noorix-blue-6)] px-4 py-3">
                <div className="text-[12px] text-noorix-muted">{t('vatTotalOutputVat')}</div>
                <div className="nx-font-numbers text-[18px] font-bold text-noorix-blue">
                  {fmt(outputTotal)} <span className="nx-sar text-[13px]">SR</span>
                </div>
              </div>
              <div className="rounded-xl border border-noorix-green/25 bg-[var(--noorix-green-6)] px-4 py-3">
                <div className="text-[12px] text-noorix-muted">{t('vatTotalInputVat')}</div>
                <div className="nx-font-numbers text-[18px] font-bold text-noorix-green">
                  {fmt(inputTotal)} <span className="nx-sar text-[13px]">SR</span>
                </div>
              </div>
              <div
                className={`rounded-xl border px-4 py-4 ${
                  dueNet
                    ? 'border-[var(--noorix-accent-red)]/35 bg-[var(--noorix-red-6)]'
                    : 'border-[var(--noorix-accent-green)]/35 bg-[var(--noorix-green-6)]'
                }`}
              >
                <div className="text-[12px] font-medium text-noorix-muted">{t('vatNetVatPeriod')}</div>
                <div
                  className={`mt-1 nx-font-numbers text-[22px] font-extrabold ${dueNet ? 'text-[var(--noorix-accent-red)]' : 'text-[var(--noorix-accent-green)]'}`}
                >
                  <FmtNum n={netPayableDraft} /> <span className="nx-sar text-[15px]">SR</span>
                </div>
                <p className="mt-2 mb-0 text-[11px] text-noorix-muted">
                  {dueNet ? t('vatAmountDueAuthority') : t('vatAmountRefundable')}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border-2 border-amber-400/50 bg-[var(--noorix-surface)] p-4 shadow-sm ${readOnly ? 'opacity-80' : ''}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-noorix-text">{t('vatSimulatorTitle')}</span>
              {!readOnly ? (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-noorix-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-noorix-border"
                    checked={showSimulator}
                    onChange={(e) => setShowSimulator(e.target.checked)}
                  />
                  {t('vatSimulatorToggle')}
                </label>
              ) : null}
            </div>
            {showSimulator ? (
              <div className="space-y-3">
                <Input
                  type="text"
                  inputMode="decimal"
                  readOnly={readOnly}
                  label={t('vatSimulatorHint')}
                  value={paymentTargetStr}
                  onChange={(e) => setPaymentTargetStr(e.target.value)}
                  placeholder="0"
                />
                {Number.isFinite(paymentTargetParsed) ? (
                  <div className="space-y-2 text-[12px] leading-relaxed text-noorix-muted">
                    {simulatorRequiredInputVat != null ? (
                      <p className="m-0">
                        {t('vatSimulatorExplainInputVat', {
                          inputVat: fmt(simulatorRequiredInputVat),
                          target: fmt(paymentTargetParsed),
                        })}
                      </p>
                    ) : null}
                    {simulatorEstimatedBaseAt15 != null ? (
                      <p className="m-0">
                        {t('vatSimulatorExplainBase', { base: fmt(simulatorEstimatedBaseAt15) })}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="m-0 text-[12px] text-noorix-muted">{t('vatSimulatorEnterTarget')}</p>
                )}
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="warning"
                    size="sm"
                    className="w-full"
                    onClick={handleBalancePayment}
                  >
                    {t('vatSimulatorAutoFill')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2 text-[11px] leading-snug text-noorix-muted">
            {t('vatPlanningDisclaimer')}
          </div>

          <Input
            multiline
            rows={3}
            readOnly={readOnly}
            label={t('vatNotes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {!readOnly ? (
            <Button
              type="button"
              variant="success"
              size="lg"
              className="w-full"
              disabled={savePending}
              onClick={handleSaveDetail}
            >
              {t('vatSaveDeclaration')}
            </Button>
          ) : null}

          {sourceSnapshot ? (
            <details className="rounded-lg border border-noorix-border bg-noorix-surface p-3 text-[12px]">
              <summary className="cursor-pointer font-bold">{t('vatReferenceSnapshot')}</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px]">
                {JSON.stringify(sourceSnapshot, null, 2)}
              </pre>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
