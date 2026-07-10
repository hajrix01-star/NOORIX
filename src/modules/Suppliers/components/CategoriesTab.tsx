import React, { memo } from 'react';
import { CategoriesManager } from '../../../components/CategoriesManager';

export type CategoriesTabProps = { companyId: string };

export const CategoriesTab = memo(function CategoriesTab({ companyId }: CategoriesTabProps) {
  return <CategoriesManager companyId={companyId} titleKey="categoriesTab" />;
});

export default CategoriesTab;
