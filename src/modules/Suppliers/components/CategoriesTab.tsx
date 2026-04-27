/** Supplier categories (purchases / expenses) */
import React, { memo } from 'react';
import { CategoriesManager } from '../../../components/CategoriesManager';

export type CategoriesTabProps = { companyId: any };

export const CategoriesTab = memo(function CategoriesTab({ companyId }: CategoriesTabProps) {
  return <CategoriesManager companyId={companyId} titleKey="categoriesTab" />;
});

export default CategoriesTab;
