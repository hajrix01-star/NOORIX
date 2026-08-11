import React from 'react';
import { useApiQuery } from '../../../hooks/useApiQuery';
import {
  confirmProvenPayrollLegacySubset,
  createHistoricalPartTimePayrollLink,
  getPayrollReconciliation,
  previewProvenPayrollLegacySubset,
} from '../../../services/api';
import { hrKeys } from '../../../services/queryKeys';
import { Button, FmtNum, cn } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import {
  normalizePayrollReconciliationResponse,
  type PayrollReconciliationConfidence,
  type PayrollReconciliationMonth,
  type PayrollReconciliationReviewStatus,
} from './payrollReconciliationModel';

type PayrollReconciliationPanelProps = {
  companyId: string;
  year: number;
  onClose: () => void;
};

const confidenceLabels: Record<PayrollReconciliationConfidence, string> = {
  high: 'ثقة عالية',
  medium: 'ثقة متوسطة',
  low: 'ثقة منخفضة',
  unknown: 'غير مصنف',
};

const reviewStatusLabels: Record<PayrollReconciliationReviewStatus, string> = {
  matched: 'متطابق',
  needs_review: 'يحتاج مراجعة',
  reviewed: 'تمت مراجعته',
  unknown: 'غير مراجع',
};

const sourceLabels: Record<string, string> = {
  structured: 'تسوية مرتبطة جديدة',
  unexplained_payroll_ledger: 'قيد رواتب غير مفسّر',
  documented_historical_repair: 'تسوية تاريخية موثقة',
  structured_advance_settlement: 'تسوية مرتبطة جديدة',
  legacy_advance_settlement: 'تسوية قديمة غير مرتبطة',
  legacy_ledger: 'تسوية قديمة غير مرتبطة',
  salary_invoice: 'فاتورة راتب',
  historical_standalone_salary: 'راتب إضافي تاريخي',
  payroll_run: 'مسير راتب',
};

// Historical links only explain a pre-existing ledger cost; they do not post money.
sourceLabels.historical_part_time_payroll = 'راتب دوام جزئي تاريخي';

function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, 1));
}

function statusClass(status: PayrollReconciliationReviewStatus): string {
  if (status === 'matched' || status === 'reviewed') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'needs_review') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-noorix-border bg-noorix-surface-muted text-noorix-muted';
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'success' }) {
  return (
    <div className="min-w-0 rounded-xl border border-noorix-border bg-white px-3 py-2.5 text-center">
      <div className="text-[11px] text-noorix-muted">{label}</div>
      <FmtNum
        n={value}
        className={cn(
          'mt-1 block text-[15px] font-black',
          tone === 'danger' && 'text-red-600',
          tone === 'success' && 'text-noorix-green',
        )}
      />
    </div>
  );
}

type ProvenSubsetPreview = {
  correctionMode: 'proven_subset';
  selectedLegacyTotal: number;
  differenceAfter: number;
  previewHash: string;
  ledgerEntryIds: string[];
};

