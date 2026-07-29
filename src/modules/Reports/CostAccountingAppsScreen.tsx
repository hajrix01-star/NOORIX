/**
 * حاسبة تكاليف / تطبيقات — معزولة عن دفتر الحسابات؛ استيراد مبيعات من الملخصات اليومية فقط.
 */
import type { ChangeEvent } from 'react';
import { fmt } from '../../utils/format';
import { Button, Checkbox, InlineSelect, Input, cn } from '../../ui';
import Card from '../../ui/Card';
import { type CostAppsCommissionBase } from './costAccountingAppsModel';
import { Field, SectionHeading } from './costAccountingApps/CostAccountingAppsUiParts';
import { parseMoneyInput } from './costAccountingApps/costAccountingAppsScreenUtils';
import { CostAccountingAppsFixedLinesPanel } from './costAccountingApps/CostAccountingAppsFixedLinesPanel';
import {
  CostAccountingAppsColumnHeading,
  CostAccountingAppsNoCompany,
  CostAccountingAppsPageHeader,
  CostAccountingAppsPrintStyles,
  CostAccountingAppsResultsColumn,
} from './costAccountingApps/CostAccountingAppsLayoutParts';
import { CostAccountingAppsSavedSlotsPanel } from './costAccountingApps/CostAccountingAppsSavedSlotsPanel';
import { CostAccountingAppsSyncPanel } from './costAccountingApps/CostAccountingAppsSyncPanel';
import { useCostAccountingAppsScreen } from './costAccountingApps/useCostAccountingAppsScreen';

