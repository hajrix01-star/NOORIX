/**
 * CategoriesTab — تبويبة تصنيفات الموردين (مشتريات / مصروفات)
 */
import React, { memo } from 'react';
import { CategoriesManager } from '../../../components/CategoriesManager';

export const CategoriesTab = memo(function CategoriesTab({ companyId }) {
  return <CategoriesManager companyId={companyId} titleKey="categoriesTab" />;
});

export default CategoriesTab;
