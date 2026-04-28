import React from 'react';
import { Button, Input, Modal } from '../../../../../ui';

export interface DashboardCalendarAddSpecialModalProps {
  open: boolean;
  selectedDatesSorted: string[];
  newSpecialName: string;
  onNewSpecialNameChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
}

export default function DashboardCalendarAddSpecialModal({
  open,
  selectedDatesSorted,
  newSpecialName,
  onNewSpecialNameChange,
  onClose,
  onSave,
  lang,
  t,
}: DashboardCalendarAddSpecialModalProps) {
  if (selectedDatesSorted.length === 0) return null;
  return (
    <Modal open={open} onClose={onClose} title={t('dashboardAddAsSpecialDays')} size="sm">
      <p className="text-[12px] text-noorix-muted mb-3 m-0">
        {selectedDatesSorted[0]} — {selectedDatesSorted[selectedDatesSorted.length - 1]} ({selectedDatesSorted.length}{' '}
        {lang === 'ar' ? 'أيام' : 'days'})
      </p>
      <Input value={newSpecialName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewSpecialNameChange(e.target.value)} placeholder={t('dashboardSpecialDayName')} />
      <div className="flex items-center justify-end gap-2 mt-4">
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" onClick={onSave}>
          {t('save')}
        </Button>
      </div>
    </Modal>
  );
}
