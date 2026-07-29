/**
 * ReportsLayout — إطار التقارير مع قائمة فرعية شجرية
 * يعرض: التقرير العام | الضريبي | تحليل كشف الحسابات
 */
import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import {
  REPORT_TAB_SEQUENCE,
  hasAnyOfPermissions,
} from '../../constants/permissions';
import { ScreenShell, ScreenTitle, ScreenTabs, cn } from '../../ui';

const REPORT_TAB_LABELS: Record<string, string> = {
  '/reports/general': 'reportGeneralReport',
  '/reports/cost-apps': 'reportCostAppsNav',
  '/reports/tax': 'reportTax',
  '/reports/bank-statement': 'reportBankStatementAnalysis',
};

export default function ReportsLayout() {
  const { t } = useTranslation();
  const { user } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isGeneralReport = location.pathname === '/reports/general';

  const visibleLinks = useMemo(
    () =>
      REPORT_TAB_SEQUENCE.filter(({ required }) =>
        hasAnyOfPermissions(user?.role, required, user?.permissions),
      ),
    [user?.role, user?.permissions],
  );
  const activePath =
    visibleLinks.find(({ path }) => location.pathname === path || location.pathname.startsWith(`${path}/`))?.path ??
    visibleLinks[0]?.path ??
    '';
  const tabItems = useMemo(
    () =>
      visibleLinks.map(({ path }) => ({
        id: path,
        label: t(REPORT_TAB_LABELS[path] || 'reports'),
      })),
    [t, visibleLinks],
  );

  return (
    <ScreenShell variant="report">
      <div className="nx-reports-page-head">
        <ScreenTitle>{t('reports')}</ScreenTitle>
      </div>

      <div className="nx-reports-frame">
        {tabItems.length > 0 ? (
          <ScreenTabs
            items={tabItems}
            value={activePath}
            onChange={(path) => navigate(path)}
            compactMobile={false}
            animateContent={false}
            contentClassName={cn('nx-reports-content', isGeneralReport && 'nx-reports-content--general')}
          >
            <Outlet />
          </ScreenTabs>
        ) : (
          <div className={cn('nx-reports-content', isGeneralReport && 'nx-reports-content--general')}>
            <Outlet />
          </div>
        )}
      </div>
    </ScreenShell>
  );
}
