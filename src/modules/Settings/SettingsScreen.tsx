import React, { useMemo, useEffect, useRef, type ChangeEvent } from 'react';
import { useIsMobile640 } from '../../ui';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useApiListQuery } from '../../hooks/useApiQuery';
import { getCompanies } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Input, ScreenShell, ScreenTitle, ScreenTabs } from '../../ui';
import CompaniesTab from './components/CompaniesTab';
import UsersTab from './components/UsersTab';
import RolesTab from './components/RolesTab';
import TaxSettingsTab from './components/TaxSettingsTab';
import AISettingsTab from './components/AISettingsTab';
import BackupTab from './components/BackupTab';
import AppBrandingTab from './components/AppBrandingTab';
import { appKeys } from '../../services/queryKeys';
import type { SettingsCompany } from './settingsTypes';
import {
  buildSettingsTabs,
  filterActiveSettingsCompanies,
  filterSettingsTabs,
  getSettingsActiveLabel,
  getSettingsTabIds,
  getSettingsTabItems,
} from './settingsScreenModel';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const appContext = useApp();
  const userRole = appContext?.userRole;
  const userPermissions = appContext?.userPermissions || [];
  const language = appContext?.language || 'ar';
  const setActiveCompany = typeof appContext?.setActiveCompany === 'function'
    ? appContext.setActiveCompany
    : undefined;

  const isMobile = useIsMobile640();
  const tabBarRef = useRef<HTMLDivElement>(null);

  const baseTabs = useMemo(() => buildSettingsTabs(t), [t]);
  const tabs = useMemo(
    () => filterSettingsTabs(baseTabs, userRole, userPermissions),
    [baseTabs, userRole, userPermissions],
  );

  const allowedTabIds = useMemo(() => getSettingsTabIds(tabs), [tabs]);
  const [activeTab, setActiveTab] = useTabSearchParam(allowedTabIds, 'companies');

  const tabItems = useMemo(() => getSettingsTabItems(tabs), [tabs]);

  useEffect(() => {
    if (isMobile || !tabBarRef.current) return;
    const activeElement = tabBarRef.current.querySelector('[data-active="true"]');
    activeElement?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [activeTab, isMobile]);

  const { data: companiesData = [] } = useApiListQuery<SettingsCompany>({
    queryKey: appKeys.companies(false),
    queryFn: () => getCompanies(false),
    fallbackMessage: t('loadingError'),
    placeholderData: [],
    retry: false,
  });
  const activeCompanies = filterActiveSettingsCompanies(companiesData);
  const activeLabel = getSettingsActiveLabel(tabs, activeTab);

  const tabPanels = (
    <>
      {activeTab === 'companies' && (
        <CompaniesTab
          onCompanyCreated={(id) => {
            if (typeof id === 'string') setActiveCompany?.(id);
          }}
          userRole={userRole}
          userPermissions={userPermissions}
        />
      )}
      {activeTab === 'tax' && <TaxSettingsTab />}
      {activeTab === 'users' && <UsersTab userRole={userRole} activeCompanies={activeCompanies} />}
      {activeTab === 'roles' && <RolesTab userRole={userRole} language={language} />}
      {activeTab === 'backup' && <BackupTab activeCompanies={activeCompanies} />}
      {activeTab === 'ai' && <AISettingsTab />}
      {activeTab === 'branding' && <AppBrandingTab />}
    </>
  );

  return (
    <ScreenShell>
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
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setActiveTab(event.target.value)}
              className="noorix-settings-mobile-nav__select"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </Input>
            <span className="noorix-settings-mobile-nav__chevron">▼</span>
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
