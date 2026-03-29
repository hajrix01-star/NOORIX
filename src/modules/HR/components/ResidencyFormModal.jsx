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

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'statusActive' },
  { value: 'expired', labelKey: 'statusExpired' },
  { value: 'renewed', labelKey: 'statusRenewed' },
];

export function ResidencyFormModal({ residency, companyId, onSuccess, onClose }) {
  const { t } = useTranslation();
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
    e.preventDefault();
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
          const vId = vaultId || vaults[0]?.id;
          if (!vId) {
            setError(t('noVaults') || 'يجب إنشاء خزنة أولاً');
            setSubmitting(false);
            return;
          }
          const emp = activeEmployees.find((e) => e.id === employeeId);
          const empName = emp?.name || emp?.nameAr || '';
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
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 400, width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{isEdit ? t('editResidency') : t('addResidency')}</h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('selectEmployee')}</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              disabled={isEdit}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            >
              <option value="">—</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name || emp.nameAr || '—'}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('iqamaNumber')}</label>
            <input
              type="text"
              value={iqamaNumber}
              onChange={(e) => setIqamaNumber(e.target.value)}
              required
              placeholder="1234567890"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('startDate')}</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('expiryDate')}</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              />
            </div>
          </div>

          {!isEdit && (
            <>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="createInvoiceResidency"
                  checked={createInvoiceForResidency}
                  onChange={(e) => setCreateInvoiceForResidency(e.target.checked)}
                />
                <label htmlFor="createInvoiceResidency" style={{ fontSize: 13, cursor: 'pointer' }}>{t('residencyIssueInvoice') || 'إصدار فاتورة إقامة'}</label>
              </div>
              {createInvoiceForResidency && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('residencyServiceType') || 'نوع الخدمة'}</label>
                    <select
                      value={residencyServiceType}
                      onChange={(e) => setResidencyServiceType(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
                    >
                      <option value="renewal">{t('opResidencyRenewal') || 'تجديد إقامة'}</option>
                      <option value="new">{t('residencyNew') || 'إقامة جديدة'}</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('advanceAmount')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      placeholder="0"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('selectVault')}</label>
                    <select
                      value={vaultId || vaults[0]?.id}
                      onChange={(e) => setVaultId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
                    >
                      {vaults.map((v) => (
                        <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
                      ))}
                    </select>
                  </div>
                </div>
                </>
              )}
            </>
          )}

          {isEdit && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('status')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes')}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="noorix-btn-nav" style={{ background: 'var(--btn-primary-bg)', color: '#fff' }} disabled={submitting}>
              {submitting ? t('saving') : (isEdit ? t('save') : t('add'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
