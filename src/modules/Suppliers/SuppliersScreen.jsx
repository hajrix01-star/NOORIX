/**
 * SuppliersScreen — الموردين والتصنيفات
 * تبويبتان: موردين | تصنيفات
 */
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenTabs } from '../../ui';
import { SuppliersTab } from './components/SuppliersTab';
import { CategoriesTab } from './components/CategoriesTab';

const TABS = [
  { id: 'suppliers',  labelKey: 'suppliersTab'  },
  { id: 'categories', labelKey: 'categoriesTab' },
];

export default function SuppliersScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const [activeTab, setActiveTab] = useState('suppliers');

  const supplierTabItems = useMemo(
    () => TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
    [t],
  );

  return (
    <div className="flex flex-col gap-4 py-4 px-0 md:px-3 lg:px-6">
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('suppliersAndCategoriesTitle')}</h1>
      </div>

      {!companyId && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {companyId && (
        <>
          <ScreenTabs
            variant="underline"
            items={supplierTabItems}
            value={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === 'suppliers'  && <SuppliersTab  companyId={companyId} />}
          {activeTab === 'categories' && <CategoriesTab companyId={companyId} />}
        </>
      )}
    </div>
  );
}
