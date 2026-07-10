/**
 * AddPackagingModal — نافذة إضافة تغليف مخصص
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { DialogActions, Input, AdaptiveSheet } from '../../../ui';

type CustomOptionDraft = { ar: string; en: string };

export function AddPackagingModal({
  visible,
  onClose,
  value,
  onChange,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  value: CustomOptionDraft;
  onChange: React.Dispatch<React.SetStateAction<CustomOptionDraft>>;
  onAdd: () => void;
}) {
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
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
            { key: 'add', label: t('add'), role: 'primary', onClick: onAdd },
          ]}
        />
      }
    >
      <div className="grid gap-3">
        <Input
          label={`${t('productNameAr')} *`}
          value={value.ar}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange((s) => ({ ...s, ar: e.target.value }))}
          placeholder="علبة"
        />
        <Input
          label={t('productNameEn')}
          value={value.en}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange((s) => ({ ...s, en: e.target.value }))}
          placeholder="Box"
        />
      </div>
    </AdaptiveSheet>
  );
}
