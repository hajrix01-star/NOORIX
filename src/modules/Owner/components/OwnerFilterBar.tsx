import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, cn, ScreenTitle } from '../../../ui';
import { useIsNarrow700 } from '../../../ui';
import { EN_MONTHS } from '../../Reports/reportHelpers';
import { SERIES_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import type { CompanyListItem } from '../../../context/appTypes';

const COLORS = SERIES_RECHARTS_COLORS;

type OwnerFilterBarProps = {
  year: number;
  setYear: (y: number) => void;
  currentYear: number;
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
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
  year,
  setYear,
  currentYear,
  selectedMonth,
  setSelectedMonth,
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
        <div className="nx-toolbar">
          <Input
            type="select"
            value={year}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(Number(e.target.value))}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Input>
          <Input
            type="select"
            value={selectedMonth}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value)}
          >
            <option value="">{t('allMonths')}</option>
            {EN_MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </Input>
          <Button variant="primary" onClick={onExportExcel} size="sm">
            Excel
          </Button>
          <Button onClick={onExportPdf} size="sm">
            طباعة / PDF
          </Button>
        </div>
      </div>

      <div className={cn('noorix-surface-card', isMobile ? 'p-3' : 'p-4')}>
        <div className="font-bold mb-3">{t('ownerSelectCompanies')}</div>
        <div className="flex items-center flex flex-wrap gap-2">
          <Button onClick={onSelectAll} size="sm">
            {t('ownerAllCompanies')}
          </Button>
          <Button onClick={onSelectNone} size="sm">
            {lang === 'ar' ? 'إخفاء الكل' : 'Hide all'}
          </Button>
          {companyList.map((c, i) => {
            const isVisible = allSelected ? true : selectedCompanyIds.has(c.id);
            const companyColor = COLORS[i % COLORS.length];
            return (
              <Button
                key={c.id}
                variant="raw"
                className="owner-company-card flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg"
                onClick={() => onToggleCompany(c.id)}
                title={isVisible ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'عرض' : 'Show')}
                runtimeStyle={{
                  border: `1px solid ${isVisible ? companyColor : 'var(--noorix-border)'}`,
                  background: isVisible ? `${companyColor}18` : 'var(--noorix-bg-muted)',
                  color: isVisible ? companyColor : 'var(--noorix-text-muted)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" fill={isVisible ? 'currentColor' : 'none'} />
                </svg>
                <span>{lang === 'ar' ? c.nameAr || c.nameEn : c.nameEn || c.nameAr}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </>
  );
}
