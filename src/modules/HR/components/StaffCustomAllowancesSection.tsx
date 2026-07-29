import React from 'react';
import { Button, Input } from '../../../ui';

export type StaffInputChange = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

export type CustomAllowanceRow = {
  id?: string;
  rowId: string;
  nameAr: string;
  amount: string;
};

type StaffCustomAllowancesSectionProps = {
  rows: CustomAllowanceRow[];
  error: string;
  t: (key: string) => string;
  onAdd: (nameAr?: string) => void;
  onRemove: (rowId: string) => void;
  onUpdate: (rowId: string, patch: Partial<CustomAllowanceRow>) => void;
};

const allowanceTemplates = [
  { key: 'meal', labelKey: 'allowanceTemplateMeal' },
  { key: 'housing', labelKey: 'allowanceTemplateHousing' },
  { key: 'transport', labelKey: 'allowanceTemplateTransport' },
  { key: 'overtime', labelKey: 'allowanceTemplateOvertime' },
];

export function StaffCustomAllowancesSection({
  rows,
  error,
  t,
  onAdd,
  onRemove,
  onUpdate,
}: StaffCustomAllowancesSectionProps) {
  return (
    <div className="mb-[18px] rounded-xl border border-noorix-border p-3.5">
      <div className="mb-[10px] flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[13px]">{t('customAllowances')}</strong>
        <Button type="button" size="sm" onClick={() => onAdd()}>
          {t('addCustomAllowance')}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {allowanceTemplates.map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            onClick={() => onAdd(t(item.labelKey))}
          >
            {t(item.labelKey)}
          </Button>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="text-[12px] text-noorix-muted">{t('noCustomAllowances')}</div>
      )}

      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.rowId} className="grid items-end gap-2 [grid-template-columns:1.4fr_1fr_auto]">
            <Input
              label={t('customAllowanceName')}
              value={row.nameAr}
              onChange={(e: StaffInputChange) => onUpdate(row.rowId, { nameAr: e.target.value })}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              label={t('customAllowanceAmount')}
              value={row.amount}
              onChange={(e: StaffInputChange) => onUpdate(row.rowId, { amount: e.target.value })}
            />
            <Button type="button" variant="danger" size="sm" onClick={() => onRemove(row.rowId)}>
              {t('delete')}
            </Button>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-2.5 text-[12px] text-noorix-red">{error}</div>
      )}
    </div>
  );
}
