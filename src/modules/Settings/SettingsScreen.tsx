/**
 * SettingsScreen — الشاشة الرئيسية للإعدادات
 * - على الجوال (< 640px): قائمة منسدلة select بدلاً من شريط تبويبات
 * - على الديسكتوب: تبويبات متصلة (نفس النظام العام — ScreenTabs / ConnectedTabStrip)
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useIsMobile640 } from '../../hooks/useMediaQuery';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useQuery }        from '@tanstack/react-query';
import { getCompanies }    from '../../services/api';
import { useApp }          from '../../context/AppContext';
import { useTranslation }  from '../../i18n/useTranslation';
import { Input, ScreenShell, ScreenTitle, ScreenTabs } from '../../ui';
import { hasPermission }   from '../../constants/permissions';
import CompaniesTab        from './components/CompaniesTab';
import UsersTab            from './components/UsersTab';
import RolesTab            from './components/RolesTab';
import TaxSettingsTab      from './components/TaxSettingsTab';
import AISettingsTab       from './components/AISettingsTab';
import BackupTab           from './components/BackupTab';
import AppBrandingTab      from './components/AppBrandingTab';

export default function SettingsScreen() {
  const { t }           = useTranslation();
  const appContext      = useApp();
  const userRole        = appContext?.userRole;
  const userPermissions = appContext?.userPermissions || [];
  const language        = appContext?.language || 'ar';
  const setActiveCompany = typeof appContext?.setActiveCompany === 'function'
    ? appContext.setActiveCompany : () => {};

  const isMobile = useIsMobile640();
  const tabBarRef = useRef(null);

  const TABS_BASE = useMemo(() => [
    { id: 'companies', label: t('companiesTab') },
    { id: 'tax',       label: t('taxTab') },
    { id: 'users',     label: t('usersTab'),   permission: 'MANAGE_USERS' },
    { id: 'roles',     label: t('rolesTab') },
    { id: 'backup',    label: t('backupTab'),  permission: 'MANAGE_SETTINGS' },
    { id: 'ai',        label: t('aiTab') },
    { id: 'branding',  label: t('brandingTab') },
  ], [t]);

  const TABS = useMemo(
    () => TABS_BASE.filter((tab) => !tab.permission || hasPermission(userRole, tab.permission, userPermissions)),
    [userRole, userPermissions, TABS_BASE],
  );

  const allowedTabIds = useMemo(() => TABS.map((tab) => tab.id), [TABS]);
  const [activeTab, setActiveTab] = useTabSearchParam(allowedTabIds, 'companies');

  const tabItems = useMemo(
    () => TABS.map((tab) => ({ id: tab.id, label: tab.label })),
    [TABS],
  );

  useEffect(() => {
    if (isMobile || !tabBarRef.current) return;
    const el = tabBarRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [activeTab, isMobile]);

  const { data: companiesData = [] } = useQuery({
    queryKey:        ['companies', false],
    queryFn:         async () => {
      try { const r = await getCompanies(false); return Array.isArray(r?.data) ? r.data : []; }
      catch { return []; }
    },
    placeholderData: [],
    retry:           false,
  });
  const activeCompanies = companiesData.filter((c) => !c.isArchived);
  const activeLabel = TABS.find((x) => x.id === activeTab)?.label || '';

  const tabPanels = (
    <>
      {activeTab === 'companies' && <CompaniesTab onCompanyCreated={(id) => setActiveCompany(id)} />}
      {activeTab === 'tax'       && <TaxSettingsTab />}
      {activeTab === 'users'     && <UsersTab userRole={userRole} activeCompanies={activeCompanies} />}
      {activeTab === 'roles'     && <RolesTab userRole={userRole} language={language} />}
      {activeTab === 'backup'    && <BackupTab activeCompanies={activeCompanies} />}
      {activeTab === 'ai'        && <AISettingsTab />}
      {activeTab === 'branding'  && <AppBrandingTab />}
    </>
  );

  return (
    <ScreenShell>

      {/* ── عنوان الصفحة ── */}
      <div className="min-w-0">
        <ScreenTitle>الإعدادات</ScreenTitle>
        <p className="text-[13px] text-noorix-muted m-0 leading-relaxed">
          إدارة الشركات، المستخدمين، الأدوار والصلاحيات، وربط الذكاء الاصطناعي.
        </p>
      </div>

      {isMobile ? (
        <div className="noorix-surface-card overflow-hidden noorix-settings-card">
          <div className="noorix-settings-mobile-nav">
            <div className="noorix-settings-mobile-nav__label">{activeLabel}</div>
            <Input
              type="select"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="noorix-settings-mobile-nav__select"
            >
              {TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </Input>
            <span className="noorix-settings-mobile-nav__chevron">▾</span>
          </div>
          <div className="noorix-settings-tab-body">
            {tabPanels}
          </div>
        </div>
      ) : (
        <div ref={tabBarRef}>
          <ScreenTabs
            items={tabItems}
            value={activeTab}
            onChange={setActiveTab}
            shellClassName="noorix-settings-card"
            contentClassName="noorix-settings-tab-body"
            animateContent={false}
          >
            {tabPanels}
          </ScreenTabs>
        </div>
      )}
    </ScreenShell>
  );
}
