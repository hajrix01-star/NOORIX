/**
 * ReportsLayout — إطار التقارير مع قائمة فرعية شجرية
 * يعرض: التقرير العام | الضريبي | تحليل كشف الحسابات
 */
import React, { useMemo } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import {
  REPORT_TAB_SEQUENCE,
  hasAnyOfPermissions,
} from '../../constants/permissions';
import { ScreenShell, ScreenTitle, cn } from '../../ui';

const REPORT_TAB_LABELS: Record<string, string> = {
  '/reports/general': 'reportGeneralReport',
  '/reports/cost-apps': 'reportCostAppsNav',
  '/reports/tax': 'reportTax',
  '/reports/bank-statement': 'reportBankStatementAnalysis',
};

export default function ReportsLayout() {
  const { t } = useTranslation();
  const { user } = useApp();

  const visibleLinks = useMemo(
    () =>
      REPORT_TAB_SEQUENCE.filter(({ required }) =>
        hasAnyOfPermissions(user?.role, required, user?.permissions),
      ),
    [user?.role, user?.permissions],
  );

  return (
    <ScreenShell>
      <div>
        <ScreenTitle>{t('reports')}</ScreenTitle>
      </div>

      <div className="noorix-surface-card p-0 overflow-hidden">
        {visibleLinks.length > 0 && (
          <div className="noorix-tab-bar flex gap-0 border-b border-noorix-border overflow-x-auto [-webkit-overflow-scrolling:touch]">
            {visibleLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    'm-0 shrink-0 whitespace-nowrap rounded-none border-0 border-b-2 px-[18px] py-3 text-[14px] no-underline transition-colors',
                    isActive
                      ? 'border-b-noorix-blue bg-[var(--noorix-blue-7)] font-bold text-noorix-blue'
                      : 'border-b-transparent bg-transparent font-medium text-noorix-muted hover:text-noorix-text',
                  )
                }
              >
                {t(REPORT_TAB_LABELS[link.path] || 'reports')}
              </NavLink>
            ))}
          </div>
        )}
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </ScreenShell>
  );
}