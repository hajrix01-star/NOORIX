import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';

export function CatalogInfoBanner({ productType }: { productType: 'order' | 'sale' }) {
  const { t } = useTranslation();
  return (
    <p className="m-0 text-[12px] text-noorix-muted leading-relaxed px-1">
      {productType === 'sale' ? t('ordersCatalogHintSale') : t('ordersCatalogHintOrder')}
    </p>
  );
}
