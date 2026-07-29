import React from 'react';
import { DateField, Input } from '../../../ui';
import type { StaffInputChange } from './StaffCustomAllowancesSection';

type TerminationFieldKey = 'terminationReason' | 'terminationClause' | 'terminationDate';

type StaffTerminationFieldsProps = {
  reason: string;
  clause: string;
  date: string;
  reasonOptions: string[];
  t: (key: string) => string;
  onChange: (key: TerminationFieldKey, value: string) => void;
};

export function StaffTerminationFields({
  reason,
  clause,
  date,
  reasonOptions,
  t,
  onChange,
}: StaffTerminationFieldsProps) {
  return (
    <div className="mb-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
      <div>
        <Input
          type="select"
          label={t('terminationReason')}
          value={reason}
          onChange={(e: StaffInputChange) => onChange('terminationReason', e.target.value)}
        >
          <option value="">{t('terminationReasonPlaceholder')}</option>
          {reasonOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Input>
        <div className="mt-1 text-[11px] text-noorix-muted">
          {t('terminationReasonExamples')}
        </div>
      </div>
      <Input
        type="select"
        label={t('terminationClause')}
        value={clause}
        onChange={(e: StaffInputChange) => onChange('terminationClause', e.target.value)}
      >
        <option value="">{t('terminationClausePlaceholder')}</option>
        <option value={t('terminationClauseArt80')}>{t('terminationClauseArt80')}</option>
        <option value={t('terminationClauseArt77')}>{t('terminationClauseArt77')}</option>
        <option value={t('terminationClauseArt74')}>{t('terminationClauseArt74')}</option>
        <option value={t('terminationClauseArt81')}>{t('terminationClauseArt81')}</option>
      </Input>
      <DateField
        label={t('terminationDate')}
        value={date || ''}
        onValueChange={(value) => onChange('terminationDate', value)}
      />
    </div>
  );
}
