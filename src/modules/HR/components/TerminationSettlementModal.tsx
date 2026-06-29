/**
 * بعد إنهاء الخدمة — ملخص راتب متناسب مع الشهر، طباعة، رفع مستند، وإصدار فاتورة راتب مربوطة بآخر يوم دوام.
 */
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { useApp } from '../../../context/AppContext';
import { useVaults } from '../../../hooks/useVaults';
import {
  createInvoice,
  createMovement,
  getEmployeeCompensationSnapshot,
  getInvoices,
  getMovements,
  throwIfApiFailed,
  unwrapApiList,
  uploadDocumentFile,
} from '../../../services/api';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { openPrintWindow } from '../../../utils/printUtils';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { toLocalDayKey } from '../utils/payrollAttendanceMath';
import { getAdvanceTotals } from '../utils/advanceBalance';
import {
  computeTerminationSalarySettlementPreview,
  getTerminationPayrollMonthFirstDay,
} from '../utils/hrCalculations/termination';
import { parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { hrFmt } from '../utils/hrFmt';
import { roundMoney2 } from '../../../utils/moneyInput';
import { Button, Modal, FmtNum, Input } from '../../../ui';
import { employeeKeys, hrKeys } from '../../../services/queryKeys';

function esc(v: any) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function effectiveEndYmd(pr: any, fallbackYmd: any) {
  if (pr?.effectiveEnd) return toLocalDayKey(new Date(pr.effectiveEnd));
  return toYmd(fallbackYmd);
}

function lastDayOfMonthYmd(monthFirstYmd: any) {
  const s = toYmd(monthFirstYmd);
  const parts = s.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return s;
  return toLocalDayKey(new Date(y, m, 0));
}

/** وسم في ملاحظة الفاتورة لمنع أكثر من تسوية إنهاء لنفس الموظف ونفس شهر المسيرة */
function terminationSalaryInvoiceTag(employeeId: any, monthFirstYmd: any) {
  const ym = toYmd(monthFirstYmd).slice(0, 7);
  return `[NOORIX_TERM_SALARY:${employeeId}:${ym}]`;
}

async function findTerminationSalaryInvoiceThisMonth(companyId: any, employeeId: any, monthFirstYmd: any, tag: any) {
  const from = toYmd(monthFirstYmd);
  const to = lastDayOfMonthYmd(from);
  const res = await getInvoices(companyId, from, to, 1, 100, null, employeeId, 'salary');
  const items = unwrapApiList<any>(res, 'فشل تحميل فواتير راتب إنهاء الخدمة');
  return (
    items.find(
      (inv: any) =>
        inv.kind === 'salary' &&
        inv.status !== 'cancelled' &&
        String(inv.notes || '').includes(tag),
    ) || null
  );
}

async function hasTerminationMovementForInvoiceNumber(companyId: any, employeeId: any, invoiceNumber: any) {
  if (!invoiceNumber) return false;
  const res = await getMovements(companyId, employeeId);
  const list = unwrapApiList<any>(res, 'فشل تحميل حركات الموظف');
  const marker = `صرف راتب إنهاء خدمة — ${invoiceNumber}`;
  return list.some((m: any) => String(m.notes || '').includes(marker));
}

export default function TerminationSettlementModal({
  open,
  onClose,
  /** موظف بحقول الراتب + notes تتضمن ميتا إنهاء الخدمة + status terminated */
  employee,
  companyId,
  companyName = '',
}: any) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { userPermissions = [] } = useApp();
  const queryClient = useQueryClient();
  const fileRef = useRef<any>(null);
  const issuingLockRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [vaultId, setVaultId] = useState('');
  const [payoutAmountStr, setPayoutAmountStr] = useState('');
  const [txDateStr, setTxDateStr] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedInvoice, setIssuedInvoice] = useState<any>(null);

  const canIssueInvoice =
    Array.isArray(userPermissions) &&
    (userPermissions.includes('INVOICES_WRITE') || userPermissions.includes('PURCHASES_WRITE'));
  const canCreateMovement = Array.isArray(userPermissions) && userPermissions.includes('HR_WRITE');

  const empId = employee?.id || '';
  const terminationYmd = useMemo(() => {
    const m = parseEmployeeNotesMeta(employee?.notes).meta?.terminationDate;
    return m ? toYmd(m) : '';
  }, [employee?.notes]);

  const { paymentVaults = [] } = useVaults({ companyId });

  const {
    data: compensationSnapshot,
    isLoading: compensationSnapshotLoading,
    error: compensationSnapshotError,
  } = useQuery({
    queryKey: hrKeys.compensationSnapshot(companyId, empId),
    queryFn: async () => {
      const res = await getEmployeeCompensationSnapshot(companyId, empId);
      throwIfApiFailed(res, t('loadingError'));
      return res.data;
    },
    enabled: open && !!companyId && !!empId,
  });

  const monthlyPackageTotal = compensationSnapshot?.salaryPackage?.total;
  const hasMonthlyPackageTotal = Number.isFinite(Number(monthlyPackageTotal)) && Number(monthlyPackageTotal) > 0;

  const { data: advanceInvoices = [] } = useQuery({
    queryKey: hrKeys.terminationAdvances(companyId, empId),
    queryFn: async () => {
      const res = await getInvoices(companyId, undefined, undefined, 1, 100, null, empId, 'advance');
      const items = unwrapApiList<any>(res, t('loadingError'));
      return items.filter((inv: any) => inv.kind === 'advance' && inv.status !== 'cancelled');
    },
    enabled: open && !!companyId && !!empId,
    staleTime: 60 * 1000,
  });

  const advancesRemaining = useMemo(() => {
    return roundMoney2(getAdvanceTotals(advanceInvoices).remainingAmount.toNumber());
  }, [advanceInvoices]);

  const monthFirst = getTerminationPayrollMonthFirstDay(terminationYmd);

  const termSalaryTag = useMemo(
    () => (empId && monthFirst ? terminationSalaryInvoiceTag(empId, monthFirst) : ''),
    [empId, monthFirst],
  );

  const { data: hasTerminationSalaryThisMonth = false, isFetching: checkingTerminationSalaryInvoice } = useQuery({
    queryKey: hrKeys.terminationSalaryExists(companyId, empId, monthFirst, termSalaryTag),
    queryFn: async () => {
      if (!companyId || !empId || !monthFirst || !termSalaryTag) return false;
      const hit = await findTerminationSalaryInvoiceThisMonth(companyId, empId, monthFirst, termSalaryTag);
      return !!hit;
    },
    enabled: open && !!companyId && !!empId && !!monthFirst && !!termSalaryTag,
    staleTime: 15_000,
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
    if (!employee || !preview || !terminationYmd) return;
    const name = employeeDisplayName(employee, lang);
    const co = esc(companyName || '—');
    const endDisp = formatSaudiDate(preview.pr.effectiveEnd || terminationYmd);
    const monthDisp = formatSaudiDate(monthFirst);
    const rows = [
      [`${t('employeeName')} / Employee`, esc(name)],
      [`${t('terminationDate')} / Termination`, esc(formatSaudiDate(terminationYmd))],
      [`${t('payrollMonth')} / Payroll month`, esc(monthDisp)],
      [`${t('terminationSettlementMonthlyTotal')} / Monthly package`, `${esc(hrFmt(preview.fullMonthly))} SR`],
      [`${t('terminationSettlementEmployedDays')} / Days in month`, `${esc(String(preview.pr.employedDays))} / ${esc(String(preview.pr.daysInMonth))}`],
      [`${t('terminationSettlementEffectiveEnd')} / Last work day`, esc(endDisp)],
      [`${t('terminationSettlementProratedGross')} / Prorated gross (est.)`, `${esc(hrFmt(preview.grossProrated))} SR`],
      [`${t('terminationSettlementAdvancesOutstanding')} / Advances`, `${esc(hrFmt(advancesRemaining))} SR`],
      [`${t('terminationSettlementSuggestedNet')} / Net (estimate)`, `${esc(hrFmt(preview.netSuggested))} SR`],
    ];
    const body = `
      <div style="font-family:Cairo,Tahoma,sans-serif;direction:rtl;padding:16px;max-width:720px;margin:0 auto">
        <h1 style="font-size:18px;margin:0 0 8px">${esc(t('terminationSettlementTitle'))}</h1>
        <p style="font-size:12px;color:#64748b;margin:0 0 16px">${esc(t('terminationSettlementDisclaimer'))}</p>
        <p style="font-size:13px;margin:0 0 8px"><strong>${esc(t('terminationSettlementCompany'))}:</strong> ${co}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tbody>
            ${rows.map(([a, b]: any) => `<tr><td style="border:1px solid #ddd;padding:8px;font-weight:600;width:42%">${a}</td><td style="border:1px solid #ddd;padding:8px">${b}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    openPrintWindow({
      title: t('terminationSettlementTitle'),
      companyName: companyName || undefined,
      body,
    });
  }, [employee, preview, advancesRemaining, companyName, lang, t, monthFirst, terminationYmd]);

  const handleFile = async (e: any) => {
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
    } catch (err: any) {
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
        `راتب إنهاء خدمة — ${nameAr} — آخر يوم دوام ${lw} — شهر ${toYmd(monthFirst).slice(0, 7)} ` +
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
              notes: `صرف راتب إنهاء خدمة — ${invoiceNumber} — آخر يوم دوام ${lw}`.slice(0, 2000),
            });
            throwIfApiFailed(movRes, t('saveFailed'));
            movementOk = true;
          } catch (me: any) {
            movementErrMsg = me?.message || t('saveFailed');
          }
        }
      }

      invalidateOnFinancialMutation(queryClient);
      queryClient.invalidateQueries({ queryKey: hrKeys.terminationSalaryExistsByEmployee(companyId, empId) });

      setIssuedInvoice({ invoiceNumber, invoiceId });
      const baseMsg = `${t('terminationSettlementInvoiceCreated')}: ${invoiceNumber}`;
      if (movementErrMsg) {
        showToast(`${baseMsg} — ${movementErrMsg}`, 'error');
      } else if (movementSkippedDuplicate) {
        showToast(`${baseMsg} — ${t('terminationSettlementReplayNoNewMovement')}`, 'success');
      } else if (movementOk) {
        showToast(`${baseMsg} — ${t('terminationSettlementMovementRecorded')}`, 'success');
      } else {
        showToast(
          canCreateMovement ? baseMsg : `${baseMsg} — ${t('terminationSettlementMovementSkipped')}`,
          'success',
        );
      }
    } catch (err: any) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
      issuingLockRef.current = false;
      setIssuing(false);
    }
  };

  if (!open || !employee) return null;

  const meta = parseEmployeeNotesMeta(employee.notes).meta || {};
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
        <Button variant="ghost" onClick={onClose}>{t('terminationSettlementClose')}</Button>
      }
    >
      <p className="m-0 mb-3 text-[13px] text-noorix-muted">{t('terminationSettlementSubtitle')}</p>
      {compensationSnapshotLoading ? (
        <p className="m-0 text-[13px] text-noorix-muted">{t('loading')}</p>
      ) : compensationSnapshotError || !compensationSnapshot ? (
        <p className="m-0 text-[13px] text-noorix-red">
          {compensationSnapshotError instanceof Error ? compensationSnapshotError.message : t('loadingError')}
        </p>
      ) : !hasMonthlyPackageTotal ? (
        <p className="m-0 text-[13px] text-noorix-red">{t('loadingError')}</p>
      ) : !monthFirst || !preview ? (
        <p className="m-0 text-[13px] text-noorix-red">{t('terminationSettlementMissingDate')}</p>
      ) : (
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
            {meta.terminationReason ? (
              <div className="flex justify-between gap-2">
                <span className="text-noorix-muted">{t('terminationReason')}</span>
                <span className="text-end">{meta.terminationReason}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <span className="text-noorix-muted">{t('payrollMonth')}</span>
              <span>{formatSaudiDate(monthFirst)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-noorix-muted">{t('terminationSettlementEffectiveEnd')}</span>
              <span className="font-medium nx-font-numbers">{lastWorkYmd ? formatSaudiDate(lastWorkYmd) : '—'}</span>
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
                onChange={(e: any) => setVaultId(e.target.value)}
              >
                <option value="">—</option>
                {paymentVaults.map((v: any) => (
                  <option key={v.id} value={v.id}>{vaultDisplayName(v, lang)}</option>
                ))}
              </Input>
              <Input
                type="date"
                label={t('terminationSettlementTransactionDate')}
                value={toYmd(txDateStr)}
                onChange={(e: any) => setTxDateStr(e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                label={t('terminationSettlementPayoutAmount')}
                value={payoutAmountStr}
                onChange={(e: any) => setPayoutAmountStr(e.target.value)}
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
                onClick={handleIssueInvoice}
              >
                {issuing ? '…' : t('terminationSettlementIssueInvoice')}
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
            <Button type="button" size="sm" onClick={handlePrint}>{t('terminationSettlementPrint')}</Button>
            <Button type="button" size="sm" variant="default" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? '…' : t('terminationSettlementUploadDoc')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              onChange={handleFile}
            />
          </div>
          <p className="m-0 text-[11px] text-noorix-muted">{t('terminationSettlementUploadHint')}</p>
        </div>
      )}
    </Modal>
  );
}
