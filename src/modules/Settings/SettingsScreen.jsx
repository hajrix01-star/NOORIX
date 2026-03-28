/**
 * SettingsScreen — الشاشة الرئيسية للإعدادات
 * مسؤولية واحدة: تبديل التبويبات وتمرير الـ context للمكونات الفرعية.
 *
 * التبويبات:
 *   CompaniesTab → إدارة الشركات
 *   UsersTab     → المستخدمون والأدوار
 *   RolesTab     → الأدوار والصلاحيات
 */
import React, { useState, useMemo } from 'react';
import { useQuery }             from '@tanstack/react-query';
import { getCompanies }         from '../../services/api';
import { useApp }               from '../../context/AppContext';
import { useTranslation }      from '../../i18n/useTranslation';
import { hasPermission }        from '../../constants/permissions';
import CompaniesTab             from './components/CompaniesTab';
import UsersTab                 from './components/UsersTab';
import RolesTab                 from './components/RolesTab';
import TaxSettingsTab           from './components/TaxSettingsTab';
import AISettingsTab            from './components/AISettingsTab';
import BackupTab                from './components/BackupTab';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const appContext     = useApp();
  const userRole       = appContext?.userRole;
  const userPermissions = appContext?.userPermissions || [];
  const language       = appContext?.language || 'ar';
  const setActiveCompany = typeof appContext?.setActiveCompany === 'function'
    ? appContext.setActiveCompany
    : () => {};

  const [activeTab, setActiveTab] = useState('companies');

  const TABS_BASE = useMemo(() => [
    { id: 'companies', label: t('companiesTab') },
    { id: 'tax',       label: t('taxTab') },
    { id: 'users',     label: t('usersTab'),    permission: 'MANAGE_USERS' },
    { id: 'roles',     label: t('rolesTab') },
    { id: 'backup',    label: t('backupTab'), permission: 'MANAGE_SETTINGS' },
    { id: 'ai',        label: t('aiTab') },
  ], [t]);

  const TABS = useMemo(
    () => TABS_BASE.filter((tab) => !tab.permission || hasPermission(userRole, tab.permission, userPermissions)),
    [userRole, userPermissions, TABS_BASE],
  );

  // جلب الشركات مشتركاً بين CompaniesTab و UsersTab
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>الإعدادات</h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          إدارة الشركات، المستخدمين، الأدوار والصلاحيات، وربط الذكاء الاصطناعي.
        </p>
      </div>

      <div className="noorix-surface-card noorix-settings-card">
        {/* ── شريط التبويبات (قابل للتمرير أفقياً على الجوال) ── */}
        <div className="noorix-settings-tabstrip">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="noorix-settings-tab"
              onClick={() => setActiveTab(tab.id)}
              data-active={activeTab === tab.id ? 'true' : 'false'}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── محتوى التبويب ── */}
        <div className="noorix-settings-tab-body">
          {activeTab === 'companies' && (
            <CompaniesTab onCompanyCreated={(id) => setActiveCompany(id)} />
          )}
          {activeTab === 'tax' && (
            <TaxSettingsTab />
          )}
          {activeTab === 'users' && (
            <UsersTab userRole={userRole} activeCompanies={activeCompanies} />
          )}
          {activeTab === 'roles' && (
            <RolesTab userRole={userRole} language={language} />
          )}
          {activeTab === 'backup' && (
            <BackupTab activeCompanies={activeCompanies} />
          )}
          {activeTab === 'ai' && (
            <AISettingsTab />
          )}
        </div>
      </div>
    </div>
  );
}
