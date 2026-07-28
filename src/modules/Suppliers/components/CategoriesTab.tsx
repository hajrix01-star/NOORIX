import React, { memo } from 'react';
import { CategoriesManager } from '../../../components/CategoriesManager';

export type CategoriesTabProps = {
  companyId: string;
  openCreateSignal?: number;
};

export const CategoriesTab = memo(function CategoriesTab({
  companyId,
  openCreateSignal,
}: CategoriesTabProps) {
  return (
    <CategoriesManager
      companyId={companyId}
      titleKey="categoriesTab"
      openCreateSignal={openCreateSignal}
    />
  );
});

export default CategoriesTab;
