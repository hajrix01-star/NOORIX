import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';

export default function PurchasesBatchHeader() {
  const { t } = useTranslation();
  return (
    <header className="nx-page-header">
      <div className="nx-page-header__titles">
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('batchPurchasesTitle')}</h1>
      </div>
    </header>
  );
}
