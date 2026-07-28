/**
 * ResidencyFormModal — إضافة/تعديل خدمة موظف (حقول مختلفة حسب النوع)
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useVaults } from '../../../hooks/useVaults';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { getEmployees, createResidency, updateResidency, throwIfApiFailed } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { employeeKeys } from '../../../services/queryKeys';
import { getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { fmt } from '../../../utils/format';
import { Checkbox, DialogActions, Input, AdaptiveSheet } from '../../../ui';
import { SupplierSelect } from '../../../components/common/SupplierSelect';
import {
  HR_SERVICE_CATEGORIES,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
  requiresIqamaNumber,
  requiresExpiryDate,
  requiresReferenceLabel,
  requiresInvoiceSupplierSelection,
  requiresHrServiceSupplier,
  defaultHrServiceSupplierId,
  requiresVisaDurationMonths,
  parseVisaDurationMonths,
  companyDisplayName,
  addOneCalendarYearYmd,
} from '../constants/employeeHrServiceCategories';
import { HrServiceFormFields } from './HrServiceFormFields';
import type { HrEmployee } from '../../../types/api';
import type { SupplierRecord } from '../../Suppliers/supplierTypes';

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'statusActive' },
  { value: 'expired', labelKey: 'statusExpired' },
  { value: 'renewed', labelKey: 'statusRenewed' },
];

const RESIDENCY_FORM_ID = 'residency-service-form';
type ResidencyRecord = Record<string, unknown> & {
  id?: string | null;
  employeeId?: string | null;
  serviceCategory?: string | null;
  iqamaNumber?: string | null;
  referenceLabel?: string | null;
  issueDate?: string | Date | null;
  expiryDate?: string | Date | null;
  transactionDate?: string | Date | null;
  status?: string | null;
  notes?: string | null;
  invoiceId?: string | null;
  invoice?: { invoiceNumber?: string | number | null } | null;
  supplierId?: string | null;
  supplier?: { id?: string | null; nameAr?: string | null; nameEn?: string | null } | null;
  residencyInvoiceAmount?: number | string | null;
  metadata?: Record<string, unknown> | null;
};
type VaultOption = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};
type ResidencyInputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildServiceDateDefaults(
  residency: ResidencyRecord | null | undefined,
  isNew: boolean,
  category: string,
) {
  const today = getSaudiToday();
  const issueDate = toDateInputYmd(residency?.issueDate) || (isNew ? today : '');
  const storedExpiryDate = toDateInputYmd(residency?.expiryDate);
  return {
    transactionDate: toDateInputYmd(residency?.transactionDate) || today,
    issueDate,
    expiryDate: storedExpiryDate || (isNew && category === 'health_certificate' ? addOneCalendarYearYmd(issueDate) : ''),
  };
}

type ResidencyFormModalProps = {
  residency?: ResidencyRecord | null;
  companyId: string;
  defaultCategory?: string;
  defaultEmployeeId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
  onDelete?: (residency: ResidencyRecord) => void;
  onIssueInvoice?: (residency: ResidencyRecord) => void;
};

export function ResidencyFormModal({
  residency,
  companyId,
  defaultCategory = 'iqama_renewal',
  defaultEmployeeId = '',
  onSuccess,
  onClose,
  onDelete,
  onIssueInvoice,
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
  const [visaDurationMonths, setVisaDurationMonths] = useState(() => parseVisaDurationMonths(residency));
  const initialDates = buildServiceDateDefaults(residency, !isEdit, residency?.serviceCategory || defaultCategory);
  const [issueDate, setIssueDate] = useState(initialDates.issueDate);
  const [expiryDate, setExpiryDate] = useState(initialDates.expiryDate);
  const expiryDateManuallyEdited = useRef(false);
  const [transactionDate, setTransactionDate] = useState(initialDates.transactionDate);
  const [status, setStatus] = useState(residency?.status || 'active');
  const [notes, setNotes] = useState(residency?.notes || '');
  const [createInvoiceForService, setCreateInvoiceForService] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [supplierId, setSupplierId] = useState(
    residency?.supplierId || residency?.supplier?.id || '',
  );
  const supplierSelectionManuallyEdited = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { paymentVaults = [] } = useVaults({ companyId: cid });
  const vaults = paymentVaults as VaultOption[];
  const { suppliers = [] } = useSuppliers(cid);
  const requiresInvoiceSupplier = requiresInvoiceSupplierSelection(serviceCategory);
  const requiresServiceSupplier = requiresHrServiceSupplier(serviceCategory);

  const { data: employees = [] } = useApiListQuery<HrEmployee>({
    queryKey: employeeKeys.list(cid, false),
    queryFn: () => getEmployees(cid, false),
    fallbackMessage: t('employeesLoadFailed'),
    enabled: !!cid,
  });

  const activeEmployees = (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');
  const showIqama = requiresIqamaNumber(serviceCategory);

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => e.id === employeeId),
    [activeEmployees, employeeId],
  );

  const onEmployeeChange = (id: string) => {
    setEmployeeId(id);
    const emp = activeEmployees.find((e) => e.id === id);
    if (emp?.iqamaNumber && showIqama && !iqamaNumber) {
      setIqamaNumber(emp.iqamaNumber);
    }
  };

  useEffect(() => {
    if (!lockEmployee || !selectedEmployee?.iqamaNumber || !showIqama) return;
    if (!iqamaNumber) setIqamaNumber(selectedEmployee.iqamaNumber);
  }, [lockEmployee, selectedEmployee, showIqama, iqamaNumber]);

  useEffect(() => {
    if (!transactionDate) setTransactionDate(getSaudiToday());
  }, [transactionDate]);

  useEffect(() => {
    if (isEdit && residency) {
      const dates = buildServiceDateDefaults(residency, false, residency.serviceCategory || defaultCategory);
      setEmployeeId(residency.employeeId || '');
      setServiceCategory(residency.serviceCategory || defaultCategory);
      setIqamaNumber(residency.iqamaNumber || '');
      setReferenceLabel(residency.referenceLabel || '');
      setVisaDurationMonths(parseVisaDurationMonths(residency));
      setIssueDate(dates.issueDate);
      setExpiryDate(dates.expiryDate);
      expiryDateManuallyEdited.current = true;
      setTransactionDate(dates.transactionDate);
      setStatus(residency.status || 'active');
      setNotes(residency.notes || '');
      setSupplierId(residency.supplierId || residency.supplier?.id || '');
      supplierSelectionManuallyEdited.current = false;
      setError('');
      return;
    }
    if (!isEdit) {
      const dates = buildServiceDateDefaults(null, true, defaultCategory);
      setEmployeeId(defaultEmployeeId || '');
      setServiceCategory(defaultCategory);
      setIqamaNumber('');
      setReferenceLabel('');
      setVisaDurationMonths('');
      setIssueDate(dates.issueDate);
      setExpiryDate(dates.expiryDate);
      expiryDateManuallyEdited.current = false;
      setTransactionDate(dates.transactionDate);
      setStatus('active');
      setNotes('');
      setCreateInvoiceForService(false);
      setInvoiceAmount('');
      setVaultId('');
      setSupplierId('');
      supplierSelectionManuallyEdited.current = false;
      setError('');
    }
  }, [isEdit, residency?.id, defaultCategory, defaultEmployeeId]);

  useEffect(() => {
    if (supplierSelectionManuallyEdited.current || supplierId) return;
    const defaultSupplierId = defaultHrServiceSupplierId(serviceCategory, suppliers);
    if (defaultSupplierId) setSupplierId(defaultSupplierId);
  }, [serviceCategory, supplierId, suppliers]);

  const handleServiceCategoryChange = (category: string) => {
    setServiceCategory(category);
    setSupplierId(defaultHrServiceSupplierId(category, suppliers));
    supplierSelectionManuallyEdited.current = false;
    if (!isEdit && category === 'health_certificate') {
      setExpiryDate(addOneCalendarYearYmd(issueDate || getSaudiToday()));
      expiryDateManuallyEdited.current = false;
    }
  };

  const handleIssueDateChange = (value: string) => {
    setIssueDate(value);
    if (!isEdit && serviceCategory === 'health_certificate' && !expiryDateManuallyEdited.current) {
      setExpiryDate(addOneCalendarYearYmd(value));
    }
  };

  const handleExpiryDateChange = (value: string) => {
    setExpiryDate(value);
    expiryDateManuallyEdited.current = true;
  };

  const buildPayload = () => {
    const body: Record<string, unknown> = {
      companyId: cid,
      employeeId,
      serviceCategory,
      notes: notes || undefined,
      transactionDate: transactionDate ? `${transactionDate}T00:00:00.000Z` : undefined,
    };
    if (showIqama) body.iqamaNumber = iqamaNumber.trim();
    if (requiresVisaDurationMonths(serviceCategory)) {
      body.visaDurationMonths = parseInt(visaDurationMonths, 10);
    } else if (requiresExpiryDate(serviceCategory) && expiryDate) {
      body.expiryDate = `${expiryDate}T00:00:00.000Z`;
    }
    if (['iqama_new', 'iqama_renewal', 'medical_insurance', 'health_certificate'].includes(serviceCategory) && issueDate) {
      body.issueDate = `${issueDate}T00:00:00.000Z`;
    }
    if (['flight_ticket', 'medical_insurance', 'health_certificate'].includes(serviceCategory) && referenceLabel.trim()) {
      body.referenceLabel = referenceLabel.trim();
    }
    if (isEdit) body.status = status;
    if (supplierId) {
      body.supplierId = supplierId;
    } else if (isEdit) {
      body.supplierId = null;
    }
    return body;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.();
    setError('');
    if (!employeeId) {
      setError(t('requiredFields'));
      return;
    }
    if (showIqama && !/^\d{10}$/.test(iqamaNumber.trim())) {
      setError(t('iqamaNumberInvalid'));
      return;
    }
    if (requiresExpiryDate(serviceCategory) && !expiryDate) {
      setError(t('requiredFields'));
      return;
    }
    if (requiresReferenceLabel(serviceCategory) && !referenceLabel.trim()) {
      setError(t('requiredFields'));
      return;
    }
    if (requiresVisaDurationMonths(serviceCategory) && !visaDurationMonths) {
      setError(t('hrServiceVisaDurationRequired'));
      return;
    }
    if (requiresServiceSupplier && !supplierId && !defaultHrServiceSupplierId(serviceCategory, suppliers)) {
      setError(t('requiredFields'));
      return;
    }
    if (!isEdit && createInvoiceForService) {
      if (!vaultId || !invoiceAmount || parseFloat(invoiceAmount) <= 0) {
        setError(t('requiredFields'));
        return;
      }
      if (requiresInvoiceSupplier && !supplierId) {
        setError(t('requiredFields'));
        return;
      }
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        if (!residency?.id) {
          setError(t('saveFailed'));
          return;
        }
        const res = await updateResidency(residency.id, buildPayload(), cid);
        throwIfApiFailed(res, t('saveFailed'));
      } else {
        const payload = buildPayload() as Record<string, unknown>;
        if (createInvoiceForService && invoiceAmount && parseFloat(invoiceAmount) > 0) {
          payload.issueInvoice = {
            amount: parseFloat(invoiceAmount),
            vaultId,
            ...(requiresInvoiceSupplier ? { supplierId } : {}),
          };
        }
        const res = await createResidency(payload);
        throwIfApiFailed(res, t('saveFailed'));
      }
      onSuccess?.();
      onClose?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('saveFailed')));
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
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
            {
              key: 'delete',
              label: t('delete'),
              role: 'delete',
              hidden: !isEdit || !onDelete,
              className: 'me-auto',
              onClick: () => {
                if (residency) onDelete?.(residency);
              },
            },
            {
              key: 'issue-invoice',
              label: t('hrServiceIssueInvoice'),
              role: 'success',
              hidden: !isEdit || !onIssueInvoice || !!residency?.invoiceId,
              onClick: () => {
                if (residency) onIssueInvoice?.(residency);
              },
            },
            {
              key: 'save',
              label: submitting ? t('saving') : (isEdit ? t('save') : t('add')),
              role: 'save',
              type: 'submit',
              form: RESIDENCY_FORM_ID,
              disabled: submitting,
            },
          ]}
        />
      }
    >
      <form id={RESIDENCY_FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-0">
        {error && (
          <div className="mb-3 rounded-lg text-[13px] p-[10px] bg-noorix-red/10 text-noorix-red" role="alert">
            {error}
          </div>
        )}
        <Input
          type="select"
          label={t('hrServiceCategory')}
          value={serviceCategory}
          onChange={(e: ResidencyInputChange) => handleServiceCategoryChange(e.target.value)}
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
          onChange={(e: ResidencyInputChange) => onEmployeeChange(e.target.value)}
          required
          disabled={isEdit || lockEmployee}
        >
          <option value="">—</option>
          {activeEmployees.map((emp) => (
            <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
          ))}
        </Input>
        {lockEmployee && selectedEmployee && (
          <p className="text-[12px] text-noorix-muted -mt-2 mb-2">
            {employeeDisplayName(selectedEmployee, lang)}
          </p>
        )}

        <HrServiceFormFields
          t={t}
          lang={lang}
          serviceCategory={serviceCategory}
          companySponsorName={companySponsorName}
          iqamaNumber={iqamaNumber}
          setIqamaNumber={setIqamaNumber}
          referenceLabel={referenceLabel}
          setReferenceLabel={setReferenceLabel}
          visaDurationMonths={visaDurationMonths}
          setVisaDurationMonths={setVisaDurationMonths}
          issueDate={issueDate}
          setIssueDate={handleIssueDateChange}
          expiryDate={expiryDate}
          setExpiryDate={handleExpiryDateChange}
          transactionDate={transactionDate}
          setTransactionDate={setTransactionDate}
          showIqama={showIqama}
        />

        <div>
          <label className="block text-[12px] font-semibold mb-1" htmlFor="hr-service-supplier">
            {t('hrServiceEntitySupplier')}{requiresServiceSupplier ? ' *' : ''}
          </label>
          <SupplierSelect
            id="hr-service-supplier"
            suppliers={suppliers as SupplierRecord[]}
            value={supplierId}
            onChange={(value: string) => {
              supplierSelectionManuallyEdited.current = true;
              setSupplierId(value);
            }}
            placeholder={t('selectSupplierPlaceholder')}
          />
        </div>

        {!isEdit && (
          <>
            <Checkbox
              checked={createInvoiceForService}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateInvoiceForService(e.target.checked)}
              label={t('hrServiceIssueInvoice')}
              containerClassName="mb-3 text-[13px] mt-2"
            />
            {createInvoiceForService && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label={t('advanceAmount')}
                  value={invoiceAmount}
                  onChange={(e: ResidencyInputChange) => setInvoiceAmount(e.target.value)}
                />
                <Input
                  type="select"
                  label={t('selectVault')}
                  value={vaultId}
                  onChange={(e: ResidencyInputChange) => setVaultId(e.target.value)}
                  required
                >
                  <option value="">— {t('selectVault')} —</option>
                  {vaults.map((v) => (
                    <option key={v.id || ''} value={v.id || ''}>{vaultDisplayName(v, lang)}</option>
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
            onChange={(e: ResidencyInputChange) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </Input>
        )}

        {residency?.invoice?.invoiceNumber && (
          <div className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[13px]">
            <span className="text-noorix-muted">{t('invoiceNumber')}: </span>
            <span className="font-semibold ltr text-noorix-blue">{residency.invoice.invoiceNumber}</span>
            {residency.residencyInvoiceAmount != null && (
              <span className="ms-2 text-noorix-muted ltr">
                ({fmt(Number(residency.residencyInvoiceAmount))} <span className="nx-sar">SR</span>)
              </span>
            )}
          </div>
        )}

        <Input
          label={t('notes')}
          value={notes}
          onChange={(e: ResidencyInputChange) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />

      </form>
    </AdaptiveSheet>
  );
}
