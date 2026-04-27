import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { Button, Input, cn } from '../../ui';
import type { CompanyListItem } from '../../context/appTypes';
import type { AnalyticsStudioFilterState } from '../../utils/analyticsStudioQueryKey';

export type AnalyticsFilterBarProps = {
  filters: AnalyticsStudioFilterState;
  onChange: (next: AnalyticsStudioFilterState) => void;
  companies: CompanyListItem[];
  /** أكثر من شركة → إظهار نطاق الكل/واحدة */
  multiCompany: boolean;
};

export default function AnalyticsFilterBar({
  filters,
  onChange,
  companies,
  multiCompany,
}: AnalyticsFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-end gap-4 pb-4 border-b border-noorix-border mb-6">
      <div className="grid gap-1 min-w-[140px]">
        <label className="text-[12px] font-semibold text-noorix-muted">{t('analyticsStudioStart')}</label>
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e: any) => onChange({ ...filters, startDate: e.target.value })}
        />
      </div>
      <div className="grid gap-1 min-w-[140px]">
        <label className="text-[12px] font-semibold text-noorix-muted">{t('analyticsStudioEnd')}</label>
        <Input
          type="date"
          value={filters.endDate}
          onChange={(e: any) => onChange({ ...filters, endDate: e.target.value })}
        />
      </div>
      {multiCompany && (
        <div className="grid gap-1 min-w-[200px]">
          <label className="text-[12px] font-semibold text-noorix-muted">{t('analyticsStudioCompanyScope')}</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={filters.companyScope === 'all' ? 'primary' : 'secondary'}
              className={cn('text-[13px]', filters.companyScope !== 'all' && 'opacity-80')}
              onClick={() => onChange({ ...filters, companyScope: 'all', companyId: '' })}
            >
              {t('analyticsStudioAllCompanies')}
            </Button>
            <Button
              type="button"
              variant={filters.companyScope === 'one' ? 'primary' : 'secondary'}
              className="text-[13px]"
              onClick={() =>
                onChange({
                  ...filters,
                  companyScope: 'one',
                  companyId: filters.companyId || companies[0]?.id || '',
                })
              }
            >
              {t('analyticsStudioOneCompany')}
            </Button>
          </div>
        </div>
      )}
      {(filters.companyScope === 'one' || !multiCompany) && (
        <div className="grid gap-1 min-w-[220px] flex-1">
          <label className="text-[12px] font-semibold text-noorix-muted">{t('analyticsStudioPickCompany')}</label>
          <select
            className="rounded-md border border-noorix-border bg-[var(--noorix-bg-surface)] px-3 py-2 text-[14px]"
            value={filters.companyId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...filters, companyId: e.target.value, companyScope: 'one' })
            }
          >
            <option value="">{t('analyticsStudioSelectCompany')}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr || c.nameEn || c.id}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
