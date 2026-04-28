/**
 * AppSidebar — القائمة الجانبية الرئيسية
 */
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, type NavLinkRenderProps } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { hasPermission } from '../constants/permissions';
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
  IconOcr,
  IconSettings,
  IconMonitor,
} from './SidebarIcons';

const SIDEBAR_LINKS = [
  { to: '/owner', labelKey: 'ownerDashboard', icon: IconCrown, permission: 'VIEW_OWNER' },
  { to: '/', end: true, labelKey: 'dashboard', icon: IconGrid, permission: 'VIEW_DASHBOARD' },
  { to: '/chat', labelKey: 'smartChat', icon: IconChat, permission: 'VIEW_CHAT' },
  { to: '/sales', labelKey: 'sales', icon: IconCart, permission: 'VIEW_SALES' },
  { to: '/purchases', labelKey: 'purchases', icon: IconDocument, permission: 'VIEW_PURCHASES' },
  { to: '/invoices', labelKey: 'invoices', icon: IconDocument, permission: 'VIEW_INVOICES' },
  { to: '/suppliers', labelKey: 'suppliersAndCategories', icon: IconTruck, permission: 'VIEW_SUPPLIERS' },
  { to: '/treasury', labelKey: 'vaults', icon: IconDollar, permission: 'VIEW_VAULTS' },
  { to: '/expenses', labelKey: 'fixedAndVariableExpenses', icon: IconWallet, permission: 'VIEW_EXPENSES' },
  { to: '/assets', labelKey: 'assetsRegister', icon: IconMonitor, permission: 'VIEW_EXPENSES' },
  { to: '/orders', labelKey: 'orders', icon: IconBox, permission: 'VIEW_ORDERS' },
  { to: '/hr', labelKey: 'hr', icon: IconPeople, permission: 'VIEW_EMPLOYEES' },
  { to: '/hajri-tax', labelKey: 'hajriTax', icon: IconDocument, permission: 'VIEW_REPORTS' },
  {
    to: '/reports',
    labelKey: 'reports',
    icon: IconChartBar,
    permission: 'VIEW_REPORTS',
    children: [
      { to: '/reports/general', labelKey: 'reportGeneralReport', icon: IconChartBar },
      { to: '/reports/tax', labelKey: 'reportTax', icon: IconDocument },
      { to: '/reports/bank-statement', labelKey: 'reportBankStatementAnalysis', icon: IconChartBar },
    ],
  },
  { to: '/ocr', labelKey: 'ocrTitle', icon: IconOcr, permission: 'VIEW_OCR' },
  { to: '/ocr/cashier', labelKey: 'ocrCashierSubmitNav', icon: IconOcr, permission: 'OCR_SUBMIT' },
  { to: '/settings', labelKey: 'settings', icon: IconSettings, permission: 'MANAGE_SETTINGS' },
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
    return hasPermission(userRole, link.permission, userPermissions);
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
                      {link.children.map((child: any) => (
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
