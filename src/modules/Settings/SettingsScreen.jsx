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

export default function SettingsScreen() {
  const { t } = useTranslation();
  const appContext     = useApp();
  const userRole       = appContext?.userRole;
  const setActiveCompany = typeof appContext?.setActiveCompany === 'function'
    ? appContext.setActiveCompany
    : () => {};

  const [activeTab, setActiveTab] = useState('companies');

  const TABS_BASE = useMemo(() => [
    { id: 'companies', label: t('companiesTab') },
    { id: 'tax',       label: t('taxTab') },
    { id: 'users',     label: t('usersTab'),    permission: 'MANAGE_USERS' },
    { id: 'roles',     label: t('rolesTab') },
    { id: 'backup',    label: t('backupTab') },
    { id: 'ai',        label: t('aiTab') },
  ], [t]);

  const TABS = useMemo(
    () => TABS_BASE.filter((tab) => !tab.permission || hasPermission(userRole, tab.permission)),
    [userRole, TABS_BASE],
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

      <div className="noorix-surface-card">
        {/* ── شريط التبويبات ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)', flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="noorix-btn-nav"
              onClick={() => setActiveTab(tab.id)}
              style={{
                margin: 0, borderRadius: 0, border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
                background:   activeTab === tab.id ? 'rgba(22,163,74,0.07)' : 'transparent',
                color:        activeTab === tab.id ? 'var(--noorix-accent-green)' : 'var(--noorix-text-muted)',
                fontWeight:   activeTab === tab.id ? 700 : 500,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── محتوى التبويب ── */}
        <div style={{ padding: 20 }}>
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
            <RolesTab userRole={userRole} />
          )}
          {activeTab === 'backup' && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
              {t('backupDesc')}
            </p>
          )}
          {activeTab === 'ai' && (
            <AISettingsTab />
          )}
        </div>
      </div>
    </div>
  );
}
