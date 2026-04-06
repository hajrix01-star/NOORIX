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
} from './SidebarIcons';

// VIEW_EMPLOYEES يتحكم في ظهور صفحة الموارد البشرية في القائمة
// EMPLOYEES_READ يتحكم في قراءة بيانات الموظفين (للمحادثة الذكية وغيرها) بدون ظهور الصفحة
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

  // ── البراندينج ─────────────────────────────────────────────────────────────
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

  // ── تبديل الشركة مع تأكيد ──────────────────────────────────────────────────
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
    const onClose = () => setCoDropOpen(false);
    const onMouseDown = (e) => {
      if (!coDropBtnRef.current?.contains(e.target) && !coDropMenuRef.current?.contains(e.target)) {
        setCoDropOpen(false);
      }
    };
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
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
            <div className="app-sidebar__logo-mark" style={brandLogo ? { padding: 0, overflow: 'hidden' } : {}}>
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
                className="nx-shell-icon-btn app-sidebar__close-btn"
                onClick={onClose}
                aria-label={t('close')}
                style={{ marginInlineStart: 'auto' }}
              >
                ✕
              </Button>
            )}
          </div>
          <div style={{ width: '100%', marginTop: 8 }}>
            <div style={{ position: 'relative' }}>
              <Button
                ref={coDropBtnRef}
                onClick={showCompanySwitcher ? () => { updateCoDropPos(); setCoDropOpen((v) => !v); } : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  minHeight: 44, cursor: showCompanySwitcher ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: activeCo?.logoUrl ? 'transparent' : 'linear-gradient(135deg, rgba(37,99,235,0.9) 0%, rgba(16,163,74,0.7) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: '-0.02em',
                  overflow: 'hidden',
                }}>
                  {activeCo?.logoUrl
                    ? <img src={activeCo.logoUrl} alt={coName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initial
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 1 }}>{t('activeCompany')}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coName}</div>
                </div>
                {showCompanySwitcher && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0, transition: 'transform 150ms', transform: coDropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </Button>
              {showCompanySwitcher && coDropOpen && createPortal(
                <div
                  ref={coDropMenuRef}
                  role="listbox"
                  style={{
                    position: 'fixed', zIndex: 99999,
                    top: coDropPos.top, left: coDropPos.left,
                    width: coDropPos.width, maxHeight: 240,
                    overflowY: 'auto', borderRadius: 10,
                    background: 'var(--noorix-bg-surface)',
                    border: '1px solid var(--noorix-border)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                  }}
                >
                  {companies.map((c) => {
                    const cName = lang === 'en' ? (c.nameEn || c.nameAr) : (c.nameAr || c.nameEn) || c.id;
                    const isActive = c.id === activeCompany;
                    return (
                      <Button
                        key={c.id}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleCompanySelect(c.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', borderRadius: 0,
                          background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                          borderBottom: '1px solid var(--noorix-border)',
                          textAlign: 'start', justifyContent: 'flex-start',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? 'var(--noorix-accent-blue)' : 'var(--noorix-text)',
                          fontSize: 13, minHeight: 'unset',
                        }}
                      >
                        {isActive && <span style={{ fontSize: 10 }}>✓</span>}
                        {cName}
                      </Button>
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
                      <span style={{ marginInlineStart: 'auto', fontSize: 10, opacity: 0.8 }}>{reportsOpen ? '▾' : '▸'}</span>
                    </span>
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
      {isOpen ? <div className="app-sidebar-backdrop" onClick={onClose} /> : null}

      {/* نافذة تأكيد تبديل الشركة */}
      {pendingCompany && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,20,50,0.65)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'var(--noorix-bg-surface, #fff)',
            border: '1px solid var(--noorix-border, #e5e7eb)',
            borderRadius: 16,
            padding: '28px 32px',
            maxWidth: 380, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}></div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--noorix-text, #111)' }}>
              {t('switchCompanyConfirmTitle')}
            </div>
            <div style={{ fontSize: 14, color: 'var(--noorix-text-muted, #6b7280)', marginBottom: 24, lineHeight: 1.6 }}>
              {t('switchCompanyConfirmBody')} <strong style={{ color: 'var(--noorix-text, #111)' }}>{pendingName}</strong>؟
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button onClick={cancelSwitch} style={{ flex: 1 }}>
                {t('cancel')}
              </Button>
              <Button variant="primary" onClick={confirmSwitch} style={{ flex: 1 }}>
                {t('switchCompanyConfirmBtn')}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
