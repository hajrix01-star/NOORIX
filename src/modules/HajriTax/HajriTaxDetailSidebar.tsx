import React from 'react';
import { Button, Checkbox, FmtNum, Input } from '../../ui';
import { fmtTax } from '../../utils/format';
import type {
  HajriTaxLanguage,
  HajriTaxTranslate,
  VatPlanningSourceSnapshot,
} from '../../types/api/domains/hajriTax';

type HajriTaxDetailSidebarProps = {
  t: HajriTaxTranslate;
  lang: HajriTaxLanguage;
  readOnly: boolean;
  outputTotal: number;
  inputTotal: number;
  netPayableDraft: number;
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
  simulatorInvalidTarget: boolean;
  paymentTargetParsed: number | null;
  savePending: boolean;
  handleSaveDetail: () => void | Promise<void>;
};

export default function HajriTaxDetailSidebar({
  t,
  readOnly,
  outputTotal,
  inputTotal,
  netPayableDraft,
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
  simulatorInvalidTarget,
  paymentTargetParsed,
  savePending,
  handleSaveDetail,
}: HajriTaxDetailSidebarProps) {
  const dueNet = netPayableDraft >= 0;

  return (
    <aside className="mt-6 space-y-4 xl:sticky xl:top-2 xl:mt-0 xl:w-[320px] xl:shrink-0">
      <div>
        <h3 className="mb-2 text-[14px] font-bold text-noorix-text">{t('vatSidebarSummary')}</h3>
        <div className="space-y-3">
          <div className="rounded-xl border border-noorix-blue/25 bg-[var(--noorix-blue-6)] px-4 py-3">
            <div className="text-[12px] text-noorix-muted">{t('vatTotalOutputVat')}</div>
            <div className="nx-font-numbers text-[18px] font-bold text-noorix-blue">
              {fmtTax(outputTotal)} <span className="nx-sar text-[13px]">SR</span>
            </div>
          </div>
          <div className="rounded-xl border border-noorix-green/25 bg-[var(--noorix-green-6)] px-4 py-3">
            <div className="text-[12px] text-noorix-muted">{t('vatTotalInputVat')}</div>
            <div className="nx-font-numbers text-[18px] font-bold text-noorix-green">
              {fmtTax(inputTotal)} <span className="nx-sar text-[13px]">SR</span>
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
              <FmtNum n={netPayableDraft} tax /> <span className="nx-sar text-[15px]">SR</span>
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
              <Checkbox
                className="h-4 w-4 rounded border-noorix-border"
                checked={showSimulator}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowSimulator(e.target.checked)}
              />
              {t('vatSimulatorToggle')}
            </label>
          ) : null}
        </div>
        {showSimulator ? (
          <div className="space-y-3">
            <p className="m-0 text-[11px] leading-snug text-noorix-muted">{t('vatSimulatorHelpShort')}</p>
            <Input
              type="text"
              inputMode="decimal"
              readOnly={readOnly}
              label={t('vatSimulatorHint')}
              value={paymentTargetStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentTargetStr(e.target.value)}
              placeholder=" "
            />
            {Number.isFinite(paymentTargetParsed) ? (
              simulatorInvalidTarget ? (
                <p className="m-0 text-[12px] font-medium text-amber-800 dark:text-amber-200">{t('vatSimulatorInvalidTarget')}</p>
              ) : (
                <div className="space-y-2 text-[12px] leading-relaxed text-noorix-muted">
                  {simulatorRequiredInputVat != null ? (
                    <p className="m-0">
                      {t('vatSimulatorExplainInputVat', {
                        inputVat: fmtTax(simulatorRequiredInputVat),
                        target: fmtTax(paymentTargetParsed),
                      })}
                    </p>
                  ) : null}
                  {simulatorEstimatedBaseAt15 != null ? (
                    <p className="m-0">
                      {t('vatSimulatorExplainBase', { base: fmtTax(simulatorEstimatedBaseAt15) })}
                    </p>
                  ) : null}
                </div>
              )
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
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
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
  );
}