function MonthReview({
  item,
  companyId,
  onCorrected,
}: {
  item: PayrollReconciliationMonth;
  companyId: string;
  onCorrected: () => void;
}) {
  const hasDifference = Math.abs(item.difference) >= 0.005;
  const [pendingRun, setPendingRun] = React.useState<string | null>(null);
  const [pendingPartTimeLedgerId, setPendingPartTimeLedgerId] = React.useState<string | null>(null);
  const [correctionError, setCorrectionError] = React.useState<string | null>(null);
  const [partTimeLinkSuccess, setPartTimeLinkSuccess] = React.useState<string | null>(null);
  const provenGroups = React.useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const row of item.rows) {
      if (row.source !== 'legacy_ledger' || !row.id || row.runNumber === '—') continue;
      const ids = groups.get(row.runNumber) ?? [];
      ids.push(row.id);
      groups.set(row.runNumber, ids);
    }
    return [...groups.entries()].map(([runNumber, ledgerEntryIds]) => ({ runNumber, ledgerEntryIds }));
  }, [item.rows]);

  const applyProvenSubset = async (runNumber: string, ledgerEntryIds: string[]) => {
    setCorrectionError(null);
    setPendingRun(runNumber);
    try {
      const previewResult = await previewProvenPayrollLegacySubset(companyId, {
        targetMonth: item.month,
        sourceRunNumber: runNumber,
        ledgerEntryIds,
      });
      const preview = previewResult.success ? previewResult.data as ProvenSubsetPreview : null;
      if (!preview || preview.correctionMode !== 'proven_subset' || !preview.previewHash) {
        throw new Error(previewResult.error || 'لم يثبت النظام أن القيود المحددة مكررة.');
      }
      const accepted = window.confirm(
        `سيُلغي النظام ${preview.selectedLegacyTotal.toLocaleString('en-US')} ر.س من القيود التاريخية المثبتة فقط.\n\n`
        + `سيبقى فرق ${preview.differenceAfter.toLocaleString('en-US')} ر.س للمراجعة، ولن تتغير الفواتير أو الخزائن أو السلف أو المسيرات.\n\nهل تعتمد التصحيح؟`,
      );
      if (!accepted) return;
      const confirmResult = await confirmProvenPayrollLegacySubset(companyId, {
        targetMonth: item.month,
        sourceRunNumber: runNumber,
        ledgerEntryIds: preview.ledgerEntryIds,
        previewHash: preview.previewHash,
        idempotencyKey: `payroll-subset-${companyId}-${item.month}-${runNumber}-${Date.now()}`,
        reason: 'إلغاء قيود تسوية سلف تاريخية مكررة ومثبتة مع إبقاء الفروقات الأخرى للمراجعة.',
        confirmation: 'CANCEL_PROVEN_PAYROLL_DUPLICATE_SUBSET',
      });
      if (!confirmResult.success) throw new Error(confirmResult.error || 'تعذر حفظ التصحيح.');
      onCorrected();
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : 'تعذر تنفيذ التصحيح المحكوم.');
    } finally {
      setPendingRun(null);
    }
  };

  const linkHistoricalPartTime = async (ledgerEntryId: string) => {
    setCorrectionError(null);
    setPartTimeLinkSuccess(null);
    setPendingPartTimeLedgerId(ledgerEntryId);
    try {
      const accepted = window.confirm('سيُربط هذا القيد الموجود فقط كراتب دوام جزئي تاريخي. لن يتغير أي قيد أو فاتورة أو خزينة أو سلفة. الاسم يُؤخذ من القيد أو الوصف عند التطابق المؤكد فقط؛ وإلا يُحفظ بدون اسم موظف. هل تعتمد الربط؟');
      if (!accepted) return;
      const result = await createHistoricalPartTimePayrollLink(companyId, {
        ledgerEntryId,
        targetMonth: item.month,
        confirmation: 'LINK_HISTORICAL_PART_TIME_PAYROLL',
      });
      if (!result.success) throw new Error(result.error || 'تعذر حفظ ربط الدوام الجزئي التاريخي.');
      setPartTimeLinkSuccess('تم ربط القيد كدوام جزئي تاريخي وتحديث المطابقة، دون تغيير أي مبلغ أو فاتورة أو خزينة أو سلفة.');
      onCorrected();
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : 'تعذر حفظ الربط الآمن.');
    } finally {
      setPendingPartTimeLedgerId(null);
    }
  };

  return (
    <details className="group overflow-hidden rounded-2xl border border-noorix-border bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 marker:hidden">
        <div className="min-w-0">
          <div className="font-black text-noorix-text">{formatMonth(item.month)}</div>
          <div className="mt-0.5 text-[11px] text-noorix-muted">
            الفرق: <FmtNum n={item.difference} className={cn('font-bold', hasDifference ? 'text-red-600' : 'text-noorix-green')} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold', statusClass(item.reviewStatus))}>
            {reviewStatusLabels[item.reviewStatus]}
          </span>
          <span className="text-[11px] text-noorix-muted">{confidenceLabels[item.confidence]}</span>
          <span aria-hidden="true" className="text-noorix-muted transition-transform group-open:rotate-180">⌄</span>
        </div>
      </summary>

      <div className="border-t border-noorix-border bg-noorix-surface-muted/40 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-9">
          <Metric label="إجمالي المسيرات" value={item.payrollRunsTotal} />
          <Metric label="رواتب إضافية تاريخية" value={item.standaloneSalaryPaymentsTotal} />
          <Metric label="قيود رواتب غير مفسّرة" value={item.unexplainedPayrollLedgerTotal} tone={item.unexplainedPayrollLedgerTotal ? 'danger' : undefined} />
          <Metric label="فواتير الرواتب" value={item.salaryInvoicesTotal} />
          <Metric label="تسويات مرتبطة جديدة" value={item.structuredAdvanceSettlementsTotal} />
          <Metric label="تسويات تاريخية موثقة" value={item.documentedHistoricalRepairTotal} />
          <Metric label="تسويات قديمة غير مرتبطة" value={item.legacyAdvanceSettlementLedgerTotal} tone={item.legacyAdvanceSettlementLedgerTotal ? 'danger' : undefined} />
          <Metric label="تكلفة الرواتب في السجل" value={item.ledgerPayrollCostTotal} />
          <Metric label="الفرق" value={item.difference} tone={hasDifference ? 'danger' : 'success'} />
        </div>

        {item.historicalPartTimePayrollTotal ? (
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800">
            دوام جزئي تاريخي موثّق: <FmtNum n={item.historicalPartTimePayrollTotal} />
          </div>
        ) : null}

        {partTimeLinkSuccess ? (
          <div role="status" className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800">
            {partTimeLinkSuccess}
          </div>
        ) : null}

        {correctionError ? (
          <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
            {correctionError}
          </div>
        ) : null}

        {provenGroups.length ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
            <div className="font-bold">قيود تاريخية مرشحة لتصحيح مثبت</div>
            <div className="mt-1 text-amber-800">المعاينة على الخادم هي التي تحدد المبلغ النهائي؛ لا يمكن اختيار مبلغ أو قيد يدويًا.</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {provenGroups.map((group) => (
                <Button
                  key={group.runNumber}
                  size="sm"
                  variant="primary"
                  loading={pendingRun === group.runNumber}
                  disabled={pendingRun !== null}
                  onClick={() => applyProvenSubset(group.runNumber, group.ledgerEntryIds)}
                >
                  معاينة تصحيح {group.runNumber}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {item.rows.length ? (
          <div className="mt-3 space-y-2">
            <div className="text-[12px] font-bold text-noorix-text">تفاصيل القيود والتسويات</div>
            {item.rows.map((row) => (
              <div key={row.id} className="grid gap-2 rounded-xl border border-noorix-border bg-white px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <strong>{row.employeeName}</strong>
                    <span className="text-noorix-muted">{row.runNumber}</span>
                    <span className="text-noorix-muted">{row.advanceInvoiceNumber}</span>
                    {row.date ? <span className="text-noorix-muted">{formatSaudiDate(row.date)}</span> : null}
                  </div>
                  {row.reason ? <div className="mt-1 text-[11px] text-noorix-muted">{row.reason}</div> : null}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  {row.source === 'unexplained_payroll_ledger' && row.ledgerEntryId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pendingPartTimeLedgerId === row.ledgerEntryId}
                      disabled={pendingPartTimeLedgerId !== null}
                      onClick={() => linkHistoricalPartTime(row.ledgerEntryId!)}
                    >
                      ربط كدوام جزئي
                    </Button>
                  ) : null}
                  {row.source ? <span className="text-[10px] font-semibold text-noorix-muted">{sourceLabels[row.source] || row.source}</span> : null}
                  <span className="text-[10px] text-noorix-muted">{confidenceLabels[row.confidence]}</span>
                  <FmtNum n={row.amount} className="font-black" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-noorix-border bg-white px-3 py-4 text-center text-[12px] text-noorix-muted">
            لا توجد قيود تفصيلية لهذا الشهر.
          </div>
        )}
      </div>
    </details>
  );
}

export function PayrollReconciliationPanel({ companyId, year, onClose }: PayrollReconciliationPanelProps) {
  const query = useApiQuery<unknown, PayrollReconciliationMonth[]>({
    queryKey: hrKeys.payrollReconciliation(companyId, year),
    queryFn: () => getPayrollReconciliation(companyId, year),
    select: normalizePayrollReconciliationResponse,
    enabled: !!companyId,
    staleTime: 30_000,
  });

  return (
    <section className="rounded-2xl border border-noorix-border bg-noorix-surface-muted/30 p-3 sm:p-4" aria-label="مراجعة الرواتب الشهرية">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-black text-noorix-text">مراجعة الرواتب الشهرية</h3>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-noorix-muted">
            عرض للقراءة فقط يقارن إجمالي المسيرات مع تكلفة الرواتب في السجل المحاسبي. الفواتير وتسويات السلف معلومات تشخيصية، ولا يحذف العرض أو يصحح أي قيد تلقائيًا.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>إغلاق المراجعة</Button>
      </div>

      {query.isLoading ? (
        <div className="rounded-xl border border-noorix-border bg-white px-4 py-8 text-center text-[13px] text-noorix-muted">جارٍ تحميل المراجعة…</div>
      ) : query.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-[13px] text-red-700">
          تعذر تحميل مراجعة الرواتب. لم يتم تغيير أي بيانات.
        </div>
      ) : query.data?.length ? (
        <div className="space-y-2">
          {query.data.map((item) => (
            <MonthReview key={item.month} item={item} companyId={companyId} onCorrected={() => { void query.refetch(); }} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-noorix-border bg-white px-4 py-8 text-center text-[13px] text-noorix-muted">
          لا توجد بيانات مراجعة لسنة {year}.
        </div>
      )}
    </section>
  );
}
