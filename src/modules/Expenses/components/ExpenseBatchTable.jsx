/**
 * ExpenseBatchTable — إدخال جماعي لمصاريف (ثابت/متغير)
 * كل صف: بند مصروف، رقم فاتورة، مبلغ، ملاحظات
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { createInvoiceBatch, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { getSaudiToday } from '../../../utils/saudiDate';
import { fmt, calcReverseVat } from '../../../utils/format';
import SmartTable from '../../../components/common/SmartTable';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, ScreenShell, cn } from '../../../ui';

const EMPTY_ROW = () => ({
  key: `${Date.now()}-${Math.random()}`,
  expenseLineId: '',
  supplierInvoiceNumber: '',
  totalInclusive: '',
  notes: '',
});

export default function ExpenseBatchTable({ companyId, onSaved, embedded }) {
  const { lang, t } = useTranslation();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() => [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  const [vaultId, setVaultId] = useState('');

  const { data: expenseLines = [] } = useQuery({
    queryKey: ['expense-lines', companyId],
    queryFn: async () => {
      const res = await getExpenseLines(companyId);
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!companyId,
  });

  const { paymentVaults: activeVaults = [] } = useVaults({ companyId });

  const validRows = useMemo(() => {
    return rows.filter((r) => {
      if (!r.expenseLineId || Number(r.totalInclusive) <= 0) return false;
      const line = expenseLines.find((l) => l.id === r.expenseLineId);
      const isTaxable = !line?.category?.account?.taxExempt;
      if (isTaxable && !r.supplierInvoiceNumber?.trim()) return false;
      return true;
    });
  }, [rows, expenseLines]);

  const summary = useMemo(() => {
    let totalNet = 0;
    let totalTax = 0;
    for (const r of validRows) {
      const { net, tax } = calcReverseVat(r.totalInclusive, true);
      totalNet += net;
      totalTax += tax;
    }
    return { totalNet, totalTax, total: totalNet + totalTax, count: validRows.length };
  }, [validRows]);

  const saveMutation = useApiMutation({
    mutationFn: async () => {
      if (!vaultId) throw new Error(t('expenseBatchSelectVault'));
      if (validRows.length === 0) throw new Error(t('expenseBatchNoValidRows'));
      // مفتاح عدم التكرار: يُولَّد عند كل نقرة — يمنع الحفظ المزدوج إن تكرر الطلب
      const idempotencyKey = `exp-${companyId}-${batchDate}-${Date.now()}`;
      const res = await createInvoiceBatch({
        companyId,
        transactionDate: batchDate,
        vaultId,
        idempotencyKey,
        items: validRows.map((r) => {
          const line = expenseLines.find((l) => l.id === r.expenseLineId);
          const lineName = line?.nameAr || line?.nameEn || line?.name || '';
          const userNote = r.notes?.trim();
          const autoNote = lineName
            ? (userNote ? `${lineName} — ${userNote}` : lineName)
            : (userNote || undefined);
          return {
            expenseLineId: r.expenseLineId,
            supplierInvoiceNumber: r.supplierInvoiceNumber?.trim(),
            kind: line?.kind || 'expense',
            totalAmount: parseFloat(r.totalInclusive),
            isTaxable: !line?.category?.account?.taxExempt,
            notes: autoNote,
          };
        }),
      });
      return res;
    },
    successToast: false,
    showErrorToast: true,
    errorToast: (e) => e?.message || t('saveFailedGeneric'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
      onSaved?.();
    },
  });

  const updateRow = (i, updates) => {
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...updates } : r)));
  };

  const addRow = () => setRows((p) => [...p, EMPTY_ROW()]);
  const removeRow = (i) => setRows((p) => (p.length <= 1 ? [EMPTY_ROW()] : p.filter((_, idx) => idx !== i)));

  const tableData = rows.map((r, i) => {
    const line = expenseLines.find((l) => l.id === r.expenseLineId);
    const { net, tax } = calcReverseVat(r.totalInclusive, true);
    return {
      ...r,
      index: i + 1,
      lineName: line?.nameAr || line?.nameEn || '—',
      categoryName: line?.category?.nameAr || line?.category?.nameEn || '—',
      supplierName: (lang === 'en' ? line?.supplier?.nameEn || line?.supplier?.nameAr : line?.supplier?.nameAr || line?.supplier?.nameEn) || '—',
      kind: line?.kind === 'fixed_expense' ? 'ثابت' : 'متغير',
      net,
      tax,
    };
  });

  const columns = [
    { key: 'index', label: '#', shrink: true, render: (v) => <span className="nx-cell-muted">{v}</span> },
    {
      key: 'expenseLineId',
      label: 'بند المصروف (يُملأ تلقائياً)',
      render: (_, row) => (
        <Input
          type="select"
          size="sm"
          value={row.expenseLineId}
          onChange={(e) => updateRow(row.index - 1, { expenseLineId: e.target.value })}
        >
          <option value="">— اختر —</option>
          {expenseLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nameAr || l.nameEn} ({l.kind === 'fixed_expense' ? 'ثابت' : 'متغير'})
            </option>
          ))}
        </Input>
      ),
    },
    { key: 'categoryName', label: 'الفئة', render: (v) => <span className="nx-cell-muted">{v}</span> },
    { key: 'supplierName', label: 'المورد', render: (v) => <span className="nx-cell-muted">{v}</span> },
    {
      key: 'supplierInvoiceNumber',
      label: 'رقم فاتورة المورد',
      render: (v, row) => (
        <Input
          type="text"
          size="sm"
          value={v}
          onChange={(e) => updateRow(row.index - 1, { supplierInvoiceNumber: e.target.value })}
          placeholder="مطلوب للفواتير الخاضعة للضريبة"
        />
      ),
    },
    {
      key: 'totalInclusive',
      label: 'الإجمالي',
      render: (v, row) => (
        <Input
          type="number"
          step="0.01"
          min="0"
          value={v}
          onChange={(e) => updateRow(row.index - 1, { totalInclusive: e.target.value })}
          placeholder="0.00"
        />
      ),
    },
    { key: 'net', label: 'الصافي', numeric: true, render: (v) => <span className="nx-cell-num nx-cell-num--green">{fmt(v)}</span> },
    { key: 'tax', label: 'الضريبة', numeric: true, render: (v) => <span className="nx-cell-num text-noorix-amber">{fmt(v)}</span> },
    {
      key: 'notes',
      label: 'ملاحظات',
      render: (v, row) => (
        <Input
          type="text"
          size="sm"
          value={v}
          onChange={(e) => updateRow(row.index - 1, { notes: e.target.value })}
          placeholder="اختياري"
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      shrink: true,
      render: (_, row) => (
        <Button variant="danger" size="sm" onClick={() => removeRow(row.index - 1)}>
          حذف
        </Button>
      ),
    },
  ];

  if (!companyId) {
    return (
      <ScreenShell embedded={!!embedded} className={cn(embedded && 'pt-4')}>
        <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell embedded={!!embedded} className={cn(embedded && 'pt-4')}>
      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Input
            label="تاريخ العملية"
            type="date"
            size="sm"
            value={batchDate}
            onChange={(e) => setBatchDate(e.target.value)}
          />
          <div className="min-w-0 w-full sm:w-[min(100%,14rem)] sm:max-w-xs">
            <Input
              label="الخزينة *"
              type="select"
              size="sm"
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
            >
              <option value="">— اختر الخزينة —</option>
              {activeVaults.map((v) => (
                <option key={v.id} value={v.id}>{v.nameAr || v.nameEn}</option>
              ))}
            </Input>
          </div>
        </div>
        <Button size="sm" className="shrink-0 whitespace-nowrap self-end lg:self-auto" onClick={addRow}>
          {t('expenseBatchAddRow')}
        </Button>
      </div>

      <SmartTable
        compact
        innerPadding={8}
        columns={columns}
        data={tableData}
        keyExtractor={(r) => r.key}
        title={t('expenseBatchTab')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{rows.length}</span>}
        showSearchInHeader={false}
      />

      <div className="noorix-summary-bar noorix-summary-bar--4 mt-4">
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">عدد الصفوف</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{rows.length}</div>
          <div className="mt-0.5 text-[11px] font-medium text-noorix-muted">
            {validRows.length} {t('expenseBatchRowsValidHint')}
          </div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الصافي</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--green">{fmt(summary.totalNet)} ﷼</div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الضريبة</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--amber">{fmt(summary.totalTax)} ﷼</div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الإجمالي</div>
          <div className="noorix-summary-bar__value">{fmt(summary.total)} ﷼</div>
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || validRows.length === 0 || !vaultId}
        className="mt-3 w-full min-h-[44px] sm:min-h-0"
      >
        {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الدفعة'}
      </Button>

    </ScreenShell>
  );
}