export default function CostAccountingAppsScreen() {
  const {
    activeCompanyId,
    t,
    lang,
    fileRef,
    companyName,
    grossAppStr,
    setGrossAppStr,
    grossCashStr,
    setGrossCashStr,
    grossBankStr,
    setGrossBankStr,
    vatInclusive,
    setVatInclusive,
    vatRatePctStr,
    setVatRatePctStr,
    commissionPctStr,
    setCommissionPctStr,
    commissionBase,
    setCommissionBase,
    fixedLines,
    setFixedLines,
    setImportFrom,
    setImportTo,
    importing,
    importingExpenses,
    salaryStr,
    setSalaryStr,
    targetProfitStr,
    setTargetProfitStr,
    reverseGrossStr,
    appSharePctStr,
    setAppSharePctStr,
    cogsLocalPctStr,
    setCogsLocalPctStr,
    appPriceMarkupPctStr,
    setAppPriceMarkupPctStr,
    reverseAppSharePctStr,
    setReverseAppSharePctStr,
    probeSalesGrossStr,
    setProbeSalesGrossStr,
    probePlPreview,
    savedSlots,
    previewSlot,
    setPreviewSlot,
    withAppsScenarioLabel,
    grossInputsSum,
    expensesMonthlyTotal,
    expensesAnnualTotal,
    plWith,
    plWithout,
    appSalesRowLabel,
    importMonthOptions,
    importMonthSelectValue,
    fmt2,
    handleImportSystem,
    handleImportExpensesFromSystem,
    handleCsvPick,
    handleReverse,
    handleProbeProfit,
    handleApplyProbeToFields,
    handleApplyReverse,
    handleApplyAppShare,
    handlePrint,
    printPreviewModal,
    handleExportExcel,
    clearDraft,
    handleSaveCalculatorSlot,
    handleImportSavedSlot,
    handleDeleteSavedSlot,
  } = useCostAccountingAppsScreen();

  const inputValue = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => setter(event.target.value);

  if (!activeCompanyId) {
    return <CostAccountingAppsNoCompany t={t} />;
  }

  return (
    <div className="cost-apps-calc mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5 print:max-w-none print:gap-2">
      {printPreviewModal}
      <CostAccountingAppsPageHeader t={t} companyName={companyName} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-5 print:grid-cols-1 print:gap-3">
        {/* عمود المدخلات والاستيراد */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-5 print:order-1">
          <CostAccountingAppsColumnHeading label={t('reportCostAppsColumnInputs')} tone="blue" />

          <Card
            variant="surface"
            padding="none"
            className="overflow-hidden border border-noorix-border shadow-sm print:break-inside-avoid print:shadow-none"
          >
            <div className="border-b border-noorix-border bg-gradient-to-br from-noorix-blue/[0.07] via-[var(--noorix-surface-2)] to-[var(--noorix-surface-2)] px-4 py-3.5 sm:px-5">
              <h2 className="m-0 text-base font-bold tracking-tight text-noorix-text sm:text-[17px]">{t('reportCostAppsInputsPanelTitle')}</h2>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
          {/* —— المبيعات —— */}
          <div className="space-y-3">
            <SectionHeading tone="blue">{t('reportCostAppsZoneSales')}</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
              <Field
                labelAlign="center"
                label={
                  <>
                    {t('reportCostAppsGrossApp')}
                    {grossInputsSum.gt(0) ? (
                      <span dir="ltr" className="ms-1 inline tabular-nums">
                        {fmt(plWith.appShareOfGrossPct.toNumber(), 2)}%
                      </span>
                    ) : null}
                  </>
                }
              >
                <Input
                  value={grossAppStr}
                  onChange={inputValue(setGrossAppStr)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-full text-center text-sm font-medium tabular-nums"
                />
              </Field>
              <Field labelAlign="center" label={t('reportCostAppsGrossCash')}>
                <Input
                  value={grossCashStr}
                  onChange={inputValue(setGrossCashStr)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-full text-center text-sm font-medium tabular-nums"
                />
              </Field>
              <Field labelAlign="center" label={t('reportCostAppsGrossBank')}>
                <Input
                  value={grossBankStr}
                  onChange={inputValue(setGrossBankStr)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-full text-center text-sm font-medium tabular-nums"
                />
              </Field>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-noorix-border bg-[var(--noorix-surface-2)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[12px] font-bold text-noorix-text">{t('reportCostAppsSalesInputsTotal')}</span>
              <span dir="ltr" className="text-base font-bold tabular-nums text-noorix-blue sm:text-lg">
                {fmt2(grossInputsSum)}
              </span>
            </div>
          </div>

          <CostAccountingAppsSyncPanel
            t={t}
            fileRef={fileRef}
            importMonthOptions={importMonthOptions}
            importMonthSelectValue={importMonthSelectValue}
            importing={importing}
            onImportSystem={handleImportSystem}
            onCsvPick={handleCsvPick}
            setImportFrom={setImportFrom}
            setImportTo={setImportTo}
          />

          {/* —— ضريبة / عمولة / COGS —— */}
          <div className="space-y-3 border-t border-noorix-border pt-5">
            <SectionHeading tone="amber">{t('reportCostAppsZoneRates')}</SectionHeading>
            <Checkbox
              label={t('reportCostAppsVatInclusive')}
              checked={vatInclusive}
              onChange={(e) => setVatInclusive(e.target.checked)}
              containerClassName="flex cursor-pointer items-center gap-2.5 rounded-lg border border-noorix-border/90 bg-[var(--noorix-surface-1)] px-3 py-2 text-[13px] print:border-0 print:bg-transparent print:px-0 print:py-1"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Field labelAlign="center" label={t('reportCostAppsVatRate')}>
                <Input value={vatRatePctStr} onChange={inputValue(setVatRatePctStr)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-center tabular-nums" />
              </Field>
              <Field labelAlign="center" label={t('reportCostAppsCommissionPct')}>
                <Input value={commissionPctStr} onChange={inputValue(setCommissionPctStr)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-center tabular-nums" />
              </Field>
              <Field labelAlign="center" label={t('reportCostAppsCogsLocalPct')} className="max-lg:col-span-2">
                <Input value={cogsLocalPctStr} onChange={inputValue(setCogsLocalPctStr)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-center tabular-nums" />
              </Field>
              <Field labelAlign="center" label={t('reportCostAppsAppMarkupPct')} className="max-lg:col-span-2">
                <Input value={appPriceMarkupPctStr} onChange={inputValue(setAppPriceMarkupPctStr)} inputMode="decimal" dir="ltr" className="min-h-10 w-full text-center tabular-nums" />
              </Field>
            </div>
            <Field labelAlign="center" label={t('reportCostAppsCommissionBase')}>
              <InlineSelect
                className={cn(
                  'min-h-10 w-full max-w-xl rounded-md border border-noorix-border bg-[var(--noorix-surface-1)] px-3 py-2 text-center text-sm font-medium',
                )}
                value={commissionBase}
                onChange={(e) => setCommissionBase(e.target.value as CostAppsCommissionBase)}
              >
                <option value="gross">{t('reportCostAppsCommissionOnGross')}</option>
                <option value="net">{t('reportCostAppsCommissionOnNet')}</option>
              </InlineSelect>
            </Field>

          </div>

          {/* —— حساب عكسي ونسبة التطبيق —— */}
          <div className="noorix-print-hidden space-y-4 border-t border-noorix-border pt-5 print:hidden">
            <SectionHeading tone="slate">{t('reportCostAppsZoneAnalysis')}</SectionHeading>

            <div className="flex flex-wrap items-end justify-center gap-2 sm:justify-start sm:gap-3">
              <Field labelAlign="center" label={t('reportCostAppsSharedAppSharePct')} className="min-w-[140px]">
                <Input
                  value={reverseAppSharePctStr}
                  onChange={inputValue(setReverseAppSharePctStr)}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-[88px] text-center tabular-nums"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start lg:gap-4">
              <div className="flex flex-col gap-3 rounded-xl border border-noorix-border bg-[var(--noorix-surface-1)] p-3 shadow-sm">
                <h4 className="m-0 border-b border-noorix-border/80 pb-2 text-center text-[12px] font-semibold leading-snug text-noorix-text">
                  {t('reportCostAppsReverseCardTitle')}
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center">
                  <Field labelAlign="center" label={t('reportCostAppsTargetProfit')}>
                    <Input
                      value={targetProfitStr}
                      onChange={inputValue(setTargetProfitStr)}
                      inputMode="decimal"
                      dir="ltr"
                      className="min-h-10 w-[128px] text-center tabular-nums"
                    />
                  </Field>
                  <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={handleReverse}>
                    {t('reportCostAppsReverseCalc')}
                  </Button>
                </div>
                {reverseGrossStr ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-noorix-border bg-[var(--noorix-surface-2)] px-3 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-noorix-muted">{t('reportCostAppsGrossTotal')}:</span>
                      <strong className="tabular-nums text-noorix-text" dir="ltr">
                          {fmt(parseMoneyInput(reverseGrossStr).toNumber())}
                      </strong>
                    </div>
                    <Button type="button" variant="primary" size="sm" className="w-full shrink-0 sm:w-auto" onClick={handleApplyReverse}>
                      {t('reportCostAppsReverseApply')}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-noorix-border bg-[var(--noorix-surface-1)] p-3 shadow-sm">
                <h4 className="m-0 border-b border-noorix-border/80 pb-2 text-center text-[12px] font-semibold leading-snug text-noorix-text">
                  {t('reportCostAppsProbeProfitSection')}
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center">
                  <Field labelAlign="center" label={t('reportCostAppsProbeSalesInput')}>
                    <Input
                      value={probeSalesGrossStr}
                      onChange={inputValue(setProbeSalesGrossStr)}
                      inputMode="decimal"
                      dir="ltr"
                      className="min-h-10 w-[128px] text-center tabular-nums"
                    />
                  </Field>
                  <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={handleProbeProfit}>
                    {t('reportCostAppsProbeProfitCalc')}
                  </Button>
                </div>
                {probePlPreview ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-noorix-border bg-[var(--noorix-surface-2)] px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-between">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="text-noorix-muted">{t('reportCostAppsNetProfit')}:</span>
                        <strong className="tabular-nums text-noorix-text" dir="ltr">
                          {fmt2(probePlPreview.netProfit)}
                        </strong>
                      </span>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="text-noorix-muted">{t('reportCostAppsNetSales')}:</span>
                        <strong className="tabular-nums text-noorix-text" dir="ltr">
                          {fmt2(probePlPreview.netSales)}
                        </strong>
                      </span>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="text-noorix-muted">{t('reportCostAppsCommission')}:</span>
                        <strong className="tabular-nums text-noorix-text" dir="ltr">
                          {fmt2(probePlPreview.commission)}
                        </strong>
                      </span>
                    </div>
                    <Button type="button" variant="primary" size="sm" className="w-full shrink-0 sm:ms-auto sm:w-auto" onClick={handleApplyProbeToFields}>
                      {t('reportCostAppsProbeProfitApply')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-noorix-border bg-[var(--noorix-surface-1)] p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-center">
              <Field labelAlign="center" label={t('reportCostAppsAppShare')} className="min-w-0 sm:min-w-[200px]">
                <Input
                  value={appSharePctStr}
                  onChange={inputValue(setAppSharePctStr)}
                  placeholder={plWith.grossTotal.gt(0) ? fmt(plWith.appShareOfGrossPct.toNumber(), 2) : ''}
                  inputMode="decimal"
                  dir="ltr"
                  className="min-h-10 w-[96px] text-center tabular-nums"
                />
              </Field>
              <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={handleApplyAppShare}>
                {t('reportCostAppsApplyShare')}
              </Button>
            </div>
          </div>

        </div>
      </Card>

      <CostAccountingAppsFixedLinesPanel
        key={`cost-apps-expenses-${activeCompanyId}`}
        t={t}
        fixedLines={fixedLines}
        setFixedLines={setFixedLines}
        importingExpenses={importingExpenses}
        onImportExpenses={handleImportExpensesFromSystem}
        salaryStr={salaryStr}
        setSalaryStr={setSalaryStr}
        expensesMonthlyTotal={expensesMonthlyTotal}
        expensesAnnualTotal={expensesAnnualTotal}
        fmt2={fmt2}
      />

      <CostAccountingAppsSavedSlotsPanel
        t={t}
        lang={lang}
        activeCompanyId={activeCompanyId}
        savedSlots={savedSlots}
        previewSlot={previewSlot}
        onPreviewSlot={setPreviewSlot}
        onSaveSlot={handleSaveCalculatorSlot}
        onImportSlot={handleImportSavedSlot}
        onDeleteSlot={handleDeleteSavedSlot}
      />

        </div>

        <CostAccountingAppsResultsColumn
          t={t}
          fmt2={fmt2}
          withAppsScenarioLabel={withAppsScenarioLabel}
          appSalesRowLabel={appSalesRowLabel}
          plWith={plWith}
          plWithout={plWithout}
          onPrint={handlePrint}
          onExportExcel={handleExportExcel}
          onClearDraft={clearDraft}
        />
      </div>

      <CostAccountingAppsPrintStyles />
    </div>
  );
}
