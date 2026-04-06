/**
 * ResidencyFormModal — إضافة أو تعديل إقامة مع خيار إصدار فاتورة
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useVaults } from '../../../hooks/useVaults';
import { getEmployees } from '../../../services/api';
import { createResidency, updateResidency, createInvoice } from '../../../services/api';
import { getSaudiToday } from '../../../utils/saudiDate';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input, Modal } from '../../../ui';

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'statusActive' },
  { value: 'expired', labelKey: 'statusExpired' },
  { value: 'renewed', labelKey: 'statusRenewed' },
];

export function ResidencyFormModal({ residency, companyId, onSuccess, onClose }) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const cid = companyId || activeCompanyId || '';
  const isEdit = !!residency;

  const [employeeId, setEmployeeId] = useState(residency?.employeeId || '');
  const [iqamaNumber, setIqamaNumber] = useState(residency?.iqamaNumber || '');
  const [issueDate, setIssueDate] = useState(residency?.issueDate ? residency.issueDate.slice(0, 10) : '');
  const [expiryDate, setExpiryDate] = useState(residency?.expiryDate ? residency.expiryDate.slice(0, 10) : '');
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
    queryKey: ['employees', cid, false],
    queryFn: async () => {
      const res = await getEmployees(cid, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!cid,
  });

  const activeEmployees = (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');

  const handleSubmit = async (e) => {
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
        if (!res?.success) throw new Error(res?.error || 'فشل تحديث الإقامة');
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
        if (!res?.success) throw new Error(res?.error || 'فشل إضافة الإقامة');

        if (createInvoiceForResidency && invoiceAmount && parseFloat(invoiceAmount) > 0) {
          const vId = vaultId;
          if (!vId) {
            setError(t('noVaults') || 'يجب إنشاء خزنة أولاً');
            setSubmitting(false);
            return;
          }
          const emp = activeEmployees.find((e) => e.id === employeeId);
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
          if (!invRes?.success) throw new Error(invRes?.error || 'فشل إصدار فاتورة الإقامة');
        }
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? t('editResidency') : t('addResidency')}
      size="sm"
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
          onChange={(e) => setEmployeeId(e.target.value)}
          required
          disabled={isEdit}
        >
          <option value="">—</option>
          {activeEmployees.map((emp) => (
            <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
          ))}
        </Input>

        <Input
          label={t('iqamaNumber')}
          value={iqamaNumber}
          onChange={(e) => setIqamaNumber(e.target.value)}
          required
          placeholder="1234567890"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            type="date"
            label={t('startDate')}
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <Input
            type="date"
            label={t('expiryDate')}
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            required
          />
        </div>

        {!isEdit && (
          <>
            <label className="nx-checkbox" style={{ marginBottom: 12, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={createInvoiceForResidency}
                onChange={(e) => setCreateInvoiceForResidency(e.target.checked)}
              />
              {t('residencyIssueInvoice') || 'إصدار فاتورة إقامة'}
            </label>
            {createInvoiceForResidency && (
              <>
                <Input
                  type="select"
                  label={t('residencyServiceType') || 'نوع الخدمة'}
                  value={residencyServiceType}
                  onChange={(e) => setResidencyServiceType(e.target.value)}
                >
                  <option value="renewal">{t('opResidencyRenewal') || 'تجديد إقامة'}</option>
                  <option value="new">{t('residencyNew') || 'إقامة جديدة'}</option>
                </Input>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label={t('advanceAmount')}
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    type="select"
                    label={t('selectVault')}
                    value={vaultId}
                    onChange={(e) => setVaultId(e.target.value)}
                    required
                  >
                    <option value="">— اختر الخزينة —</option>
                    {vaults.map((v) => (
                      <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
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
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </Input>
        )}

        <Input
          label={t('notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />

        {error && (
          <div style={{ marginBottom: 12, padding: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
