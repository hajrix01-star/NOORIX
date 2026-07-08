import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, ColorSwatch, DateFilterBar, FilterToolbar, ScreenTitle, cn } from '../../../ui';
import { useIsNarrow700 } from '../../../ui';
import { SERIES_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import type { CompanyListItem } from '../../../context/appTypes';
import { ownerCompanyName } from '../utils/ownerDashboardDisplay';
import type { DateFilterController } from '../../../ui/date';

const COLORS = SERIES_RECHARTS_COLORS;

type OwnerFilterBarProps = {
  dateFilter: DateFilterController;
  onExportExcel: () => void;
  onExportPdf: () => void;
  companyList: CompanyListItem[];
  allSelected: boolean;
  selectedCompanyIds: Set<string>;
  onToggleCompany: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
};

export function OwnerFilterBar({
  dateFilter,
  onExportExcel,
  onExportPdf,
  companyList,
  allSelected,
  selectedCompanyIds,
  onToggleCompany,
  onSelectAll,
  onSelectNone,
}: OwnerFilterBarProps) {
  const { t, lang } = useTranslation();
  const isMobile = useIsNarrow700();

  return (
    <>
      <div className="nx-page-header">
        <div className="nx-page-header__titles">
          <ScreenTitle>{t('ownerDashboard')}</ScreenTitle>
          <p className="text-[13px] text-noorix-muted m-0">{t('ownerDashboardDesc')}</p>
        </div>
        <FilterToolbar
          className="max-w-full"
          actions={(
            <>
              <Button variant="primary" onClick={onExportExcel} size="sm">
                Excel
              </Button>
              <Button onClick={onExportPdf} size="sm">
                {lang === 'ar' ? 'طباعة / PDF' : 'Print / PDF'}
              </Button>
            </>
          )}
        >
          <DateFilterBar filter={dateFilter} />
        </FilterToolbar>
      </div>

      <div className={cn('noorix-surface-card', isMobile ? 'p-3' : 'p-4')}>
        <div className="font-bold mb-3">{t('ownerSelectCompanies')}</div>
        <div className="flex items-center flex-wrap gap-2">
          <Button onClick={onSelectAll} size="sm">
            {t('ownerAllCompanies')}
          </Button>
          <Button onClick={onSelectNone} size="sm">
            {lang === 'ar' ? 'إخفاء الكل' : 'Hide all'}
          </Button>
          {companyList.map((company, index) => {
            const isVisible = allSelected || selectedCompanyIds.has(company.id);
            const companyColor = COLORS[index % COLORS.length];
            return (
              <Button
                key={company.id}
                variant="raw"
                className="owner-company-card flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg"
                onClick={() => onToggleCompany(company.id)}
                title={isVisible ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'عرض' : 'Show')}
                runtimeStyle={{
                  border: `1px solid ${isVisible ? companyColor : 'var(--noorix-border)'}`,
                  background: isVisible ? `${companyColor}18` : 'var(--noorix-bg-muted)',
                  color: isVisible ? companyColor : 'var(--noorix-text-muted)',
                }}
              >
                <ColorSwatch
                  className="h-3 w-3 shrink-0 rounded-sm"
                  color={isVisible ? companyColor : 'var(--noorix-border)'}
                />
                <span>{ownerCompanyName(company, lang, company.id)}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </>
  );
}
