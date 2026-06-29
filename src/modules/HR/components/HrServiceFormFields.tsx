/**
 * حقول النموذج الديناميكية حسب نوع خدمة الموظف
 */
import React from 'react';
import { Input } from '../../../ui';
import {
  requiresExpiryDate,
  showsIssueDate,
  showsVisaDurationMonths,
  showsReferenceLabel,
  usesCompanyAsSponsor,
  referenceLabelKey,
  VISA_DURATION_MONTHS,
  visaDurationLabel,
} from '../constants/employeeHrServiceCategories';

type TFunction = (key: string, ...args: Array<string | number>) => string;
type StringSetter = (value: string) => void;
type InputChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

type HrServiceFormFieldsProps = {
  t: TFunction;
  lang?: string;
  serviceCategory: string;
  companySponsorName?: string;
  iqamaNumber: string;
  setIqamaNumber: StringSetter;
  referenceLabel: string;
  setReferenceLabel: StringSetter;
  visaDurationMonths: string | number | null | undefined;
  setVisaDurationMonths: StringSetter;
  issueDate: string;
  setIssueDate: StringSetter;
  expiryDate: string;
  setExpiryDate: StringSetter;
  transactionDate: string;
  setTransactionDate: StringSetter;
  showIqama?: boolean;
};

export function HrServiceFormFields({
  t,
  serviceCategory,
  companySponsorName,
  iqamaNumber,
  setIqamaNumber,
  referenceLabel,
  setReferenceLabel,
  visaDurationMonths,
  setVisaDurationMonths,
  issueDate,
  setIssueDate,
  expiryDate,
  setExpiryDate,
  transactionDate,
  setTransactionDate,
  showIqama,
}: HrServiceFormFieldsProps) {
  const sponsorIsCompany = usesCompanyAsSponsor(serviceCategory);
  const showExpiry = requiresExpiryDate(serviceCategory);
  const showIssue = showsIssueDate(serviceCategory);
  const showVisaMonths = showsVisaDurationMonths(serviceCategory);
  const showRef = showsReferenceLabel(serviceCategory);
  const refLabelKey = referenceLabelKey(serviceCategory);

  return (
    <>
      {showIqama && (
        <Input
          label={t('iqamaNumber')}
          value={iqamaNumber}
          onChange={(e: InputChangeEvent) => setIqamaNumber(e.target.value)}
          required
          placeholder="1234567890"
        />
      )}

      {sponsorIsCompany && (
        <div className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-3 py-2.5">
          <div className="text-[12px] text-noorix-muted mb-1">{t('hrServiceTransferSponsorCompany')}</div>
          <div className="text-[14px] font-semibold text-noorix-text">{companySponsorName || '—'}</div>
          <p className="text-[11px] text-noorix-muted mt-1.5 m-0">{t('hrServiceTransferSponsorHint')}</p>
        </div>
      )}

      {showVisaMonths && (
        <Input
          type="select"
          label={t('hrServiceVisaDurationMonths')}
          value={visaDurationMonths}
          onChange={(e: InputChangeEvent) => setVisaDurationMonths(e.target.value)}
          required
        >
          <option value="">{t('hrServiceVisaDurationSelect')}</option>
          {VISA_DURATION_MONTHS.map((m) => (
            <option key={m} value={String(m)}>{visaDurationLabel(m, t)}</option>
          ))}
        </Input>
      )}

      {showRef && (
        <Input
          label={t(refLabelKey)}
          value={referenceLabel}
          onChange={(e: InputChangeEvent) => setReferenceLabel(e.target.value)}
          placeholder={t(refLabelKey)}
        />
      )}

      <Input
        type="date"
        label={t('hrServiceTransactionDate')}
        value={transactionDate}
        onChange={(e: InputChangeEvent) => setTransactionDate(e.target.value)}
        lang="en"
      />

      {showIssue && (
        <Input
          type="date"
          label={t('startDate')}
          value={issueDate}
          onChange={(e: InputChangeEvent) => setIssueDate(e.target.value)}
          lang="en"
        />
      )}

      {showExpiry && (
        <Input
          type="date"
          label={t('expiryDate')}
          value={expiryDate}
          onChange={(e: InputChangeEvent) => setExpiryDate(e.target.value)}
          required
          lang="en"
        />
      )}
    </>
  );
}
