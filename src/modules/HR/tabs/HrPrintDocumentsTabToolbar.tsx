import React from 'react';
import { Button, FilterToolbar, SearchableOptionsPicker } from '../../../ui';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import type { HrPrintDocKind } from './hrPrintDocumentsTabDrafts';

type Translate = (key: string) => string;

export type { HrPrintDocKind } from './hrPrintDocumentsTabDrafts';

/** Minimal employee fields needed for the print-tab employee dropdown. */
export type HrPrintToolbarEmployee = {
  id: string;
  nameAr?: string | null;
  name?: string | null;
  nameEn?: string | null;
};

export function HrPrintDocumentsTabToolbar({
  t,
  lang,
  docKind,
  onDocKind,
  printLandscape,
  onPrintLandscape,
  employeeId,
  onEmployeeId,
  employees,
  hasEmployee,
  onImportFromHr,
}: {
  t: Translate;
  lang: string;
  docKind: HrPrintDocKind;
  onDocKind: (k: HrPrintDocKind) => void;
  printLandscape: boolean;
  onPrintLandscape: (landscape: boolean) => void;
  employeeId: string;
  onEmployeeId: (id: string) => void;
  employees: HrPrintToolbarEmployee[];
  hasEmployee: boolean;
  onImportFromHr: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={docKind === 'payroll' ? 'primary' : 'ghost'} onClick={() => onDocKind('payroll')}>
            {t('hrPrintDocPayroll')}
          </Button>
          <Button type="button" size="sm" variant={docKind === 'eos' ? 'primary' : 'ghost'} onClick={() => onDocKind('eos')}>
            {t('hrPrintDocEos')}
          </Button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md sm:items-end">
          <div className="w-full sm:w-auto">
            <p className="m-0 mb-1.5 text-[11px] font-semibold text-noorix-text sm:text-end">{t('hrPrintOrientation')}</p>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button type="button" size="sm" variant={!printLandscape ? 'primary' : 'ghost'} onClick={() => onPrintLandscape(false)}>
                {t('hrPrintOrientationPortrait')}
              </Button>
              <Button type="button" size="sm" variant={printLandscape ? 'primary' : 'ghost'} onClick={() => onPrintLandscape(true)}>
                {t('hrPrintOrientationLandscape')}
              </Button>
            </div>
          </div>
          <p className="m-0 text-[11px] leading-snug text-noorix-muted sm:text-end">{t('hrPrintOrientationHint')}</p>
        </div>
      </div>

      <FilterToolbar
        actions={(
          <Button type="button" size="sm" variant="primary" disabled={!hasEmployee} onClick={onImportFromHr}>
            {t('hrPrintImportFromHr')}
          </Button>
        )}
      >
        <SearchableOptionsPicker
          label={t('selectEmployee')}
          allowEmpty
          emptyValue=""
          emptyLabel="—"
          value={employeeId}
          onChange={onEmployeeId}
          options={employees.map((e) => ({ value: e.id, label: employeeDisplayName(e, lang, e.id) }))}
          aria-label={t('selectEmployee')}
        />
      </FilterToolbar>
    </>
  );
}
