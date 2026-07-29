/**
 * بعد إنهاء الخدمة - ملخص راتب متناسب مع الشهر، طباعة، رفع مستند، وإصدار فاتورة راتب مرتبطة بآخر يوم دوام.
 */
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiListQuery, useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { useApp } from '../../../context/AppContext';
import { useVaults } from '../../../hooks/useVaults';
import {
  createInvoice,
  createMovement,
  getEmployeeCompensationSnapshot,
  getInvoices,

  throwIfApiFailed,

  uploadDocumentFile,
} from '../../../services/api';
import { toYmd } from '../../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { getAdvanceTotals } from '../utils/advanceBalance';
import {
  computeTerminationSalarySettlementPreview,
  getTerminationPayrollMonthFirstDay,
} from '../utils/hrCalculations/termination';
import { parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { hrFmt } from '../utils/hrFmt';
import { roundMoney2 } from '../../../utils/moneyInput';
import { DialogActions, Modal, usePrintPreview } from '../../../ui';
import { employeeKeys, hrKeys } from '../../../services/queryKeys';
import {
  TerminationSettlementModalContent,
  type TerminationSettlementVault,
} from './TerminationSettlementModalContent';

type HrAny = ReturnType<typeof JSON.parse>;
import {
  effectiveEndYmd,
  findTerminationSalaryInvoiceThisMonth,
  hasTerminationMovementForInvoiceNumber,
  buildTerminationSettlementPrintHtml,
  terminationSalaryInvoiceTag,
} from './terminationSettlementHelpers';

export default function TerminationSettlementModal({
  open,
  onClose,
  /** موظف بحقوق الراتب وملاحظات تتضمن بيانات إنهاء الخدمة وحالة terminated */
  employee,
  companyId,
  companyName = '',
}: HrAny) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { userPermissions = [], companies } = useApp();
  const queryClient = useQueryClient();
  const fileRef = useRef<HrAny>(null);
  const issuingLockRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [vaultId, setVaultId] = useState('');
  const [payoutAmountStr, setPayoutAmountStr] = useState('');
  const [txDateStr, setTxDateStr] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedInvoice, setIssuedInvoice] = useState<HrAny>(null);

  const canIssueInvoice =
    Array.isArray(userPermissions) &&
    (userPermissions.includes('INVOICES_WRITE') || userPermissions.includes('PURCHASES_WRITE'));
  const canCreateMovement = Array.isArray(userPermissions) && userPermissions.includes('HR_WRITE');

  const empId = employee?.id || '';
  const activeCompany = (companies as Array<{ id?: string | null; logoUrl?: string | null }> | undefined)?.find(
    (row) => row.id === companyId,
  );
  const companyLogoUrl = String(activeCompany?.logoUrl || '').trim();
  const { openPrintPreview, printPreviewModal } = usePrintPreview({
    title: t('terminationSettlementTitle'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });
  const terminationYmd = useMemo(() => {
    const m = parseEmployeeNotesMeta(employee?.notes).meta?.terminationDate;
    return m ? toYmd(m) : '';
  }, [employee?.notes]);

  const { paymentVaults = [] } = useVaults({ companyId });

  const {
    data: compensationSnapshot,
    isLoading: compensationSnapshotLoading,
    error: compensationSnapshotError,
  } = useApiQuery<HrAny>({
    queryKey: hrKeys.compensationSnapshot(companyId, empId),
    queryFn: () => getEmployeeCompensationSnapshot(companyId, empId),
    enabled: open && !!companyId && !!empId,
    fallbackMessage: t('loadingError'),
  });

  const monthlyPackageTotal = compensationSnapshot?.salaryPackage?.total;
  const hasMonthlyPackageTotal = Number.isFinite(Number(monthlyPackageTotal)) && Number(monthlyPackageTotal) > 0;

  const { data: advanceInvoices = [] } = useApiListQuery<HrAny>({
    queryKey: hrKeys.terminationAdvances(companyId, empId),
    queryFn: () => getInvoices(companyId, undefined, undefined, 1, 100, null, empId, 'advance'),
    select: (items) => items.filter((inv: HrAny) => inv.kind === 'advance' && inv.status !== 'cancelled'),
    enabled: open && !!companyId && !!empId,
    staleTime: 60 * 1000,
    fallbackMessage: t('loadingError'),
  });

  const advancesRemaining = useMemo(() => {
    return roundMoney2(getAdvanceTotals(advanceInvoices).remainingAmount.toNumber());
  }, [advanceInvoices]);

  const monthFirst = getTerminationPayrollMonthFirstDay(terminationYmd);

  const termSalaryTag = useMemo(
    () => (empId && monthFirst ? terminationSalaryInvoiceTag(empId, monthFirst) : ''),
    [empId, monthFirst],
  );

  const { data: hasTerminationSalaryThisMonth = false, isFetching: checkingTerminationSalaryInvoice } = useApiQuery<boolean>({
    queryKey: hrKeys.terminationSalaryExists(companyId, empId, monthFirst, termSalaryTag),
    queryFn: async () => {
      if (!companyId || !empId || !monthFirst || !termSalaryTag) return { success: true, data: false };
      const hit = await findTerminationSalaryInvoiceThisMonth(companyId, empId, monthFirst, termSalaryTag);
      return { success: true, data: !!hit };
    },
    enabled: open && !!companyId && !!empId && !!monthFirst && !!termSalaryTag,
    staleTime: 15_000,
    fallbackMessage: t('loadingError'),
  });

  const preview = useMemo(() => {
    return computeTerminationSalarySettlementPreview({
      employee,
      terminationDate: terminationYmd,
      monthlyPackageTotal,
      advancesRemaining,
    });
  }, [employee, terminationYmd, monthlyPackageTotal, advancesRemaining]);

  const lastWorkYmd = useMemo(() => {
    if (!preview || !terminationYmd) return '';
    return effectiveEndYmd(preview.pr, terminationYmd);
  }, [preview, terminationYmd]);

  useEffect(() => {
    if (!open || !preview || !terminationYmd) return;
    setTxDateStr(lastWorkYmd || terminationYmd);
    setPayoutAmountStr(String(preview.netSuggested));
    setIssuedInvoice(null);
  }, [open, empId, terminationYmd, lastWorkYmd, preview?.netSuggested]);

  useEffect(() => {
    if (!open || !companyId) return;
    const first = paymentVaults[0]?.id || '';
    setVaultId(first);
  }, [open, companyId, empId, paymentVaults]);

  const handlePrint = useCallback(() => {
    if (!employee || !preview || !terminationYmd || !monthFirst) return;
    const html = buildTerminationSettlementPrintHtml({
      employee,
      lang,
      companyName,
      companyLogoUrl,
      terminationYmd,
      monthFirst,
      preview,
      advancesRemaining,
      t,
    });
    openPrintPreview({ title: t('terminationSettlementTitle'), html });
  }, [employee, preview, advancesRemaining, companyName, companyLogoUrl, lang, t, monthFirst, terminationYmd, openPrintPreview]);

  const handleFile = async (e: HrAny) => {
    const file = e?.target?.files?.[0];
    if (!file || !empId || !companyId) return;
    setUploading(true);
    try {
      const res = await uploadDocumentFile({
        companyId,
        employeeId: empId,
        documentType: 'other',
        file,
      });
      throwIfApiFailed(res, t('saveFailed'));
      queryClient.invalidateQueries({ queryKey: hrKeys.documents(companyId, empId) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(empId, companyId) });
      showToast(t('documentUploaded'), 'success');
    } catch (err: HrAny) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleIssueInvoice = async () => {
    if (!canIssueInvoice) {
      showToast(t('terminationSettlementNeedInvoicePermission'), 'error');
      return;
    }
    if (!preview || !monthFirst || !companyId || !empId || !termSalaryTag) return;
    const amt = roundMoney2(parseFloat(String(payoutAmountStr).replace(',', '.')));
    if (!Number.isFinite(amt) || amt < 0.01) {
      showToast(t('terminationSettlementZeroPayout'), 'error');
      return;
    }
    if (!vaultId) {
      showToast(t('terminationSettlementSelectVault'), 'error');
      return;
    }
    const txDay = toYmd(txDateStr);
    if (txDay.length !== 10) {
      showToast(t('saveFailed'), 'error');
      return;
    }

    if (issuingLockRef.current) return;
    issuingLockRef.current = true;
    setIssuing(true);
    try {
      const dup = await findTerminationSalaryInvoiceThisMonth(companyId, empId, monthFirst, termSalaryTag);
      if (dup) {
        showToast(t('terminationSettlementDuplicateMonth'), 'error');
        setIssuedInvoice({
          invoiceNumber: dup.invoiceNumber || dup.id || '',
          invoiceId: dup.id || '',
        });
        queryClient.invalidateQueries({ queryKey: hrKeys.terminationSalaryExistsByEmployee(companyId, empId) });
        return;
      }

      const nameAr = employeeDisplayName(employee, 'ar', '');
      const lw = lastWorkYmd || terminationYmd;
      const baseNotes =
        `راتب إنهاء خدمة - ${nameAr} - آخر يوم دوام ${lw} - شهر ${toYmd(monthFirst).slice(0, 7)} ` +
        `(متناسب تقديري ${hrFmt(preview.grossProrated)}، سلف معلقة ${hrFmt(advancesRemaining)})`;
      const tag = termSalaryTag;
      let bodyNotes = baseNotes.trim();
      if (bodyNotes.length + 1 + tag.length > 2000) {
        bodyNotes = bodyNotes.slice(0, Math.max(0, 2000 - tag.length - 1)).trimEnd();
      }
      const notes = `${bodyNotes} ${tag}`.slice(0, 2000);
      const idempotencyKey = `termination-final-salary:${empId}:${monthFirst}`;

      const invRes = await createInvoice({
        companyId,
        employeeId: empId,
        kind: 'salary',
        totalAmount: amt,
        transactionDate: txDay,
        vaultId,
        isTaxable: false,
        notes,
        idempotencyKey,
      });
      throwIfApiFailed(invRes, t('saveFailed'));
      const inv = invRes.data?.invoice;
      const invoiceNumber = inv?.invoiceNumber || inv?.id || '';
      const invoiceId = inv?.id || '';

      let movementOk = false;
      let movementErrMsg = '';
      let movementSkippedDuplicate = false;
      if (canCreateMovement && invoiceNumber) {
        if (await hasTerminationMovementForInvoiceNumber(companyId, empId, invoiceNumber)) {
          movementSkippedDuplicate = true;
        } else {
          try {
            const movRes = await createMovement({
              companyId,
              employeeId: empId,
              movementType: 'other',
              amount: amt,
              effectiveDate: `${txDay}T12:00:00.000Z`,
              notes: `صرف راتب إنهاء خدمة - ${invoiceNumber} - آخر يوم دوام ${lw}`.slice(0, 2000),
            });
            throwIfApiFailed(movRes, t('saveFailed'));
            movementOk = true;
          } catch (me: HrAny) {
            movementErrMsg = me?.message || t('saveFailed');
          }
        }
      }

      invalidateOnFinancialMutation(queryClient);
      queryClient.invalidateQueries({ queryKey: hrKeys.terminationSalaryExistsByEmployee(companyId, empId) });

      setIssuedInvoice({ invoiceNumber, invoiceId });
      const baseMsg = `${t('terminationSettlementInvoiceCreated')}: ${invoiceNumber}`;
      if (movementErrMsg) {
        showToast(`${baseMsg} - ${movementErrMsg}`, 'error');
      } else if (movementSkippedDuplicate) {
        showToast(`${baseMsg} - ${t('terminationSettlementReplayNoNewMovement')}`, 'success');
      } else if (movementOk) {
        showToast(`${baseMsg} - ${t('terminationSettlementMovementRecorded')}`, 'success');
      } else {
        showToast(
          canCreateMovement ? baseMsg : `${baseMsg} - ${t('terminationSettlementMovementSkipped')}`,
          'success',
        );
      }
    } catch (err: HrAny) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
      issuingLockRef.current = false;
      setIssuing(false);
    }
  };

  if (!open || !employee) return null;

  const meta = parseEmployeeNotesMeta(employee.notes).meta || {};
  const terminationReason = meta.terminationReason == null ? '' : String(meta.terminationReason);
  const invoiceListHref =
    issuedInvoice?.invoiceNumber != null
      ? `/invoices?kind=salary&q=${encodeURIComponent(String(issuedInvoice.invoiceNumber))}`
      : '/invoices?kind=salary';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('terminationSettlementTitle')}
      size="md"
      footer={
        <DialogActions
          actions={[
            {
              key: 'close',
              label: t('terminationSettlementClose'),
              role: 'close',
              onClick: onClose,
            },
          ]}
        />
      }
    >
      {printPreviewModal}
      <p className="m-0 mb-3 text-[13px] text-noorix-muted">{t('terminationSettlementSubtitle')}</p>
      <TerminationSettlementModalContent
        t={t}
        lang={lang}
        employee={employee}
        empId={empId}
        terminationYmd={terminationYmd}
        terminationReason={terminationReason}
        monthFirst={monthFirst || ''}
        lastWorkYmd={lastWorkYmd}
        preview={preview}
        advancesRemaining={advancesRemaining}
        compensationSnapshotLoading={compensationSnapshotLoading}
        compensationSnapshotError={compensationSnapshotError}
        hasCompensationSnapshot={!!compensationSnapshot}
        hasMonthlyPackageTotal={hasMonthlyPackageTotal}
        canIssueInvoice={canIssueInvoice}
        hasTerminationSalaryThisMonth={hasTerminationSalaryThisMonth}
        checkingTerminationSalaryInvoice={checkingTerminationSalaryInvoice}
        paymentVaults={paymentVaults as TerminationSettlementVault[]}
        vaultId={vaultId}
        payoutAmountStr={payoutAmountStr}
        txDateStr={txDateStr}
        issuing={issuing}
        uploading={uploading}
        issuedInvoice={issuedInvoice}
        invoiceListHref={invoiceListHref}
        fileRef={fileRef}
        onVaultIdChange={setVaultId}
        onTxDateChange={setTxDateStr}
        onPayoutAmountChange={setPayoutAmountStr}
        onIssueInvoice={handleIssueInvoice}
        onPrint={handlePrint}
        onFileChange={handleFile}
      />
    </Modal>
  );
}
