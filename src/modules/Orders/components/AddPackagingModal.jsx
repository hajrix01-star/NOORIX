/**
 * AddPackagingModal — نافذة إضافة تغليف مخصص
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, Modal } from '../../../ui';

export function AddPackagingModal({ visible, onClose, value, onChange, onAdd }) {
  const { t } = useTranslation();
  return (
    <Modal
      open={visible}
      onClose={onClose}
      title={`+ ${t('ordersProductPackaging')}`}
      size="sm"
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
          placeholder="علبة"
        />
        <Input
          label={t('productNameEn')}
          value={value.en}
          onChange={(e) => onChange((s) => ({ ...s, en: e.target.value }))}
          placeholder="Box"
        />
      </div>
    </Modal>
  );
}
