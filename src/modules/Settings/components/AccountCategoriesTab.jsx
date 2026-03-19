/**
 * AccountCategoriesTab — فئات الحسابات (مشتريات / مصروفات / مبيعات)
 */
import React from 'react';
import { useApp } from '../../../context/AppContext';
import { CategoriesManager } from '../../../components/CategoriesManager';

export default function AccountCategoriesTab() {
  const { activeCompanyId } = useApp();
  const companyId = activeCompanyId ?? '';

  if (!companyId) {
    return (
      <div className="noorix-surface-card" style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
        يرجى اختيار شركة من القائمة الجانبية أولاً.
      </div>
    );
  }

  return <CategoriesManager companyId={companyId} titleKey="accountCategoriesTab" />;
}
