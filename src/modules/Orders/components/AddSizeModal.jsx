/**
 * AddSizeModal — نافذة إضافة حجم مخصص
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';

export function AddSizeModal({ visible, onClose, value, onChange, onAdd }) {
  const { t } = useTranslation();
  return (
    <AdaptiveSheet
      open={visible}
      onClose={onClose}
      title={`+ ${t('ordersProductSizes')}`}
      size="sm"
      side="start"
      className="add-size-drawer"
      footer={
        <>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={onAdd}>{t('add')}</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Input
          label={`${t('productNameAr')} *`}
          value={value.ar}
          onChange={(e) => onChange((s) => ({ ...s, ar: e.target.value }))}
          placeholder="صغير"
        />
        <Input
          label={t('productNameEn')}
          value={value.en}
          onChange={(e) => onChange((s) => ({ ...s, en: e.target.value }))}
          placeholder="Small"
        />
      </div>
    </AdaptiveSheet>
  );
}
