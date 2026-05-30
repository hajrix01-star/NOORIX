/**
 * ResidencyFormModal — إضافة/تعديل خدمة موظف (إقامة، تأشيرة، تذكرة، تأمين، …)
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useVaults } from '../../../hooks/useVaults';
import { getEmployees, createResidency, updateResidency } from '../../../services/api';
import { employeeKeys } from '../../../services/queryKeys';
import { getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { assertApiOk } from '../../../utils/apiResponse';
import {
  HR_SERVICE_CATEGORIES,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
  requiresIqamaNumber,
  requiresExpiryDate,
  showsReferenceLabel,
  referenceLabelKey,
  usesCompanyAsSponsor,
  companyDisplayName,
} from '../constants/employeeHrServiceCategories';

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'statusActive' },
  { value: 'expired', labelKey: 'statusExpired' },
  { value: 'renewed', labelKey: 'statusRenewed' },
];

type ResidencyFormModalProps = {
  residency?: any;
  companyId: any;
  defaultCategory?: string;
  /** عند الفتح من ملف الموظف — يُقفل اختيار الموظف */
  defaultEmployeeId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

export function ResidencyFormModal({
  residency,
  companyId,
  defaultCategory = 'iqama_renewal',
  defaultEmployeeId = '',
  onSuccess,
  onClose,
}: ResidencyFormModalProps) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const cid = companyId || activeCompanyId || '';
  const activeCompany = useMemo(
    () => (companies || []).find((c: { id?: string }) => c.id === cid),
    [companies, cid],
  );
  const companySponsorName = useMemo(
    () => companyDisplayName(activeCompany, lang),
    [activeCompany, lang],
  );
  const isEdit = !!residency;

  const lockEmployee = !!defaultEmployeeId && !residency;
  const [employeeId, setEmployeeId] = useState(residency?.employeeId || defaultEmployeeId || '');
  const [serviceCategory, setServiceCategory] = useState(residency?.serviceCategory || defaultCategory);
  const [iqamaNumber, setIqamaNumber] = useState(residency?.iqamaNumber || '');
  const [referenceLabel, setReferenceLabel] = useState(residency?.referenceLabel || '');
  const [issueDate, setIssueDate] = useState(toYmd(residency?.issueDate));
  const [expiryDate, setExpiryDate] = useState(toYmd(residency?.expiryDate));
  const [transactionDate, setTransactionDate] = useState(toYmd(residency?.transactionDate) || getSaudiToday());
  const [status, setStatus] = useState(residency?.status || 'active');
  const [notes, setNotes] = useState(residency?.notes || '');
  const [createInvoiceForService, setCreateInvoiceForService] = useState(false);
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

  const showIqama = requiresIqamaNumber(serviceCategory);
  const showExpiry = requiresExpiryDate(serviceCategory);
  const showRef = showsReferenceLabel(serviceCategory);
  const sponsorIsCompany = usesCompanyAsSponsor(serviceCategory);
  const refLabelKey = referenceLabelKey(serviceCategory);

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e: any) => e.id === employeeId),
    [activeEmployees, employeeId],
  );

  const onEmployeeChange = (id: string) => {
    setEmployeeId(id);
    const emp = activeEmployees.find((e: any) => e.id === id);
    if (emp?.iqamaNumber && showIqama && !iqamaNumber) {
      setIqamaNumber(emp.iqamaNumber);
    }
  };

  useEffect(() => {
    if (!lockEmployee || !selectedEmployee?.iqamaNumber || !showIqama) return;
    if (!iqamaNumber) setIqamaNumber(selectedEmployee.iqamaNumber);
  }, [lockEmployee, selectedEmployee, showIqama, iqamaNumber]);

  useEffect(() => {
    if (!sponsorIsCompany || !companySponsorName) return;
    setReferenceLabel(companySponsorName);
  }, [sponsorIsCompany, companySponsorName, serviceCategory]);

  const buildPayload = () => {
    const body: Record<string, unknown> = {
      companyId: cid,
      employeeId,
      serviceCategory,
      notes: notes || undefined,
      transactionDate: transactionDate ? `${transactionDate}T00:00:00.000Z` : undefined,
    };
    if (showIqama) body.iqamaNumber = iqamaNumber.trim();
    if (sponsorIsCompany && companySponsorName) {
      body.referenceLabel = companySponsorName;
    } else if (showRef && referenceLabel.trim()) {
      body.referenceLabel = referenceLabel.trim();
    }
    if (issueDate) body.issueDate = `${issueDate}T00:00:00.000Z`;
    if (showExpiry && expiryDate) body.expiryDate = `${expiryDate}T00:00:00.000Z`;
    if (isEdit) body.status = status;
    return body;
  };

  const handleSubmit = async (e: any) => {
    e?.preventDefault?.();
    setError('');
    if (!employeeId) {
      setError(t('requiredFields'));
      return;
    }
    if (showIqama && !/^\d{10}$/.test(iqamaNumber.trim())) {
      setError(t('iqamaNumberInvalid') || 'رقم الإقامة 10 أرقام');
      return;
    }
    if (showExpiry && !expiryDate) {
      setError(t('requiredFields'));
      return;
    }
    if (!isEdit && createInvoiceForService) {
      if (!vaultId || !invoiceAmount || parseFloat(invoiceAmount) <= 0) {
        setError(t('requiredFields'));
        return;
      }
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        const res = await updateResidency(residency.id, buildPayload(), cid);
        assertApiOk(res, t('saveFailed'));
      } else {
        const payload = buildPayload() as Record<string, unknown>;
        if (createInvoiceForService && invoiceAmount && parseFloat(invoiceAmount) > 0) {
          payload.issueInvoice = {
            amount: parseFloat(invoiceAmount),
            vaultId,
          };
        }
        const res = await createResidency(payload);
        assertApiOk(res, t('saveFailed'));
      }
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const title = isEdit ? t('editHrService') : t('addHrService');

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={title}
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-0">
        <Input
          type="select"
          label={t('hrServiceCategory')}
          value={serviceCategory}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setServiceCategory(e.target.value)}
          disabled={isEdit}
        >
          {HR_SERVICE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{t(HR_SERVICE_CATEGORY_LABEL_KEYS[cat])}</option>
          ))}
        </Input>

        <Input
          type="select"
          label={t('selectEmployee')}
          value={employeeId}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onEmployeeChange(e.target.value)}
          required
          disabled={isEdit || lockEmployee}
        >
          <option value="">—</option>
          {activeEmployees.map((emp: any) => (
            <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
          ))}
        </Input>
        {lockEmployee && selectedEmployee && (
          <p className="text-[12px] text-noorix-muted -mt-2 mb-2">
            {employeeDisplayName(selectedEmployee, lang)}
          </p>
        )}

        {showIqama && (
          <Input
            label={t('iqamaNumber')}
            value={iqamaNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setIqamaNumber(e.target.value)}
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

        {showRef && (
          <Input
            label={t(refLabelKey)}
            value={referenceLabel}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setReferenceLabel(e.target.value)}
            placeholder={t(refLabelKey)}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="date"
            label={t('hrServiceTransactionDate')}
            value={transactionDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setTransactionDate(e.target.value)}
          />
          {showExpiry ? (
            <Input
              type="date"
              label={t('expiryDate')}
              value={expiryDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setExpiryDate(e.target.value)}
              required
            />
          ) : (
            <Input
              type="date"
              label={t('startDate')}
              value={issueDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setIssueDate(e.target.value)}
            />
          )}
        </div>

        {showExpiry && (
          <Input
            type="date"
            label={t('startDate')}
            value={issueDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setIssueDate(e.target.value)}
          />
        )}

        {!isEdit && !residency?.invoiceId && (
          <>
            <label className="nx-checkbox mb-3 text-[13px]">
              <input
                type="checkbox"
                checked={createInvoiceForService}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateInvoiceForService(e.target.checked)}
              />
              {t('hrServiceIssueInvoice')}
            </label>
            {createInvoiceForService && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label={t('advanceAmount')}
                  value={invoiceAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInvoiceAmount(e.target.value)}
                />
                <Input
                  type="select"
                  label={t('selectVault')}
                  value={vaultId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVaultId(e.target.value)}
                  required
                >
                  <option value="">— {t('selectVault')} —</option>
                  {vaults.map((v: any) => (
                    <option key={v.id} value={v.id}>{vaultDisplayName(v, lang)}</option>
                  ))}
                </Input>
              </div>
            )}
          </>
        )}

        {isEdit && (
          <Input
            type="select"
            label={t('status')}
            value={status}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((o: any) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </Input>
        )}

        {residency?.invoice?.invoiceNumber && (
          <div className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[13px]">
            <span className="text-noorix-muted">{t('invoiceNumber')}: </span>
            <span className="font-semibold ltr">{residency.invoice.invoiceNumber}</span>
          </div>
        )}

        <Input
          label={t('notes')}
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />

        {error && (
          <div className="mb-3 rounded-lg text-[13px] p-[10px] bg-noorix-red/10 text-noorix-red">
            {error}
          </div>
        )}
      </form>
    </AdaptiveSheet>
  );
}
