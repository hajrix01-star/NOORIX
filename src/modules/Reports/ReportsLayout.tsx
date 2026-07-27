/**
 * ReportsLayout — إطار التقارير مع قائمة فرعية شجرية
 * يعرض: التقرير العام | الضريبي | تحليل كشف الحسابات
 */
import React, { useMemo } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import {
  REPORT_TAB_SEQUENCE,
  hasAnyOfPermissions,
} from '../../constants/permissions';
import { ScreenShell, ScreenTitle, cn } from '../../ui';

const REPORT_TAB_LABELS: Record<string, string> = {
  '/reports/general': 'reportGeneralReport',
  '/reports/general-v2': 'reportGeneralV2Nav',
  '/reports/cost-apps': 'reportCostAppsNav',
  '/reports/tax': 'reportTax',
  '/reports/bank-statement': 'reportBankStatementAnalysis',
};

export default function ReportsLayout() {
  const { t } = useTranslation();
  const { user } = useApp();
  const location = useLocation();
  const isGeneralReport = location.pathname === '/reports/general' || location.pathname === '/reports/general-v2';

  const visibleLinks = useMemo(
    () =>
      REPORT_TAB_SEQUENCE.filter(({ required }) =>
        hasAnyOfPermissions(user?.role, required, user?.permissions),
      ),
    [user?.role, user?.permissions],
  );

  return (
    <ScreenShell variant="report">
      <div className="nx-reports-page-head">
        <ScreenTitle>{t('reports')}</ScreenTitle>
      </div>

      <div className={cn('nx-reports-frame', !isGeneralReport && 'noorix-surface-card')}>
        {visibleLinks.length > 0 && (
          <div className="nx-reports-tab-bar">
            {visibleLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    'nx-reports-tab',
                    isActive
                      ? 'nx-reports-tab--active'
                      : 'nx-reports-tab--idle',
                  )
                }
              >
                {t(REPORT_TAB_LABELS[link.path] || 'reports')}
              </NavLink>
            ))}
          </div>
        )}
        <div className={cn('nx-reports-content', isGeneralReport && 'nx-reports-content--general')}>
          <Outlet />
        </div>
      </div>
    </ScreenShell>
  );
}
