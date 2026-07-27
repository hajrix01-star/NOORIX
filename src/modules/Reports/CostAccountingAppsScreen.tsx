/**
 * حاسبة تكاليف / تطبيقات — معزولة عن دفتر الحسابات؛ استيراد مبيعات من الملخصات اليومية فقط.
 */
import type { ChangeEvent } from 'react';
import { fmt } from '../../utils/format';
import { formatUiDateTime } from '../../utils/saudiDate';
import { Button, Checkbox, DialogActions, FileTrigger, InlineSelect, Input, cn, Modal } from '../../ui';
import Card from '../../ui/Card';
import { type CostAppsCommissionBase } from './costAccountingAppsModel';
import { Field, SectionHeading } from './costAccountingApps/CostAccountingAppsUiParts';
import { lastDayOfMonth, newLine, parseMoneyInput, ymdParts } from './costAccountingApps/costAccountingAppsScreenUtils';
import { CostAppsActionsBar, CostAppsKpiCards, CostAppsPlSummaryTable } from './costAccountingApps/CostAccountingAppsResultPanels';
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
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-surface-1)] p-8 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div className="cost-apps-calc mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5 print:max-w-none print:gap-2">
      {printPreviewModal}
      <header className="noorix-print-hidden overflow-hidden rounded-2xl border border-noorix-border bg-gradient-to-br from-noorix-blue/[0.07] via-[var(--noorix-surface-1)] to-[var(--noorix-surface-1)] p-4 shadow-sm sm:p-5 print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-xl font-bold tracking-tight text-noorix-text sm:text-2xl">{t('reportCostAppsTitle')}</h1>
              <span className="rounded-full border border-noorix-border bg-[var(--noorix-surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-noorix-muted">
                {t('reportCostAppsNav')}
              </span>
            </div>
          </div>
          {companyName ? (
            <div className="shrink-0 rounded-xl border border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3 text-center sm:text-end">
              <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-noorix-muted">{t('reportCostAppsCompanyLabel')}</p>
              <p className="m-0 mt-1 max-w-[200px] truncate text-sm font-bold text-noorix-text sm:max-w-[240px]" title={companyName}>
                {companyName}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-5 print:grid-cols-1 print:gap-3">
        {/* عمود المدخلات والاستيراد */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-5 print:order-1">
          <div className="noorix-print-hidden flex items-center gap-2 border-b border-noorix-border pb-2 print:hidden">
            <span className="h-1 w-8 shrink-0 rounded-full bg-noorix-blue/80" aria-hidden />
            <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-noorix-muted">{t('reportCostAppsColumnInputs')}</span>
          </div>

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

          {/* —— مزامنة المبيعات —— */}
          <div className="noorix-print-hidden space-y-3 border-t border-noorix-border pt-5 print:hidden">
            <SectionHeading tone="green">{t('reportCostAppsZoneSync')}</SectionHeading>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <Field label={t('reportCostAppsImportMonth')} labelAlign="center" className="min-w-0 flex-1 sm:max-w-[min(100%,20rem)]">
                <InlineSelect
                  className={cn(
                    'min-h-10 w-full rounded-md border border-noorix-border bg-[var(--noorix-surface-1)] px-3 py-2 text-center text-sm font-semibold text-noorix-text',
                  )}
                  value={importMonthSelectValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    const [ys, ms] = v.split('-');
                    const y = parseInt(ys, 10);
                    const m = parseInt(ms, 10);
                    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return;
                    setImportFrom(ymdParts(y, m, 1));
                    setImportTo(ymdParts(y, m, lastDayOfMonth(y, m)));
                  }}
                >
                  {importMonthOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </InlineSelect>
              </Field>
              <div className="flex flex-wrap items-end justify-center gap-2 sm:justify-start">
                <Button type="button" variant="secondary" size="sm" disabled={importing} onClick={handleImportSystem}>
                  {importing ? t('loading') : t('reportCostAppsImportBtn')}
                </Button>
                <FileTrigger
                  ref={fileRef}
                  label={t('reportCostAppsCsvImport')}
                  accept=".csv,text/csv"
                  onChange={handleCsvPick}
                  buttonProps={{ variant: 'ghost', size: 'sm' }}
                />
              </div>
            </div>
          </div>

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

      <Card
        key={`cost-apps-expenses-${activeCompanyId}`}
        variant="surface"
        padding="none"
        className="overflow-hidden border border-noorix-border shadow-sm print:break-inside-avoid print:shadow-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-bold print:text-xs">{t('reportCostAppsFixedLines')}</h2>
          </div>
          <div className="noorix-print-hidden flex flex-wrap gap-2 print:hidden">
            <Button type="button" variant="secondary" size="sm" disabled={importingExpenses} onClick={handleImportExpensesFromSystem}>
              {importingExpenses ? t('loading') : t('reportCostAppsExpensesImportBtn')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFixedLines((prev) => [...prev, newLine()])}>
              {t('reportCostAppsAddLine')}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto p-2 sm:p-0 print:p-0">
          <table className="w-full border-collapse border border-noorix-border text-sm print:text-[11px]">
            <thead>
              <tr className="bg-[var(--noorix-table-header-bg)]">
                <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight print:px-1 print:py-1">
                  {t('reportCostAppsLineLabel')}
                </th>
                <th
                  className="w-[120px] border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight print:px-1 print:py-1"
                >
                  {t('reportCostAppsLineMonthlyAmount')}
                </th>
                <th
                  className="w-[120px] border border-noorix-border px-2 py-2.5 text-center text-xs font-bold leading-tight print:px-1 print:py-1"
                >
                  {t('reportCostAppsLineAnnualAmount')}
                </th>
                <th className="noorix-print-hidden border border-noorix-border px-2 py-2 w-16 print:hidden" />
              </tr>
            </thead>
            <tbody>
              <tr className="bg-[var(--noorix-surface-1)]/60">
                <td className="border border-noorix-border px-2 py-2 text-center text-[13px] font-medium text-noorix-text">
                  {t('reportCostAppsPayrollLineLabel')}
                </td>
                <td className="border border-noorix-border p-1">
                  <Input
                    value={salaryStr}
                    onChange={inputValue(setSalaryStr)}
                    dir="ltr"
                    className="border-0 text-center tabular-nums"
                    inputMode="decimal"
                    placeholder="0"
                  />
                </td>
                <td className="border border-noorix-border px-2 py-2 text-center tabular-nums text-noorix-text" dir="ltr">
                  {fmt2(parseMoneyInput(salaryStr).mul(12))}
                </td>
                <td className="noorix-print-hidden border border-noorix-border px-2 py-2 print:hidden" aria-hidden />
              </tr>
              {fixedLines.map((line) => {
                const monthlyDec = parseMoneyInput(line.amount);
                const annualDec = monthlyDec.mul(12);
                return (
                  <tr key={line.id}>
                    <td className="border border-noorix-border p-1">
                      <Input
                        value={line.label}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setFixedLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, label: event.target.value } : r)))}
                        className="border-0 text-center"
                      />
                    </td>
                    <td className="border border-noorix-border p-1">
                      <Input
                        value={line.amount}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setFixedLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, amount: event.target.value } : r)))}
                        dir="ltr"
                        className="border-0 text-center tabular-nums"
                        inputMode="decimal"
                      />
                    </td>
                    <td className="border border-noorix-border px-2 py-2 text-center tabular-nums text-noorix-text" dir="ltr">
                      {fmt2(annualDec)}
                    </td>
                    <td className="noorix-print-hidden border border-noorix-border p-1 print:hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-0 px-2 py-1 text-xs"
                        onClick={() => setFixedLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== line.id)))}
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-noorix-border px-2 py-2 text-center font-bold">{t('reportTotalAmount')}</td>
                <td className="border border-noorix-border px-2 py-2 text-center font-bold tabular-nums" dir="ltr">
                  {fmt2(expensesMonthlyTotal)}
                </td>
                <td className="border border-noorix-border px-2 py-2 text-center font-bold tabular-nums" dir="ltr">
                  {fmt2(expensesAnnualTotal)}
                </td>
                <td className="noorix-print-hidden print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        key={`cost-apps-saved-slots-${activeCompanyId}`}
        variant="surface"
        padding="none"
        className="noorix-print-hidden overflow-hidden border border-noorix-border shadow-sm print:hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-bold">{t('reportCostAppsSavedSlotsTitle')}</h2>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleSaveCalculatorSlot}>
            {t('reportCostAppsSaveSlotBtn')}
          </Button>
        </div>
        <div className="overflow-x-auto p-3 sm:p-4">
          {savedSlots.length === 0 ? (
            <p className="m-0 px-2 py-8 text-center text-[13px] text-noorix-muted">{t('reportCostAppsSavedSlotsEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {savedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-col gap-3 rounded-xl border border-noorix-border bg-[var(--noorix-surface-1)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 text-center sm:text-start">
                    <p className="m-0 truncate text-sm font-bold text-noorix-text" title={slot.label}>
                      {slot.label}
                    </p>
                    <p className="m-0 mt-1 text-center text-[12px] text-noorix-muted sm:text-start">
                      {formatUiDateTime(slot.savedAt, lang, 'detailed')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-row flex-wrap items-center justify-center gap-2 sm:justify-end">
                    <Button type="button" variant="ghost" size="sm" className="min-h-9 min-w-[4.5rem] whitespace-nowrap px-3" onClick={() => setPreviewSlot(slot)}>
                      {t('reportCostAppsSavedView')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-9 min-w-[5.5rem] whitespace-nowrap px-3"
                      onClick={() => handleImportSavedSlot(slot)}
                    >
                      {t('reportCostAppsSavedImport')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-9 min-w-[4.5rem] whitespace-nowrap px-3 text-noorix-red hover:bg-noorix-red/10"
                      onClick={() => handleDeleteSavedSlot(slot.id)}
                    >
                      {t('reportCostAppsSavedDelete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

        </div>

        {/* عمود النتائج: مؤشرات + جدول الربحية + إجراءات */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-7 lg:sticky lg:top-4 lg:z-[1] lg:self-start print:order-2">
          <div className="noorix-print-hidden flex items-center gap-2 border-b border-noorix-border pb-2 print:hidden">
            <span className="h-1 w-8 shrink-0 rounded-full bg-noorix-green/90" aria-hidden />
            <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-noorix-muted">{t('reportCostAppsColumnResults')}</span>
          </div>

          <CostAppsKpiCards t={t} fmt2={fmt2} plWith={plWith} plWithout={plWithout} />

          <CostAppsPlSummaryTable
            t={t}
            fmt2={fmt2}
            withAppsScenarioLabel={withAppsScenarioLabel}
            appSalesRowLabel={appSalesRowLabel}
            plWith={plWith}
            plWithout={plWithout}
          />

          <CostAppsActionsBar
            t={t}
            onPrint={handlePrint}
            onExportExcel={handleExportExcel}
            onClearDraft={clearDraft}
          />
        </div>
      </div>

      <Modal
        open={!!previewSlot}
        onClose={() => setPreviewSlot(null)}
        title={previewSlot?.label ?? ''}
        size="xl"
        footer={
          previewSlot ? (
            <DialogActions
              actions={[
                {
                  key: 'import-saved-slot',
                  label: t('reportCostAppsSavedImport'),
                  role: 'primary',
                  onClick: () => handleImportSavedSlot(previewSlot),
                },
              ]}
            />
          ) : undefined
        }
      >
        {previewSlot ? (
          <pre
            className="m-0 max-w-full overflow-x-auto font-mono text-[12px] leading-relaxed text-noorix-text whitespace-pre-wrap break-words"
            dir="ltr"
          >
            {(() => {
              try {
                return JSON.stringify(JSON.parse(previewSlot.scenarioJson), null, 2);
              } catch {
                return previewSlot.scenarioJson;
              }
            })()}
          </pre>
        ) : null}
      </Modal>

      <style>{`
        @media print {
          .noorix-print-hidden { display: none !important; }
          .cost-apps-calc { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
