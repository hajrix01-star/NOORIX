import React from 'react';
import { Link } from 'react-router-dom';
import { Button, DateField, FileTrigger, FmtNum, Input } from '../../../ui';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import type { HrEmployee } from '../../../types/api';
import type { TerminationSettlementPrintPreview } from './terminationSettlementHelpers';

type Translate = (key: string) => string;

export type TerminationSettlementVault = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

type IssuedTerminationInvoice = {
  invoiceNumber?: string | number | null;
  invoiceId?: string | null;
} | null;

type TerminationSettlementModalContentProps = {
  t: Translate;
  lang: string;
  employee: HrEmployee;
  empId: string;
  terminationYmd: string;
  terminationReason: string;
  monthFirst: string;
  lastWorkYmd: string;
  preview: TerminationSettlementPrintPreview | null;
  advancesRemaining: number;
  compensationSnapshotLoading: boolean;
  compensationSnapshotError: unknown;
  hasCompensationSnapshot: boolean;
  hasMonthlyPackageTotal: boolean;
  canIssueInvoice: boolean;
  hasTerminationSalaryThisMonth: boolean;
  checkingTerminationSalaryInvoice: boolean;
  paymentVaults: TerminationSettlementVault[];
  vaultId: string;
  payoutAmountStr: string;
  txDateStr: string;
  issuing: boolean;
  uploading: boolean;
  issuedInvoice: IssuedTerminationInvoice;
  invoiceListHref: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onVaultIdChange: (value: string) => void;
  onTxDateChange: (value: string) => void;
  onPayoutAmountChange: (value: string) => void;
  onIssueInvoice: () => void;
  onPrint: () => void;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
};

