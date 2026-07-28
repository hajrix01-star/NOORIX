import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { Button, ScreenTabs, ScreenShell } from '../../ui';
import { SuppliersTab } from './components/SuppliersTab';
import { CategoriesTab } from './components/CategoriesTab';

const TABS = [
  { id: 'suppliers', labelKey: 'suppliersTab' },
  { id: 'categories', labelKey: 'categoriesTab' },
] as const;

type SupplierTabId = (typeof TABS)[number]['id'];

const SUPPLIER_TAB_IDS: SupplierTabId[] = TABS.map((tab) => tab.id);

export default function SuppliersScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const [activeTab, setActiveTab] = useTabSearchParam(SUPPLIER_TAB_IDS, 'suppliers');
  const [openSupplierCreateSignal, setOpenSupplierCreateSignal] = React.useState(0);
  const [openCategoryCreateSignal, setOpenCategoryCreateSignal] = React.useState(0);
  const activeCompany = companies.find((company) => company.id === companyId);
  const readyDirectoryAvailable = [activeCompany?.nameAr, activeCompany?.nameEn]
    .filter(Boolean)
    .map((name) => String(name).toLocaleLowerCase().replace(/[^a-z0-9]+/g, ''))
    .every((name) => name !== 'shamitax');

  const supplierTabItems = useMemo(
    () => TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
    [t],
  );
  const createButtonLabel = activeTab === 'categories' ? t('addCategory') : t('addSupplier');
  const handleOpenCreate = () => {
    if (activeTab === 'categories') {
      setOpenCategoryCreateSignal((value) => value + 1);
      return;
    }
    setOpenSupplierCreateSignal((value) => value + 1);
  };

  return (
    <ScreenShell variant="data">
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('suppliersAndCategoriesTitle')}</h1>
      </div>

      {!companyId && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {companyId && (
        <ScreenTabs
          items={supplierTabItems}
          value={activeTab}
          onChange={setActiveTab}
          contentClassName="nx-tab-content"
          tabBarEnd={(
            <Button size="sm" variant="primary" onClick={handleOpenCreate}>
              {createButtonLabel}
            </Button>
          )}
        >
          {activeTab === 'suppliers' && (
            <SuppliersTab
              companyId={companyId}
              readyDirectoryAvailable={readyDirectoryAvailable}
              openCreateSignal={openSupplierCreateSignal}
            />
          )}
          {activeTab === 'categories' && (
            <CategoriesTab
              companyId={companyId}
              openCreateSignal={openCategoryCreateSignal}
            />
          )}
        </ScreenTabs>
      )}
    </ScreenShell>
  );
}
