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
  const navClass = ({ isActive }) => `noorix-btn-nav${isActive ? ' noorix-btn-nav--active' : ''}`;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('reports')}</h1>
        <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)', maxWidth: 900 }}>{t('reportsDesc')}</p>
      </div>

      <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="noorix-tab-bar" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)' }}>
          {REPORT_SUB_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={navClass}
              style={({ isActive }) => ({
                margin: 0,
                borderRadius: 0,
                border: 'none',
                borderBottom: isActive ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
                background: isActive ? 'rgba(37,99,235,0.07)' : 'transparent',
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
        <div style={{ padding: 24 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function ReportsIndexRedirect() {
  return <Navigate to="/reports/general" replace />;
}
