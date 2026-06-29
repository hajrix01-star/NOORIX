/**
 * AppSidebar — القائمة الجانبية الرئيسية
 */
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, type NavLinkRenderProps } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { hasPermission, hasAnyOfPermissions, HR_APP_ACCESS, SETTINGS_APP_ACCESS, INVOICES_ROUTE_ACCESS, REPORTS_APP_ACCESS, REPORTS_GENERAL_ACCESS, REPORTS_COST_APPS_ACCESS, REPORTS_TAX_ACCESS, REPORTS_BANK_ACCESS, HAJRI_TAX_APP_ACCESS, ASSETS_APP_ACCESS, ORDERS_APP_ACCESS } from '../constants/permissions';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { canAccessThemePreview } from '../utils/themePreviewAccess';
import { getBrandName, getBrandLogo, getBrandTagline } from '../utils/appBranding';
import { Button } from '../ui';
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
  IconMonitor,
} from './SidebarIcons';

const SIDEBAR_LINKS = [
  { to: '/owner', labelKey: 'ownerDashboard', icon: IconCrown, permission: 'VIEW_OWNER' },
  { to: '/', end: true, labelKey: 'dashboard', icon: IconGrid, permission: 'VIEW_DASHBOARD' },
  { to: '/chat', labelKey: 'smartChat', icon: IconChat, permission: 'VIEW_CHAT' },
  { to: '/sales', labelKey: 'sales', icon: IconCart, permission: 'VIEW_SALES' },
  { to: '/purchases', labelKey: 'purchases', icon: IconDocument, permission: 'VIEW_PURCHASES' },
  { to: '/invoices', labelKey: 'invoices', icon: IconDocument, permission: INVOICES_ROUTE_ACCESS },
  { to: '/suppliers', labelKey: 'suppliersAndCategories', icon: IconTruck, permission: 'VIEW_SUPPLIERS' },
  { to: '/treasury', labelKey: 'vaults', icon: IconDollar, permission: 'VIEW_VAULTS' },
  { to: '/expenses', labelKey: 'fixedAndVariableExpenses', icon: IconWallet, permission: 'VIEW_EXPENSES' },
  { to: '/assets', labelKey: 'assetsRegister', icon: IconMonitor, permission: ASSETS_APP_ACCESS },
  { to: '/orders', labelKey: 'orders', icon: IconBox, permission: ORDERS_APP_ACCESS },
  { to: '/hr', labelKey: 'hr', icon: IconPeople, permission: HR_APP_ACCESS },
  { to: '/hajri-tax', labelKey: 'hajriTax', icon: IconDocument, permission: HAJRI_TAX_APP_ACCESS },
  {
    to: '/reports',
    labelKey: 'reports',
    icon: IconChartBar,
    permission: REPORTS_APP_ACCESS,
    children: [
      { to: '/reports/general', labelKey: 'reportGeneralReport', icon: IconChartBar, permission: REPORTS_GENERAL_ACCESS },
      { to: '/reports/cost-apps', labelKey: 'reportCostAppsNav', icon: IconChartBar, permission: REPORTS_COST_APPS_ACCESS },
      { to: '/reports/tax', labelKey: 'reportTax', icon: IconDocument, permission: REPORTS_TAX_ACCESS },
      { to: '/reports/bank-statement', labelKey: 'reportBankStatementAnalysis', icon: IconChartBar, permission: REPORTS_BANK_ACCESS },
    ],
  },
  { to: '/settings', labelKey: 'settings', icon: IconSettings, permission: SETTINGS_APP_ACCESS },
  { to: '/theme-preview', labelKey: 'themePreview', icon: IconGrid, permission: 'VIEW_DASHBOARD' },
] as const;

export type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userPermissions?: string[];
};

