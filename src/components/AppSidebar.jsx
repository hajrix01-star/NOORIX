/**
 * AppSidebar — القائمة الجانبية الرئيسية
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { hasPermission } from '../constants/permissions';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { getBrandName, getBrandLogo, getBrandTagline } from '../utils/appBranding';
import { Button, Modal } from '../ui';
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
  { to: '/hr', labelKey: 'hr', icon: IconPeople, permission: 'VIEW_EMPLOYEES' },
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
  { to: '/settings', labelKey: 'settings', icon: IconSettings, permission: 'MANAGE_SETTINGS' },
  { to: '/theme-preview', labelKey: 'themePreview', icon: IconGrid, permission: 'VIEW_DASHBOARD' },
];

export default function AppSidebar({ isOpen, onClose, activeCompany, setActiveCompany, companies, userRole, userPermissions, showCompanySwitcher }) {
  const { t, lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const navLinkClass = ({ isActive }) =>
    `app-nav-link${isActive ? ' app-nav-link--active' : ''}`;
  const visibleLinks = SIDEBAR_LINKS.filter((link) => hasPermission(userRole, link.permission, userPermissions));

  const isReportsExpanded = visibleLinks.some((l) => l.children?.some((c) => location.pathname.startsWith(c.to)));
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

  const [pendingCompany, setPendingCompany] = useState(null);
  const pendingCo = pendingCompany ? companies.find((c) => c.id === pendingCompany) : null;
  const pendingName = pendingCo
    ? (lang === 'en' ? pendingCo.nameEn || pendingCo.nameAr : pendingCo.nameAr || pendingCo.nameEn) || '—'
    : '';

  const handleCompanySelect = (newId) => {
    if (newId && newId !== activeCompany) {
      setPendingCompany(newId);
    }
    setCoDropOpen(false);
  };

  const [coDropOpen, setCoDropOpen] = useState(false);
  const coDropBtnRef = useRef(null);
  const coDropMenuRef = useRef(null);
  const [coDropPos, setCoDropPos] = useState({ top: 0, left: 0, width: 220 });

  const updateCoDropPos = useCallback(() => {
    const el = coDropBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
  }, []);

  useEffect(() => {
    if (!coDropOpen) return undefined;
    updateCoDropPos();
    const handleClose = () => setCoDropOpen(false);
    const onMouseDown = (e) => {
      if (!coDropBtnRef.current?.contains(e.target) && !coDropMenuRef.current?.contains(e.target)) {
        setCoDropOpen(false);
      }
    };
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [coDropOpen, updateCoDropPos]);

  const confirmSwitch = () => {
    if (pendingCompany) {
      setActiveCompany(pendingCompany);
      setPendingCompany(null);
      onClose();
    }
  };

  const cancelSwitch = () => setPendingCompany(null);

  const handleReportsParentClick = () => {
    if (reportsOpen) {
      setReportsOpen(false);
    } else {
      setReportsOpen(true);
      navigate('/reports');
      onClose();
    }
  };

  const activeCo = companies.find((c) => c.id === activeCompany) || companies[0];
  const coName = lang === 'en'
    ? (activeCo?.nameEn || activeCo?.nameAr || '—')
    : (activeCo?.nameAr || activeCo?.nameEn || '—');
  const initial = coName[0] || '?';

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

          {/* مبدّل الشركة */}
          <div className="w-full mt-2">
            <div className="relative">
              <button
                ref={coDropBtnRef}
                type="button"
                onClick={showCompanySwitcher ? () => { updateCoDropPos(); setCoDropOpen((v) => !v); } : undefined}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] min-h-[44px] transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  cursor: showCompanySwitcher ? 'pointer' : 'default',
                }}
              >
                <div
                  className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-white font-extrabold text-[13px] shrink-0 overflow-hidden"
                  style={{
                    background: activeCo?.logoUrl
                      ? 'transparent'
                      : 'linear-gradient(135deg, var(--noorix-blue-90) 0%, var(--noorix-green-50) 100%)',
                  }}
                >
                  {activeCo?.logoUrl
                    ? <img src={activeCo.logoUrl} alt={coName} className="w-full h-full object-cover" />
                    : initial
                  }
                </div>
                <div className="flex-1 text-start min-w-0">
                  <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 1 }}>{t('activeCompany')}</div>
                  <div className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>{coName}</div>
                </div>
                {showCompanySwitcher && (
                  <svg
                    viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"
                    width="14" height="14"
                    className="shrink-0 transition-transform duration-150"
                    style={{ transform: coDropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {showCompanySwitcher && coDropOpen && createPortal(
                <div
                  ref={coDropMenuRef}
                  role="listbox"
                  className="fixed bg-noorix-surface rounded-[10px] border border-noorix-border overflow-y-auto"
                  style={{
                    zIndex: 99999,
                    top: coDropPos.top,
                    left: coDropPos.left,
                    width: coDropPos.width,
                    maxHeight: 240,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                  }}
                >
                  {companies.map((c) => {
                    const cName = lang === 'en' ? (c.nameEn || c.nameAr) : (c.nameAr || c.nameEn) || c.id;
                    const isActive = c.id === activeCompany;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleCompanySelect(c.id)}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-start border-b border-noorix-border last:border-b-0 transition-colors hover:bg-noorix-bg-muted"
                        style={{
                          background: isActive ? 'var(--noorix-blue-8)' : 'transparent',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? 'var(--noorix-accent-blue)' : 'var(--noorix-text)',
                          fontSize: 13,
                        }}
                      >
                        {isActive && <span className="text-[10px]">✓</span>}
                        {cName}
                      </button>
                    );
                  })}
                </div>,
                document.body,
              )}
            </div>
          </div>
        </div>

        <div className="app-sidebar__nav">
          <ul className="app-nav-list">
            {visibleLinks.map((link) =>
              link.children ? (
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
                      {link.children.map((child) => (
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

      {/* نافذة تأكيد تبديل الشركة */}
      <Modal
        open={!!pendingCompany}
        onClose={cancelSwitch}
        size="sm"
        title={t('switchCompanyConfirmTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={cancelSwitch}>{t('cancel')}</Button>
            <Button variant="primary" onClick={confirmSwitch}>{t('switchCompanyConfirmBtn')}</Button>
          </>
        }
      >
        <div className="text-center mb-2 text-[36px]"></div>
        <p className="m-0 text-[14px] text-noorix-text leading-relaxed">
          {t('switchCompanyConfirmBody')} <strong>{pendingName}</strong>؟
        </p>
      </Modal>
    </>
  );
}
