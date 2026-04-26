/**
 * AddPackagingModal — نافذة إضافة تغليف مخصص
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';

export function AddPackagingModal({ visible, onClose, value, onChange, onAdd }: any) {
  const { t } = useTranslation();
  return (
    <AdaptiveSheet
      open={visible}
      onClose={onClose}
      title={`+ ${t('ordersProductPackaging')}`}
      size="sm"
      side="start"
      className="add-packaging-drawer"
      footer={
        <>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={onAdd}>{t('add')}</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Input
          label={`${t('productNameAr')} *`}
          value={value.ar}
          onChange={(e: any) => onChange((s: any) => ({ ...s, ar: e.target.value }))}
          placeholder="علبة"
        />
        <Input
          label={t('productNameEn')}
          value={value.en}
          onChange={(e: any) => onChange((s: any) => ({ ...s, en: e.target.value }))}
          placeholder="Box"
        />
      </div>
    </AdaptiveSheet>
  );
}
