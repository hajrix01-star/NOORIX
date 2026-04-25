/**
 * بعد إنهاء الخدمة — ملخص راتب متناسب مع الشهر، طباعة، رفع مستند، وإصدار فاتورة راتب مربوطة بآخر يوم دوام.
 */
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { useApp } from '../../../context/AppContext';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { useVaults } from '../../../hooks/useVaults';
import { getInvoices, uploadDocumentFile, createInvoice, createMovement } from '../../../services/api';
import { assertApiOk } from '../../../utils/apiResponse';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { openPrintWindow } from '../../../utils/printUtils';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { totalSalary } from '../utils/employeeSalaryMath';
import { getEmploymentProrationInMonth, toLocalDayKey } from '../utils/payrollAttendanceMath';
import { parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { hrFmt } from '../utils/hrFmt';
import { roundMoney2 } from '../../../utils/moneyInput';
import { Button, Modal, FmtNum, Input } from '../../../ui';

function payrollMonthFirstDay(terminationYmd) {
  const s = String(terminationYmd || '').slice(0, 10);
  if (s.length < 7) return null;
  return `${s.slice(0, 7)}-01`;
}

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function effectiveEndYmd(pr, fallbackYmd) {
  if (pr?.effectiveEnd) return toLocalDayKey(new Date(pr.effectiveEnd));
  return String(fallbackYmd || '').slice(0, 10);
}

export default function TerminationSettlementModal({
  open,
  onClose,
  /** موظف بحقول الراتب + notes تتضمن ميتا إنهاء الخدمة + status terminated */
  employee,
  companyId,
  companyName = '',
}) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { userPermissions = [] } = useApp();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [vaultId, setVaultId] = useState('');
  const [payoutAmountStr, setPayoutAmountStr] = useState('');
  const [txDateStr, setTxDateStr] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedInvoice, setIssuedInvoice] = useState(null);

  const canIssueInvoice =
    Array.isArray(userPermissions) &&
    (userPermissions.includes('INVOICES_WRITE') || userPermissions.includes('PURCHASES_WRITE'));
  const canCreateMovement = Array.isArray(userPermissions) && userPermissions.includes('HR_WRITE');

  const empId = employee?.id || '';
  const terminationYmd = useMemo(() => {
    const m = parseEmployeeNotesMeta(employee?.notes).meta?.terminationDate;
    return m ? String(m).slice(0, 10) : '';
  }, [employee?.notes]);

  const { paymentVaults = [] } = useVaults({ companyId });

  const { allowances: customRows = [] } = useCustomAllowances(companyId, empId);

  const customSum = useMemo(
    () => roundMoney2(customRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)),
    [customRows],
  );

  const { data: advanceInvoices = [] } = useQuery({
    queryKey: ['termination-settlement-advances', companyId, empId],
    queryFn: async () => {
      const res = await getInvoices(companyId, null, null, 1, 100, null, empId, 'advance');
      if (!res?.success) return [];
      const items = res.data?.items ?? [];
      return items.filter((inv) => inv.kind === 'advance' && inv.status !== 'cancelled');
    },
    enabled: open && !!companyId && !!empId,
    staleTime: 60 * 1000,
  });

  const advancesRemaining = useMemo(() => {
    let s = 0;
    for (const inv of advanceInvoices) {
      const total = Number(inv.totalAmount ?? 0);
      const settled = Number(inv.settledAmount ?? 0);
      s += Math.max(0, total - settled);
    }
    return roundMoney2(s);
  }, [advanceInvoices]);

  const monthFirst = payrollMonthFirstDay(terminationYmd);

  const preview = useMemo(() => {
    if (!employee || !monthFirst) return null;
    const fullMonthly = totalSalary(employee, customSum);
    const pr = getEmploymentProrationInMonth(employee, monthFirst);
    const grossProrated = roundMoney2(fullMonthly * pr.factor);
    const netSuggested = Math.max(0, roundMoney2(grossProrated - advancesRemaining));
    return {
      fullMonthly,
      pr,
      grossProrated,
      netSuggested,
    };
  }, [employee, monthFirst, customSum, advancesRemaining]);

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
            ${rows.map(([a, b]) => `<tr><td style="border:1px solid #ddd;padding:8px;font-weight:600;width:42%">${a}</td><td style="border:1px solid #ddd;padding:8px">${b}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    openPrintWindow({
      title: t('terminationSettlementTitle'),
      companyName: companyName || undefined,
      body,
    });
  }, [employee, preview, advancesRemaining, companyName, lang, t, monthFirst, terminationYmd]);

  const handleFile = async (e) => {
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
      assertApiOk(res, t('saveFailed'));
      queryClient.invalidateQueries({ queryKey: ['documents', companyId, empId] });
      queryClient.invalidateQueries({ queryKey: ['employee', empId, companyId] });
      showToast(t('documentUploaded'), 'success');
    } catch (err) {
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
    if (!preview || !monthFirst || !companyId || !empId) return;
    const amt = roundMoney2(parseFloat(String(payoutAmountStr).replace(',', '.')));
    if (!Number.isFinite(amt) || amt < 0.01) {
      showToast(t('terminationSettlementZeroPayout'), 'error');
      return;
    }
    if (!vaultId) {
      showToast(t('terminationSettlementSelectVault'), 'error');
      return;
    }
    const txDay = String(txDateStr || '').slice(0, 10);
    if (txDay.length !== 10) {
      showToast(t('saveFailed'), 'error');
      return;
    }
    const nameAr = employeeDisplayName(employee, 'ar', '');
    const lw = lastWorkYmd || terminationYmd;
    const notes =
      `راتب إنهاء خدمة — ${nameAr} — آخر يوم دوام ${lw} — شهر ${String(monthFirst).slice(0, 7)} ` +
      `(متناسب تقديري ${hrFmt(preview.grossProrated)}، سلف معلقة ${hrFmt(advancesRemaining)})`;
    const idempotencyKey = `termination-final-salary:${empId}:${monthFirst}`;

    setIssuing(true);
    try {
      const invRes = await createInvoice({
        companyId,
        employeeId: empId,
        kind: 'salary',
        totalAmount: amt,
        transactionDate: txDay,
        vaultId,
        isTaxable: false,
        notes: notes.slice(0, 2000),
        idempotencyKey,
      });
      assertApiOk(invRes, t('saveFailed'));
      const inv = invRes.data?.invoice;
      const invoiceNumber = inv?.invoiceNumber || inv?.id || '';
      const invoiceId = inv?.id || '';

      let movementOk = false;
      let movementErrMsg = '';
      if (canCreateMovement) {
        try {
          const movRes = await createMovement({
            companyId,
            employeeId: empId,
            movementType: 'other',
            amount: amt,
            effectiveDate: `${txDay}T12:00:00.000Z`,
            notes: `صرف راتب إنهاء خدمة — ${invoiceNumber} — آخر يوم دوام ${lw}`.slice(0, 2000),
          });
          assertApiOk(movRes, t('saveFailed'));
          movementOk = true;
        } catch (me) {
          movementErrMsg = me?.message || t('saveFailed');
        }
      }

      invalidateOnFinancialMutation(queryClient);
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId, 'advance', empId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId, 'hr-all', empId] });
      queryClient.invalidateQueries({ queryKey: ['movements', companyId, empId] });

      setIssuedInvoice({ invoiceNumber, invoiceId });
      const baseMsg = `${t('terminationSettlementInvoiceCreated')}: ${invoiceNumber}`;
      if (movementErrMsg) {
        showToast(`${baseMsg} — ${movementErrMsg}`, 'error');
      } else if (movementOk) {
        showToast(`${baseMsg} — ${t('terminationSettlementMovementRecorded')}`, 'success');
      } else {
        showToast(
          canCreateMovement ? baseMsg : `${baseMsg} — ${t('terminationSettlementMovementSkipped')}`,
          'success',
        );
      }
    } catch (err) {
      showToast(err?.message || t('saveFailed'), 'error');
    } finally {
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
      {!monthFirst || !preview ? (
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
              <Input
                type="select"
                label={t('terminationSettlementSelectVault')}
                value={vaultId}
                onChange={(e) => setVaultId(e.target.value)}
              >
                <option value="">—</option>
                {paymentVaults.map((v) => (
                  <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.name || v.id}</option>
                ))}
              </Input>
              <Input
                type="date"
                label={t('terminationSettlementTransactionDate')}
                value={txDateStr.slice(0, 10)}
                onChange={(e) => setTxDateStr(e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                label={t('terminationSettlementPayoutAmount')}
                value={payoutAmountStr}
                onChange={(e) => setPayoutAmountStr(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={issuing || !vaultId}
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
