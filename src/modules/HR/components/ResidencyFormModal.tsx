/**
 * ResidencyFormModal — إضافة أو تعديل إقامة مع خيار إصدار فاتورة
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useVaults } from '../../../hooks/useVaults';
import { getEmployees } from '../../../services/api';
import { employeeKeys } from '../../../services/queryKeys';
import { createResidency, updateResidency, createInvoice } from '../../../services/api';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { assertApiOk } from '../../../utils/apiResponse';

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'statusActive' },
  { value: 'expired', labelKey: 'statusExpired' },
  { value: 'renewed', labelKey: 'statusRenewed' },
];

type ResidencyFormModalProps = {
  residency?: any;
  companyId: any;
  onSuccess?: () => void;
  onClose?: () => void;
};

export function ResidencyFormModal({ residency, companyId, onSuccess, onClose }: ResidencyFormModalProps) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const cid = companyId || activeCompanyId || '';
  const isEdit = !!residency;

  const [employeeId, setEmployeeId] = useState(residency?.employeeId || '');
  const [iqamaNumber, setIqamaNumber] = useState(residency?.iqamaNumber || '');
  const [issueDate, setIssueDate] = useState(toYmd(residency?.issueDate));
  const [expiryDate, setExpiryDate] = useState(toYmd(residency?.expiryDate));
  const [status, setStatus] = useState(residency?.status || 'active');
  const [notes, setNotes] = useState(residency?.notes || '');
  const [residencyServiceType, setResidencyServiceType] = useState('renewal');
  const [createInvoiceForResidency, setCreateInvoiceForResidency] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { paymentVaults = [] } = useVaults({ companyId: cid });
  const vaults = paymentVaults;

  const { data: employees = [] } = useQuery({
    queryKey: employeeKeys.list(cid, false),
    queryFn: async () => {
      const res = await getEmployees(cid, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!cid,
  });

  const activeEmployees = (employees || []).filter((e: any) => e.status !== 'terminated' && e.status !== 'archived');

  const handleSubmit = async (e: any) => {
    e?.preventDefault?.();
    setError('');
    if (!employeeId || !iqamaNumber || !expiryDate) {
      setError(t('requiredFields') || 'الحقول المطلوبة ناقصة');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        const res = await updateResidency(residency.id, {
          iqamaNumber,
          issueDate: issueDate || undefined,
          expiryDate: `${expiryDate}T00:00:00.000Z`,
          status,
          notes: notes || undefined,
        }, cid);
        assertApiOk(res, t('saveFailed'));
      } else {
        const res = await createResidency({
          companyId: cid,
          employeeId,
          iqamaNumber,
          issueDate: issueDate ? `${issueDate}T00:00:00.000Z` : undefined,
          expiryDate: `${expiryDate}T00:00:00.000Z`,
          status,
          notes: notes || undefined,
        });
        assertApiOk(res, t('saveFailed'));

        if (createInvoiceForResidency && invoiceAmount && parseFloat(invoiceAmount) > 0) {
          const vId = vaultId;
          if (!vId) {
            setError(t('noVaults') || 'يجب إنشاء خزنة أولاً');
            setSubmitting(false);
            return;
          }
          const emp = activeEmployees.find((e: any) => e.id === employeeId);
          const empName = emp ? employeeDisplayName(emp, 'ar', '') : '';
          const serviceLabel = residencyServiceType === 'renewal' ? (t('opResidencyRenewal') || 'تجديد إقامة') : (t('residencyNew') || 'إقامة جديدة');
          const notes = `${serviceLabel} موظف ${empName}`.trim() || `إقامة - ${iqamaNumber}`;
          const amt = parseFloat(invoiceAmount);
          const invRes = await createInvoice({
            companyId: cid,
            employeeId,
            kind: 'hr_expense',
            totalAmount: amt,
            netAmount: amt,
            taxAmount: 0,
            transactionDate: getSaudiToday(),
            vaultId: vId,
            notes,
          });
          assertApiOk(invRes, t('saveFailed'));
        }
      }
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={isEdit ? t('editResidency') : t('addResidency')}
      size="md"
      side="start"
      className="residency-form-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('saving') : (isEdit ? t('save') : t('add'))}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Input
          type="select"
          label={t('selectEmployee')}
          value={employeeId}
          onChange={(e: any) => setEmployeeId(e.target.value)}
          required
          disabled={isEdit}
        >
          <option value="">—</option>
          {activeEmployees.map((emp: any) => (
            <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
          ))}
        </Input>

        <Input
          label={t('iqamaNumber')}
          value={iqamaNumber}
          onChange={(e: any) => setIqamaNumber(e.target.value)}
          required
          placeholder="1234567890"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            label={t('startDate')}
            value={issueDate}
            onChange={(e: any) => setIssueDate(e.target.value)}
          />
          <Input
            type="date"
            label={t('expiryDate')}
            value={expiryDate}
            onChange={(e: any) => setExpiryDate(e.target.value)}
            required
          />
        </div>

        {!isEdit && (
          <>
            <label className="nx-checkbox mb-3 text-[13px]">
              <input
                type="checkbox"
                checked={createInvoiceForResidency}
                onChange={(e: any) => setCreateInvoiceForResidency(e.target.checked)}
              />
              {t('residencyIssueInvoice') || 'إصدار فاتورة إقامة'}
            </label>
            {createInvoiceForResidency && (
              <>
                <Input
                  type="select"
                  label={t('residencyServiceType') || 'نوع الخدمة'}
                  value={residencyServiceType}
                  onChange={(e: any) => setResidencyServiceType(e.target.value)}
                >
                  <option value="renewal">{t('opResidencyRenewal') || 'تجديد إقامة'}</option>
                  <option value="new">{t('residencyNew') || 'إقامة جديدة'}</option>
                </Input>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label={t('advanceAmount')}
                    value={invoiceAmount}
                    onChange={(e: any) => setInvoiceAmount(e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    type="select"
                    label={t('selectVault')}
                    value={vaultId}
                    onChange={(e: any) => setVaultId(e.target.value)}
                    required
                  >
                    <option value="">— {t('selectVault')} —</option>
                    {vaults.map((v: any) => (
                      <option key={v.id} value={v.id}>{vaultDisplayName(v, lang)}</option>
                    ))}
                  </Input>
                </div>
              </>
            )}
          </>
        )}

        {isEdit && (
          <Input
            type="select"
            label={t('status')}
            value={status}
            onChange={(e: any) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((o: any) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </Input>
        )}

        <Input
          label={t('notes')}
          value={notes}
          onChange={(e: any) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />

        {error && (
          <div className="mb-3 rounded-lg text-[13px] p-[10px]" style={{ background: 'var(--noorix-red-10)', color: 'var(--noorix-accent-red)' }}>
            {error}
          </div>
        )}
      </form>
    </AdaptiveSheet>
  );
}
