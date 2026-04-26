/**
 * CategoriesTab ظ¤ ╪ز╪ذ┘ê┘è╪ذ╪ر ╪ز╪╡┘┘è┘╪د╪ز ╪د┘┘à┘ê╪▒╪»┘è┘ (┘à╪┤╪ز╪▒┘è╪د╪ز / ┘à╪╡╪▒┘ê┘╪د╪ز)
 */
import React, { memo } from 'react';
import { CategoriesManager } from '../../../components/CategoriesManager';

export type CategoriesTabProps = { companyId: any };

export const CategoriesTab = memo(function CategoriesTab({ companyId }: CategoriesTabProps) {
  return <CategoriesManager companyId={companyId} titleKey="categoriesTab" />;
});

export default CategoriesTab;
