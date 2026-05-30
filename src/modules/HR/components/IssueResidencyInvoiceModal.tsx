/**
 * IssueResidencyInvoiceModal — إصدار فاتورة hr_expense لسجل خدمة موظف
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useVaults } from '../../../hooks/useVaults';
import { issueResidencyInvoice } from '../../../services/api';
import { getSaudiToday } from '../../../utils/saudiDate';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Input, Modal } from '../../../ui';
import { assertApiOk } from '../../../utils/apiResponse';
import { HR_SERVICE_CATEGORY_LABEL_KEYS } from '../constants/employeeHrServiceCategories';

type IssueResidencyInvoiceModalProps = {
  row: any;
  companyId: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

export function IssueResidencyInvoiceModal({ row, companyId, onSuccess, onClose }: IssueResidencyInvoiceModalProps) {
  const { t, lang } = useTranslation();
  const [amount, setAmount] = useState(row?.residencyInvoiceAmount ? String(row.residencyInvoiceAmount) : '');
  const [vaultId, setVaultId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { paymentVaults = [] } = useVaults({ companyId });
  const category = row?.serviceCategory || 'iqama_renewal';
  const categoryLabel = t(HR_SERVICE_CATEGORY_LABEL_KEYS[category] || 'residencyServiceType');

  const handleSubmit = async () => {
    setError('');
    const amt = parseFloat(amount);
    if (!vaultId) {
      setError(t('noVaults') || 'اختر الخزينة');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError(t('requiredFields'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await issueResidencyInvoice(row.id, companyId, {
        amount: amt,
        vaultId,
        transactionDate: getSaudiToday(),
      });
      assertApiOk(res, t('saveFailed'));
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open title={t('hrServiceIssueInvoice')} onClose={onClose} size="sm">
      <p className="text-[13px] text-noorix-muted m-0 mb-3">
        {categoryLabel}
        {row?.employeeName ? ` — ${row.employeeName}` : ''}
      </p>
      <div className="flex flex-col gap-3">
        <Input
          type="number"
          step="0.01"
          min="0"
          label={t('advanceAmount')}
          value={amount}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setAmount(e.target.value)}
        />
        <Input
          type="select"
          label={t('selectVault')}
          value={vaultId}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVaultId(e.target.value)}
          required
        >
          <option value="">— {t('selectVault')} —</option>
          {paymentVaults.map((v: any) => (
            <option key={v.id} value={v.id}>{vaultDisplayName(v, lang)}</option>
          ))}
        </Input>
        {error && (
          <div className="rounded-lg text-[13px] p-[10px] bg-noorix-red/10 text-noorix-red">{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('saving') : t('hrServiceIssueInvoice')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
