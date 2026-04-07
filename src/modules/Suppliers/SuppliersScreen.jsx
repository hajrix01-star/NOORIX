/**
 * SuppliersScreen — الموردين والتصنيفات
 * تبويبتان: موردين | تصنيفات
 */
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../ui';
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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
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
          <div className="nx-tab-bar">
            {TABS.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                className={`nx-tab-btn${activeTab === tab.id ? ' nx-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {t(tab.labelKey)}
              </Button>
            ))}
          </div>

          {activeTab === 'suppliers'  && <SuppliersTab  companyId={companyId} />}
          {activeTab === 'categories' && <CategoriesTab companyId={companyId} />}
        </>
      )}
    </div>
  );
}
