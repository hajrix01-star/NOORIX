/**
 * ReportsLayout — إطار التقارير مع قائمة فرعية شجرية
 * يعرض: التقرير العام | الضريبي | تحليل كشف الحسابات
 */
import React from 'react';
import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenShell, ScreenTitle, cn } from '../../ui';

const REPORT_SUB_LINKS = [
  { to: '/reports/general', labelKey: 'reportGeneralReport' },
  { to: '/reports/tax', labelKey: 'reportTax' },
  { to: '/reports/bank-statement', labelKey: 'reportBankStatementAnalysis' },
];

export default function ReportsLayout() {
  const { t } = useTranslation();

  return (
    <ScreenShell>
      <div>
        <ScreenTitle>{t('reports')}</ScreenTitle>
      </div>

      <div className="noorix-surface-card p-0 overflow-hidden">
        <div className="noorix-tab-bar flex gap-0 border-b border-noorix-border overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {REPORT_SUB_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'm-0 shrink-0 whitespace-nowrap rounded-none border-0 border-b-2 px-[18px] py-3 text-[14px] no-underline transition-colors',
                  isActive
                    ? 'border-b-noorix-blue bg-[var(--noorix-blue-7)] font-bold text-noorix-blue'
                    : 'border-b-transparent bg-transparent font-medium text-noorix-muted hover:text-noorix-text',
                )
              }
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </ScreenShell>
  );
}

export function ReportsIndexRedirect() {
  return <Navigate to="/reports/general" replace />;
}