export default function AppSidebar({ isOpen, onClose, userRole, userPermissions }: AppSidebarProps) {
  const { t, lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const navLinkClass = ({ isActive }: NavLinkRenderProps) =>
    `app-nav-link${isActive ? ' app-nav-link--active' : ''}`;
  const visibleLinks = SIDEBAR_LINKS.filter((link) => {
    if (link.to === '/theme-preview' && !canAccessThemePreview(userRole)) return false;
    if ((link as { ownerOnly?: boolean }).ownerOnly && String(userRole || '').toLowerCase() !== 'owner') return false;
    const p = link.permission as string | readonly string[];
    if (Array.isArray(p)) return hasAnyOfPermissions(userRole, p as readonly string[], userPermissions);
    return hasPermission(userRole, p, userPermissions);
  });

  const isReportsExpanded = visibleLinks.some((l: any) => l.to === '/reports' && l.children?.some((c: any) => location.pathname.startsWith(c.to)));
  const [reportsOpen, setReportsOpen] = useState(isReportsExpanded);
  useEffect(() => {
    if (isReportsExpanded) setReportsOpen(true);
  }, [isReportsExpanded]);

  const [brandName,    setBrandName]    = useState(() => getBrandName(lang));
  const [brandLogo,    setBrandLogo]    = useState(getBrandLogo);
  const [brandTagline, setBrandTagline] = useState(() => getBrandTagline(lang));

  useEffect(() => {
    setBrandName(getBrandName(lang));
    setBrandTagline(getBrandTagline(lang));
  }, [lang]);

  useEffect(() => {
    const refresh = () => {
      setBrandName(getBrandName(lang));
      setBrandLogo(getBrandLogo());
      setBrandTagline(getBrandTagline(lang));
    };
    window.addEventListener('noorix:branding-changed', refresh);
    return () => window.removeEventListener('noorix:branding-changed', refresh);
  }, [lang]);

  const handleReportsParentClick = () => {
    if (reportsOpen) {
      setReportsOpen(false);
    } else {
      setReportsOpen(true);
      navigate('/reports');
      onClose();
    }
  };

  return (
    <>
      <aside className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`}>
        <div className="app-sidebar__header">
          <div className="app-sidebar__logo">
            <div
              className="app-sidebar__logo-mark"
              style={brandLogo ? { padding: 0, overflow: 'hidden' } : {}}
            >
              {brandLogo
                ? <img src={brandLogo} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                : (brandName?.[0] || 'N')
              }
            </div>
            <div className="app-sidebar__title">
              <span className="app-sidebar__title-main">{brandName}</span>
              <span className="app-sidebar__title-sub">{brandTagline}</span>
            </div>
            {isOpen && (
              <Button
                variant="ghost"
                className="ms-auto !text-white/70 hover:!text-white hover:!bg-white/10"
                onClick={onClose}
                aria-label={t('close')}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        <div className="app-sidebar__nav">
          <ul className="app-nav-list">
            {visibleLinks.map((link: any) =>
              link.children && link.to === '/reports' ? (
                <li key={link.to} className="app-nav-item app-nav-item--has-children">
                  <Button
                    variant="ghost"
                    className={`app-nav-link${location.pathname.startsWith(link.to) ? ' app-nav-link--active' : ''}`}
                    onClick={handleReportsParentClick}
                  >
                    <span className="app-nav-link__label">
                      <link.icon />
                      <span>{t(link.labelKey)}</span>
                    </span>
                    <span className="app-nav-link__chevron" aria-hidden>{reportsOpen ? '▾' : '▸'}</span>
                  </Button>
                  {reportsOpen && (
                    <ul className="app-nav-list app-nav-list--nested">
                      {link.children
                        .filter((child: { permission?: string | readonly string[] }) => {
                          const cp = child.permission;
                          if (!cp) return true;
                          if (Array.isArray(cp)) return hasAnyOfPermissions(userRole, cp, userPermissions);
                          return hasPermission(userRole, cp, userPermissions);
                        })
                        .map((child: any) => (
                        <li key={child.to} className="app-nav-item">
                          <NavLink
                            to={child.to}
                            className={navLinkClass}
                            onClick={onClose}
                            onPointerEnter={() => prefetchRouteChunk(child.to)}
                            onPointerDown={() => prefetchRouteChunk(child.to)}
                            onFocus={() => prefetchRouteChunk(child.to)}
                          >
                            <span className="app-nav-link__label">
                              <child.icon />
                              <span>{t(child.labelKey)}</span>
                            </span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={link.to + (link.end ? '-end' : '')} className="app-nav-item">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={navLinkClass}
                    onClick={onClose}
                    onPointerEnter={() => prefetchRouteChunk(link.to)}
                    onPointerDown={() => prefetchRouteChunk(link.to)}
                    onFocus={() => prefetchRouteChunk(link.to)}
                  >
                    <span className="app-nav-link__label">
                      <link.icon />
                      <span>{t(link.labelKey)}</span>
                    </span>
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="app-sidebar__footer">{brandName} • {brandTagline}</div>
      </aside>

      {isOpen && <div className="app-sidebar-backdrop" onClick={onClose} />}
    </>
  );
}
