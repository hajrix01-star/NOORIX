/**
 * AppSidebar — القائمة الجانبية الرئيسية
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { hasPermission } from '../constants/permissions';
import {
  IconCrown,
  IconGrid,
  IconChat,
  IconCart,
  IconDocument,
  IconTruck,
  IconDollar,
  IconWallet,
  IconBox,
  IconPeople,
  IconChartBar,
  IconSettings,
} from './SidebarIcons';

const SIDEBAR_LINKS = [
  { to: '/owner', labelKey: 'ownerDashboard', icon: IconCrown, permission: 'VIEW_OWNER' },
  { to: '/', end: true, labelKey: 'dashboard', icon: IconGrid, permission: 'VIEW_DASHBOARD' },
  { to: '/chat', labelKey: 'smartChat', icon: IconChat, permission: 'VIEW_CHAT' },
  { to: '/sales', labelKey: 'sales', icon: IconCart, permission: 'VIEW_SALES' },
  { to: '/purchases', labelKey: 'purchases', icon: IconDocument, permission: 'VIEW_INVOICES' },
  { to: '/invoices', labelKey: 'invoices', icon: IconDocument, permission: 'VIEW_INVOICES' },
  { to: '/suppliers', labelKey: 'suppliersAndCategories', icon: IconTruck, permission: 'VIEW_SUPPLIERS' },
  { to: '/treasury', labelKey: 'vaults', icon: IconDollar, permission: 'VIEW_VAULTS' },
  { to: '/expenses', labelKey: 'fixedAndVariableExpenses', icon: IconWallet, permission: 'VIEW_EXPENSES' },
  { to: '/orders', labelKey: 'orders', icon: IconBox, permission: 'VIEW_ORDERS' },
  { to: '/hr', labelKey: 'hr', icon: IconPeople, permission: 'EMPLOYEES_READ' },
  { to: '/reports', labelKey: 'reports', icon: IconChartBar, permission: 'VIEW_REPORTS' },
  { to: '/settings', labelKey: 'settings', icon: IconSettings, permission: 'MANAGE_SETTINGS' },
  { to: '/theme-preview', labelKey: 'themePreview', icon: IconGrid, permission: 'VIEW_DASHBOARD' },
];

export default function AppSidebar({ isOpen, onClose, activeCompany, setActiveCompany, companies, userRole, userPermissions, showCompanySwitcher }) {
  const { t } = useTranslation();
  const navLinkClass = ({ isActive }) =>
    `app-nav-link${isActive ? ' app-nav-link--active' : ''}`;
  const visibleLinks = SIDEBAR_LINKS.filter((link) => hasPermission(userRole, link.permission, userPermissions));

  return (
    <>
      <aside className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`}>
        <div className="app-sidebar__header">
          <div className="app-sidebar__logo">
            <div className="app-sidebar__logo-mark">N</div>
            <div className="app-sidebar__title">
              <span className="app-sidebar__title-main">Noorix</span>
              <span className="app-sidebar__title-sub">{t('appTagline')}</span>
            </div>
          </div>
          <div style={{ width: '100%', marginTop: 8 }}>
            {(() => {
              const activeCo = companies.find((c) => c.id === activeCompany) || companies[0];
              const coName = activeCo?.nameAr || activeCo?.nameEn || '—';
              const initial = (activeCo?.nameAr || activeCo?.nameEn || '?')[0];
              return (
                <div style={{ position: 'relative' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    minHeight: 44,
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.9) 0%, rgba(16,163,74,0.7) 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: '-0.02em',
                    }}>
                      {initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 1 }}>{t('activeCompany')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coName}</div>
                    </div>
                    {showCompanySwitcher && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0 }}>
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  {showCompanySwitcher && (
                    <select
                      id="company-switcher"
                      value={activeCompany}
                      onChange={(e) => setActiveCompany(e.target.value)}
                      style={{
                        position: 'absolute', inset: 0, opacity: 0,
                        width: '100%', height: '100%', cursor: 'pointer',
                      }}
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.nameAr || c.nameEn || c.id}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="app-sidebar__nav">
          <ul className="app-nav-list">
            {visibleLinks.map((link) => (
              <li key={link.to + (link.end ? '-end' : '')} className="app-nav-item">
                <NavLink to={link.to} end={link.end} className={navLinkClass} onClick={onClose}>
                  <span className="app-nav-link__label">
                    <link.icon />
                    <span>{t(link.labelKey)}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="app-sidebar__footer">Noorix • Saudi Business • v0.1</div>
      </aside>
      {isOpen ? <div className="app-sidebar-backdrop" onClick={onClose} /> : null}
    </>
  );
}
