/**
 * SettingsScreen — الشاشة الرئيسية للإعدادات
 * - على الجوال (< 640px): قائمة منسدلة select بدلاً من شريط تبويبات
 * - على الديسكتوب: شريط تبويبات أفقي
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery }        from '@tanstack/react-query';
import { getCompanies }    from '../../services/api';
import { useApp }          from '../../context/AppContext';
import { useTranslation }  from '../../i18n/useTranslation';
import { Input, Button }   from '../../ui';
import { hasPermission }   from '../../constants/permissions';
import CompaniesTab        from './components/CompaniesTab';
import UsersTab            from './components/UsersTab';
import RolesTab            from './components/RolesTab';
import TaxSettingsTab      from './components/TaxSettingsTab';
import AISettingsTab       from './components/AISettingsTab';
import BackupTab           from './components/BackupTab';
import AppBrandingTab      from './components/AppBrandingTab';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export default function SettingsScreen() {
  const { t }           = useTranslation();
  const appContext      = useApp();
  const userRole        = appContext?.userRole;
  const userPermissions = appContext?.userPermissions || [];
  const language        = appContext?.language || 'ar';
  const setActiveCompany = typeof appContext?.setActiveCompany === 'function'
    ? appContext.setActiveCompany : () => {};

  const [activeTab, setActiveTab] = useState('companies');
  const isMobile = useIsMobile();
  const activeTabRef = useRef(null);

  const TABS_BASE = useMemo(() => [
    { id: 'companies', label: t('companiesTab') },
    { id: 'tax',       label: t('taxTab') },
    { id: 'users',     label: t('usersTab'),   permission: 'MANAGE_USERS' },
    { id: 'roles',     label: t('rolesTab') },
    { id: 'backup',    label: t('backupTab'),  permission: 'MANAGE_SETTINGS' },
    { id: 'ai',        label: t('aiTab') },
    { id: 'branding',  label: 'هوية التطبيق' },
  ], [t]);

  const TABS = useMemo(
    () => TABS_BASE.filter((tab) => !tab.permission || hasPermission(userRole, tab.permission, userPermissions)),
    [userRole, userPermissions, TABS_BASE],
  );

  // تمرير التبويب النشط للمنتصف (ديسكتوب فقط)
  useEffect(() => {
    if (!isMobile && activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
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
  const activeLabel = TABS.find((t) => t.id === activeTab)?.label || '';

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">

      {/* ── عنوان الصفحة ── */}
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">الإعدادات</h1>
        <p className="text-[13px] text-noorix-muted m-0">
          إدارة الشركات، المستخدمين، الأدوار والصلاحيات، وربط الذكاء الاصطناعي.
        </p>
      </div>

      <div className="noorix-surface-card noorix-settings-card">

        {/* ══ جوال: قائمة منسدلة ══════════════════════════════════════════ */}
        {isMobile && (
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
        )}

        {/* ══ ديسكتوب: شريط تبويبات ═══════════════════════════════════════ */}
        {!isMobile && (
          <div className="noorix-settings-tabstrip" role="tablist">
            {TABS.map((tab) => (
              <Button
                key={tab.id}
                ref={activeTab === tab.id ? activeTabRef : null}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className="noorix-settings-tab"
                onClick={() => setActiveTab(tab.id)}
                data-active={activeTab === tab.id ? 'true' : 'false'}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        )}

        {/* ══ محتوى التبويب ═══════════════════════════════════════════════ */}
        <div className="noorix-settings-tab-body">
          {activeTab === 'companies' && <CompaniesTab onCompanyCreated={(id) => setActiveCompany(id)} />}
          {activeTab === 'tax'       && <TaxSettingsTab />}
          {activeTab === 'users'     && <UsersTab userRole={userRole} activeCompanies={activeCompanies} />}
          {activeTab === 'roles'     && <RolesTab userRole={userRole} language={language} />}
          {activeTab === 'backup'    && <BackupTab activeCompanies={activeCompanies} />}
          {activeTab === 'ai'        && <AISettingsTab />}
          {activeTab === 'branding'  && <AppBrandingTab />}
        </div>
      </div>
    </div>
  );
}
