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
  { to: '/expenses', labelKey: 'fixedAndVariableExpenses', icon: IconWallet, permission: 'VIEW_VAULTS' },
  { to: '/orders', labelKey: 'orders', icon: IconBox, permission: 'VIEW_SALES' },
  { to: '/hr', labelKey: 'hr', icon: IconPeople, permission: 'EMPLOYEES_READ' },
  { to: '/reports', labelKey: 'reports', icon: IconChartBar, permission: 'VIEW_REPORTS' },
  { to: '/settings', labelKey: 'settings', icon: IconSettings, permission: 'MANAGE_SETTINGS' },
  { to: '/theme-preview', labelKey: 'themePreview', icon: IconGrid, permission: 'VIEW_DASHBOARD' },
];

export default function AppSidebar({ isOpen, onClose, activeCompany, setActiveCompany, companies, userRole, showCompanySwitcher }) {
  const { t } = useTranslation();
  const navLinkClass = ({ isActive }) =>
    `app-nav-link${isActive ? ' app-nav-link--active' : ''}`;
  const visibleLinks = SIDEBAR_LINKS.filter((link) => hasPermission(userRole, link.permission));

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
          <div style={{ width: '100%', marginTop: 4 }}>
            <label className="app-sidebar__section-label" style={{ display: 'block', marginBottom: 4 }}>
              {t('activeCompany')}
            </label>
            {showCompanySwitcher ? (
              <select
                id="company-switcher"
                value={activeCompany}
                onChange={(e) => setActiveCompany(e.target.value)}
                className="app-sidebar-select"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.nameAr || c.nameEn || c.id}</option>
                ))}
              </select>
            ) : (
              <div className="app-sidebar-select" style={{ cursor: 'default', opacity: 0.9 }}>
                {companies.find((c) => c.id === activeCompany)?.nameAr || companies[0]?.nameAr || '—'}
              </div>
            )}
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
