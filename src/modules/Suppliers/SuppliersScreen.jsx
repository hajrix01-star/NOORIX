/**
 * SuppliersScreen — الموردين والتصنيفات
 * تبويبتان: موردين | تصنيفات
 */
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { SuppliersTab } from './components/SuppliersTab';
import { CategoriesTab } from './components/CategoriesTab';

export default function SuppliersScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const [activeTab, setActiveTab] = useState('suppliers');

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('suppliersAndCategoriesTitle')}</h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          {t('suppliersAndCategoriesDesc')}
        </p>
      </div>

      {!companyId && (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompany')}
        </div>
      )}

      {companyId && (
        <>
          {/* تبويبات */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--noorix-border)', gap: 0, overflowX: 'auto', flexShrink: 0 }}>
            {[{ id: 'suppliers', label: t('suppliersTab') }, { id: 'categories', label: t('categoriesTab') }].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="noorix-btn-nav"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  borderRadius: 0, border: 'none', margin: 0,
                  borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-green)' : '2px solid transparent',
                  background: activeTab === tab.id ? 'rgba(22,163,74,0.07)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--noorix-accent-green)' : 'var(--noorix-text-muted)',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  padding: '10px 20px', fontSize: 13,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'suppliers'  && <SuppliersTab  companyId={companyId} />}
          {activeTab === 'categories' && <CategoriesTab companyId={companyId} />}
        </>
      )}
    </div>
  );
}
