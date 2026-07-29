import React, { useEffect, useState } from 'react';
import { Button, Input } from '../../ui';
import type { ReportPeriodMode } from './reportTypes';
import {
  toggleAccountingMonthPeriod,
  toggleAccountingQuarterPeriod,
  toggleAccountingYearPeriod,
  type AccountingMonthPeriod,
  type AccountingPeriodSelection,
  type AccountingQuarterPeriod,
} from './accountingReportPeriodModel';
import { getSaudiNow } from '../../utils/saudiDate';

type ProfitLossPeriodSelectorProps = {
  lang: string;
  monthNames: string[];
  periodMode: ReportPeriodMode;
  selectedMonthPeriods: AccountingMonthPeriod[];
  selectedQuarterPeriods: AccountingQuarterPeriod[];
  selectedYears: number[];
  year: number;
  yearOptions: number[];
  yearsWithData: number[];
  t: (key: string) => string;
  onApplyPeriodSelection: (selection: AccountingPeriodSelection) => void;
};

export function ProfitLossPeriodSelector({
  lang,
  monthNames,
  periodMode,
  selectedMonthPeriods,
  selectedQuarterPeriods,
  selectedYears,
  year,
  yearOptions,
  yearsWithData,
  t,
  onApplyPeriodSelection,
}: ProfitLossPeriodSelectorProps) {
  const [builderYear, setBuilderYear] = useState(year);
  const [draftMode, setDraftMode] = useState<ReportPeriodMode>(periodMode);
  const [draftSelectedMonthPeriods, setDraftSelectedMonthPeriods] = useState<AccountingMonthPeriod[]>(selectedMonthPeriods);
  const [draftSelectedQuarterPeriods, setDraftSelectedQuarterPeriods] = useState<AccountingQuarterPeriod[]>(selectedQuarterPeriods);
  const [draftSelectedYears, setDraftSelectedYears] = useState<number[]>(selectedYears);
  const isArabic = lang !== 'en';
  const hasDraftChanges = draftMode !== periodMode
    || JSON.stringify(draftSelectedMonthPeriods) !== JSON.stringify(selectedMonthPeriods)
    || JSON.stringify(draftSelectedQuarterPeriods) !== JSON.stringify(selectedQuarterPeriods)
    || JSON.stringify(draftSelectedYears) !== JSON.stringify(selectedYears);
  const hasValidDraft = draftMode === 'month'
    ? draftSelectedMonthPeriods.length > 0
    : draftMode === 'quarter'
      ? draftSelectedQuarterPeriods.length > 0
      : draftSelectedYears.length > 0;
  const currentMonthReset = getSaudiNow();

  useEffect(() => {
    setBuilderYear(year);
    setDraftMode(periodMode);
    setDraftSelectedMonthPeriods(selectedMonthPeriods);
    setDraftSelectedQuarterPeriods(selectedQuarterPeriods);
    setDraftSelectedYears(selectedYears);
  }, [periodMode, selectedMonthPeriods, selectedQuarterPeriods, selectedYears, year]);

  return (
    <div className="nx-pl-period-inline">
      <div className="nx-pl-period-inline__setup">
        <span className="nx-pl-period-inline__label">{isArabic ? AR.periodSetup : 'Period setup'}</span>
        <label className="nx-pl-period-inline__year">
          <span>{t('reportYear')}</span>
          <Input
            type="select"
            size="sm"
            className="w-[104px]"
            value={builderYear}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setBuilderYear(Number(event.target.value))}
          >
            {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </Input>
        </label>
        <Button
          size="sm"
          variant="primary"
          type="button"
          className="nx-pl-period-inline__apply"
          disabled={!hasDraftChanges || !hasValidDraft}
          onClick={() => onApplyPeriodSelection({
            mode: draftMode,
            anchorYear: draftAnchorYear({
              mode: draftMode,
              fallbackYear: builderYear,
              selectedMonthPeriods: draftSelectedMonthPeriods,
              selectedQuarterPeriods: draftSelectedQuarterPeriods,
              selectedYears: draftSelectedYears,
            }),
            selectedMonthPeriods: draftSelectedMonthPeriods,
            selectedQuarterPeriods: draftSelectedQuarterPeriods,
            selectedYears: draftSelectedYears,
          })}
        >
          {isArabic ? AR.apply : 'Apply'}
        </Button>
        <Button
          size="sm"
          variant="default"
          type="button"
          onClick={() => {
            setBuilderYear(currentMonthReset.year);
            setDraftMode('month');
            setDraftSelectedMonthPeriods([{ year: currentMonthReset.year, month: currentMonthReset.month }]);
            setDraftSelectedQuarterPeriods([{
              year: currentMonthReset.year,
              quarter: Math.ceil(currentMonthReset.month / 3),
            }]);
            setDraftSelectedYears([currentMonthReset.year]);
          }}
        >
          {isArabic ? AR.reset : 'Reset'}
        </Button>
      </div>

      <div className="nx-pl-period-inline__row nx-pl-period-inline__row--months">
        <span className="nx-pl-period-inline__row-label">{isArabic ? AR.months : 'Months'}</span>
        <div className="nx-pl-period-inline__choices">
          <Button
            size="sm"
            variant={draftMode === 'month' && isFullYearSelected(draftSelectedMonthPeriods, builderYear) ? 'primary' : 'default'}
            type="button"
            onClick={() => {
              setDraftMode('month');
              setDraftSelectedMonthPeriods((prev) => toggleDraftFullYearMonths(prev, builderYear));
            }}
          >
            {isArabic ? AR.fullYearMonths : 'Full year months'}
          </Button>
          {monthNames.map((name, index) => {
            const month = index + 1;
            const selected = draftSelectedMonthPeriods.some((item) => item.year === builderYear && item.month === month);
            return (
              <Button
                key={month}
                size="sm"
                variant={draftMode === 'month' && selected ? 'primary' : 'default'}
                type="button"
                onClick={() => {
                  setDraftMode('month');
                  setDraftSelectedMonthPeriods((prev) => toggleAccountingMonthPeriod({ periods: prev, itemYear: builderYear, month, anchorYear: builderYear }));
                }}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="nx-pl-period-inline__row">
        <span className="nx-pl-period-inline__row-label">{isArabic ? AR.quarters : 'Quarters'}</span>
        <div className="nx-pl-period-inline__choices nx-pl-period-inline__choices--short">
          {[1, 2, 3, 4].map((quarter) => (
            <Button
              key={quarter}
              size="sm"
              variant={draftMode === 'quarter' && draftSelectedQuarterPeriods.some((item) => item.year === builderYear && item.quarter === quarter) ? 'primary' : 'default'}
              type="button"
              onClick={() => {
                setDraftMode('quarter');
                setDraftSelectedQuarterPeriods((prev) => toggleAccountingQuarterPeriod({ periods: prev, itemYear: builderYear, quarter, anchorYear: builderYear }));
              }}
            >
              {isArabic ? `${AR.quarter} ${quarter}` : `Q${quarter}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="nx-pl-period-inline__row">
        <span className="nx-pl-period-inline__row-label">{isArabic ? AR.years : 'Years'}</span>
        <div className="nx-pl-period-inline__choices nx-pl-period-inline__choices--short">
          {yearsWithData.map((itemYear) => (
            <Button
              key={itemYear}
              size="sm"
              variant={draftMode === 'year' && draftSelectedYears.includes(itemYear) ? 'primary' : 'default'}
              type="button"
              onClick={() => {
                setDraftMode('year');
                setDraftSelectedYears((prev) => toggleAccountingYearPeriod({ years: prev, itemYear, anchorYear: builderYear }));
              }}
            >
              {itemYear}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function buildProfitLossPeriodLabel({
  isArabic,
  monthNames,
  periodMode,
  selectedMonthPeriods,
  selectedQuarterPeriods,
  selectedYears,
  year,
}: {
  isArabic: boolean;
  monthNames: string[];
  periodMode: ReportPeriodMode;
  selectedMonthPeriods: AccountingMonthPeriod[];
  selectedQuarterPeriods: AccountingQuarterPeriod[];
  selectedYears: number[];
  year: number;
}) {
  if (periodMode === 'year') return selectedYears.join(isArabic ? AR.comma : ', ') || String(year);
  if (periodMode === 'quarter') {
    return selectedQuarterPeriods
      .map((item) => `${isArabic ? AR.quarter : 'Q'} ${item.quarter} ${item.year}`)
      .join(isArabic ? AR.comma : ', ');
  }
  return selectedMonthPeriods
    .map((item) => `${monthNames[item.month - 1]} ${item.year}`)
    .join(isArabic ? AR.comma : ', ');
}

function isFullYearSelected(periods: AccountingMonthPeriod[], year: number) {
  return Array.from({ length: 12 }, (_, index) => index + 1)
    .every((month) => periods.some((item) => item.year === year && item.month === month));
}

function toggleDraftFullYearMonths(periods: AccountingMonthPeriod[], year: number) {
  const allMonths = Array.from({ length: 12 }, (_, index) => index + 1);
  if (isFullYearSelected(periods, year)) {
    return periods.filter((item) => item.year !== year);
  }
  const otherYears = periods.filter((item) => item.year !== year);
  return [...otherYears, ...allMonths.map((month) => ({ year, month }))];
}

function draftAnchorYear({
  mode,
  fallbackYear,
  selectedMonthPeriods,
  selectedQuarterPeriods,
  selectedYears,
}: {
  mode: ReportPeriodMode;
  fallbackYear: number;
  selectedMonthPeriods: AccountingMonthPeriod[];
  selectedQuarterPeriods: AccountingQuarterPeriod[];
  selectedYears: number[];
}) {
  if (mode === 'month') return selectedMonthPeriods[0]?.year ?? fallbackYear;
  if (mode === 'quarter') return selectedQuarterPeriods[0]?.year ?? fallbackYear;
  return selectedYears[0] ?? fallbackYear;
}

const AR = {
  comma: '\u060c ',
  months: '\u0634\u0647\u0648\u0631',
  quarter: '\u0627\u0644\u0631\u0628\u0639',
  quarters: '\u0623\u0631\u0628\u0627\u0639',
  years: '\u0633\u0646\u0648\u0627\u062a',
  periodSetup: '\u0625\u0639\u062f\u0627\u062f \u0627\u0644\u0641\u062a\u0631\u0629',
  periodVatInclusive: '\u0634\u0627\u0645\u0644 \u0627\u0644\u0636\u0631\u064a\u0628\u0629',
  fullYearMonths: '\u0634\u0647\u0648\u0631 \u0627\u0644\u0633\u0646\u0629 \u0643\u0627\u0645\u0644\u0629',
  apply: '\u062a\u0637\u0628\u064a\u0642',
  reset: '\u0625\u0639\u0627\u062f\u0629 \u0636\u0628\u0637',
} as const;