export function TerminationSettlementModalContent({
  t,
  lang,
  employee,
  empId,
  terminationYmd,
  terminationReason,
  monthFirst,
  lastWorkYmd,
  preview,
  advancesRemaining,
  compensationSnapshotLoading,
  compensationSnapshotError,
  hasCompensationSnapshot,
  hasMonthlyPackageTotal,
  canIssueInvoice,
  hasTerminationSalaryThisMonth,
  checkingTerminationSalaryInvoice,
  paymentVaults,
  vaultId,
  payoutAmountStr,
  txDateStr,
  issuing,
  uploading,
  issuedInvoice,
  invoiceListHref,
  fileRef,
  onVaultIdChange,
  onTxDateChange,
  onPayoutAmountChange,
  onIssueInvoice,
  onPrint,
  onFileChange,
}: TerminationSettlementModalContentProps) {
  if (compensationSnapshotLoading) {
    return <p className="m-0 text-[13px] text-noorix-muted">{t('loading')}</p>;
  }
  if (compensationSnapshotError || !hasCompensationSnapshot) {
    return (
      <p className="m-0 text-[13px] text-noorix-red">
        {compensationSnapshotError instanceof Error ? compensationSnapshotError.message : t('loadingError')}
      </p>
    );
  }
  if (!hasMonthlyPackageTotal) {
    return <p className="m-0 text-[13px] text-noorix-red">{t('loadingError')}</p>;
  }
  if (!monthFirst || !preview) {
    return <p className="m-0 text-[13px] text-noorix-red">{t('terminationSettlementMissingDate')}</p>;
  }

  return (
    <div className="space-y-3 text-[13px]">
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/50 p-3 space-y-2">
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('employeeName')}</span>
          <span className="font-semibold">{employeeDisplayName(employee, lang)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('terminationDate')}</span>
          <span>{formatSaudiDate(terminationYmd)}</span>
        </div>
        {terminationReason ? (
          <div className="flex justify-between gap-2">
            <span className="text-noorix-muted">{t('terminationReason')}</span>
            <span className="text-end">{terminationReason}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('payrollMonth')}</span>
          <span>{formatSaudiDate(monthFirst)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('terminationSettlementEffectiveEnd')}</span>
          <span className="font-medium nx-font-numbers">{lastWorkYmd ? formatSaudiDate(lastWorkYmd) : '-'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('terminationSettlementMonthlyTotal')}</span>
          <FmtNum n={preview.fullMonthly} className="font-semibold nx-font-numbers" />
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('terminationSettlementEmployedDays')}</span>
          <span className="nx-font-numbers">{preview.pr.employedDays} / {preview.pr.daysInMonth}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('terminationSettlementProratedGross')}</span>
          <FmtNum n={preview.grossProrated} className="font-bold text-noorix-blue nx-font-numbers" />
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-noorix-muted">{t('terminationSettlementAdvancesOutstanding')}</span>
          <FmtNum n={advancesRemaining} className="nx-font-numbers" />
        </div>
        <div className="flex justify-between gap-2 border-t border-noorix-border pt-2 mt-1">
          <span className="font-semibold">{t('terminationSettlementSuggestedNet')}</span>
          <FmtNum n={preview.netSuggested} className="font-black text-noorix-green nx-font-numbers" />
        </div>
      </div>

      {canIssueInvoice && preview.netSuggested >= 0.01 ? (
        <div className="rounded-lg border border-noorix-border p-3 space-y-3">
          <p className="m-0 font-semibold text-[13px]">{t('terminationSettlementIssueSection')}</p>
          {hasTerminationSalaryThisMonth ? (
            <p className="m-0 text-[12px] text-noorix-red leading-snug">{t('terminationSettlementDuplicateMonth')}</p>
          ) : null}
          <Input
            type="select"
            label={t('terminationSettlementSelectVault')}
            value={vaultId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onVaultIdChange(event.target.value)}
          >
            <option value="">-</option>
            {paymentVaults.map((vault) => (
              <option key={vault.id || ''} value={vault.id || ''}>{vaultDisplayName(vault, lang)}</option>
            ))}
          </Input>
          <DateField
            label={t('terminationSettlementTransactionDate')}
            value={toYmd(txDateStr)}
            onValueChange={onTxDateChange}
          />
          <Input
            type="number"
            step="0.01"
            min="0.01"
            label={t('terminationSettlementPayoutAmount')}
            value={payoutAmountStr}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPayoutAmountChange(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={
              issuing ||
              !vaultId ||
              hasTerminationSalaryThisMonth ||
              checkingTerminationSalaryInvoice
            }
            onClick={onIssueInvoice}
          >
            {issuing ? '...' : t('terminationSettlementIssueInvoice')}
          </Button>
          {issuedInvoice?.invoiceNumber ? (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-noorix-border">
              <Link
                to={invoiceListHref}
                className="text-[12px] text-noorix-blue underline nx-font-numbers"
              >
                {t('terminationSettlementOpenInvoiceList')} ({issuedInvoice.invoiceNumber})
              </Link>
              <Link
                to={`/hr/employee/${empId}`}
                className="text-[12px] text-noorix-blue underline"
              >
                {t('terminationSettlementOpenEmployeeFile')}
              </Link>
            </div>
          ) : null}
        </div>
      ) : canIssueInvoice && preview.netSuggested < 0.01 ? (
        <p className="m-0 text-[12px] text-noorix-muted">{t('terminationSettlementZeroPayout')}</p>
      ) : (
        <p className="m-0 text-[12px] text-noorix-muted">{t('terminationSettlementNeedInvoicePermission')}</p>
      )}

      <p className="m-0 text-[11px] text-noorix-muted leading-snug">{t('terminationSettlementDisclaimer')}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" onClick={onPrint}>{t('terminationSettlementPrint')}</Button>
        <Button type="button" size="sm" variant="default" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? '...' : t('terminationSettlementUploadDoc')}
        </Button>
        <FileTrigger
          ref={fileRef as React.RefObject<HTMLInputElement>}
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
          onChange={onFileChange}
          label=""
          buttonProps={{ className: 'hidden', 'aria-hidden': true, tabIndex: -1 }}
        />
      </div>
      <p className="m-0 text-[11px] text-noorix-muted">{t('terminationSettlementUploadHint')}</p>
    </div>
  );
}
