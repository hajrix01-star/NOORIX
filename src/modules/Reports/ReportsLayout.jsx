/**
 * ReportsLayout — إطار التقارير مع قائمة فرعية شجرية
 * يعرض: التقرير العام | الضريبي | تحليل كشف الحسابات
 */
import React from 'react';
import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';

const REPORT_SUB_LINKS = [
  { to: '/reports/general', labelKey: 'reportGeneralReport' },
  { to: '/reports/tax', labelKey: 'reportTax' },
  { to: '/reports/bank-statement', labelKey: 'reportBankStatementAnalysis' },
];

export default function ReportsLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('reports')}</h1>
      </div>

      <div className="noorix-surface-card p-0 overflow-hidden">
        <div className="noorix-tab-bar flex gap-0 border-b border-noorix-border overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {REPORT_SUB_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                margin: 0,
                borderRadius: 0,
                border: 'none',
                borderBottom: isActive ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
                background: isActive ? 'var(--noorix-blue-7)' : 'transparent',
                color: isActive ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
                fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                padding: '12px 18px',
                textDecoration: 'none',
              })}
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function ReportsIndexRedirect() {
  return <Navigate to="/reports/general" replace />;
}
