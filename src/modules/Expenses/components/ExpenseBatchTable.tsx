/**
 * ExpenseBatchTable — إدخال جماعي لمصاريف (ثابت/متغير)
 * كل صف: بند مصروف، رقم فاتورة، مبلغ، ملاحظات
 */
import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { createInvoiceBatch, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { expenseKeys } from '../../../services/queryKeys';
import { getSaudiToday } from '../../../utils/saudiDate';
import { splitTaxFromTotalAsNumbers } from '@noorix/finance-core';
import { vatRateDecimalFromCompany } from '../../../utils/vatRate';
import { useApp } from '../../../context/AppContext';
import { canExemptThisExpensePayment, isExpensePaymentTaxable } from '../utils/expenseTax';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Checkbox, DateField, Input, ScreenShell, cn , FmtNum, SmartTable } from '../../../ui';
import { SearchableOptionsPicker } from '../../../components/common/SearchableOptionsPicker';
import { vaultDisplayName } from '../../../utils/vaultDisplay';

const EMPTY_ROW = () => ({
  key: `${Date.now()}-${Math.random()}`,
  expenseLineId: '',
  supplierInvoiceNumber: '',
  totalInclusive: '',
  notes: '',
  warrantyFollowUp: false,
  exemptThisPayment: false,
});

export default function ExpenseBatchTable({ companyId, onSaved, embedded }: any) {
  const { lang, t } = useTranslation();
  const { companies } = useApp();
  const vatRateDecimal = useMemo(
    () => vatRateDecimalFromCompany(companies.find((c: any) => c.id === companyId)),
    [companies, companyId],
  );
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() => [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  const [vaultId, setVaultId] = useState('');

  const { data: expenseLines = [] } = useApiListQuery<any>({
    queryKey: expenseKeys.lines(companyId),
    queryFn: () => getExpenseLines(companyId),
    fallbackMessage: t('loadingError'),
    enabled: !!companyId,
  });

  const { paymentVaults: activeVaults = [] } = useVaults({ companyId });

  const expenseLinePickerOptions = useMemo(
    () =>
      expenseLines.map((l: any) => ({
        value: l.id,
        label: `${l.nameAr || l.nameEn} (${l.kind === 'fixed_expense' ? (lang === 'en' ? 'Fixed' : 'ثابت') : (lang === 'en' ? 'Variable' : 'متغير')})`,
      })),
    [expenseLines, lang],
  );

  const vaultPickerOptions = useMemo(
    () =>
      activeVaults.map((v: any) => ({
        value: v.id,
        label: vaultDisplayName(v, lang),
      })),
    [activeVaults, lang],
  );

  const validRows = useMemo(() => {
    return rows.filter((r: any) => {
      if (!r.expenseLineId || Number(r.totalInclusive) <= 0) return false;
      const line = expenseLines.find((l: any) => l.id === r.expenseLineId);
      const taxable = isExpensePaymentTaxable(line, r.exemptThisPayment);
      if (taxable && !r.supplierInvoiceNumber?.trim()) return false;
      return true;
    });
  }, [rows, expenseLines]);

  const summary = useMemo(() => {
    let totalNet = 0;
    let totalTax = 0;
    let gross = 0;
    for (const r of validRows) {
      const line = expenseLines.find((l: any) => l.id === r.expenseLineId);
      const taxable = isExpensePaymentTaxable(line, r.exemptThisPayment);
      const ti = parseFloat(r.totalInclusive);
      gross += Number.isFinite(ti) ? ti : 0;
      const { net, tax } = splitTaxFromTotalAsNumbers(ti, taxable, vatRateDecimal);
      totalNet += net;
      totalTax += tax;
    }
    return { totalNet, totalTax, total: gross, count: validRows.length };
  }, [validRows, expenseLines, vatRateDecimal]);

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
        items: validRows.map((r: any) => {
          const line = expenseLines.find((l: any) => l.id === r.expenseLineId);
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
            isTaxable: isExpensePaymentTaxable(line, r.exemptThisPayment),
            notes: autoNote,
            ...(r.warrantyFollowUp ? { warrantyFollowUp: true } : {}),
          };
        }),
      });
      return res;
    },
    successToast: false,
    showErrorToast: true,
    errorToast: (e: any) => e?.message || t('saveFailedGeneric'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
      onSaved?.();
    },
  });

  const updateRow = (i: any, updates: any) => {
    setRows((p: any) =>
      p.map((r: any, idx: any) => {
        if (idx !== i) return r;
        const next = { ...r, ...updates };
        if (Object.prototype.hasOwnProperty.call(updates, 'expenseLineId') && updates.expenseLineId !== r.expenseLineId) {
          next.exemptThisPayment = false;
        }
        return next;
      }),
    );
  };

  const addRow = () => setRows((p: any) => [...p, EMPTY_ROW()]);
  const removeRow = (i: any) => setRows((p: any) => (p.length <= 1 ? [EMPTY_ROW()] : p.filter((_: any, idx: any) => idx !== i)));

  const tableData = rows.map((r: any, i: any) => {
    const line = expenseLines.find((l: any) => l.id === r.expenseLineId);
    const taxable = isExpensePaymentTaxable(line, r.exemptThisPayment);
    const { net, tax } = splitTaxFromTotalAsNumbers(Number(r.totalInclusive), taxable, vatRateDecimal);
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

  const renderMobileCard = (row: any) => {
    const i = row.index - 1;
    const line = expenseLines.find((l: any) => l.id === row.expenseLineId);
    const taxable = isExpensePaymentTaxable(line, row.exemptThisPayment);
    const needInv = taxable;
    const showExempt = canExemptThisExpensePayment(line);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-noorix-text">#{row.index}</span>
          <Button variant="danger" size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => removeRow(i)}>
            {t('delete')}
          </Button>
        </div>
        <SearchableOptionsPicker
          label={lang === 'en' ? 'Expense line' : 'بند المصروف'}
          size="sm"
          allowEmpty
          emptyValue=""
          emptyLabel={lang === 'en' ? '— Select —' : '— اختر —'}
          value={row.expenseLineId}
          onChange={(v) => updateRow(i, { expenseLineId: v })}
          options={expenseLinePickerOptions}
          aria-label={lang === 'en' ? 'Expense line' : 'بند المصروف'}
        />
        <div className="nx-mc__grid nx-mc__grid--2">
          <div>
            <div className="nx-mc__stat-label">{lang === 'en' ? 'Category' : 'الفئة'}</div>
            <div className="text-[12px] text-noorix-text break-words">{row.categoryName}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{lang === 'en' ? 'Supplier' : 'المورد'}</div>
            <div className="text-[12px] text-noorix-text break-words">{row.supplierName}</div>
          </div>
        </div>
        {showExempt ? (
          <Checkbox
            checked={!!row.exemptThisPayment}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRow(i, { exemptThisPayment: e.target.checked })}
            className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
            aria-label={t('expenseBatchTaxExemptHint')}
            label={t('expenseBatchTaxExemptShort')}
            containerClassName="cursor-pointer items-center text-[13px] font-medium text-noorix-text"
          />
        ) : null}
        <Input
          label={lang === 'en' ? 'Supplier invoice #' : 'رقم فاتورة المورد'}
          type="text"
          size="sm"
          value={row.supplierInvoiceNumber}
          onChange={(e: any) => updateRow(i, { supplierInvoiceNumber: e.target.value })}
          placeholder={needInv ? (lang === 'en' ? 'Required if taxable' : 'مطلوب إن خاضع') : lang === 'en' ? 'Optional' : 'اختياري'}
        />
        <Input
          label={lang === 'en' ? 'Total' : 'الإجمالي'}
          type="number"
          step="0.01"
          min="0"
          value={row.totalInclusive}
          onChange={(e: any) => updateRow(i, { totalInclusive: e.target.value })}
          placeholder="0.00"
        />
        <div className="nx-mc__grid nx-mc__grid--2">
          <div>
            <div className="nx-mc__stat-label">{lang === 'en' ? 'Net' : 'الصافي'}</div>
            <FmtNum n={row.net} className="text-[14px] font-bold text-noorix-green ltr" />
          </div>
          <div>
            <div className="nx-mc__stat-label">{lang === 'en' ? 'Tax' : 'الضريبة'}</div>
            <FmtNum n={row.tax} className="text-[14px] font-bold text-noorix-amber ltr" />
          </div>
        </div>
        <Input
          label={lang === 'en' ? 'Notes' : 'ملاحظات'}
          type="text"
          size="sm"
          value={row.notes}
          onChange={(e: any) => updateRow(i, { notes: e.target.value })}
          placeholder={lang === 'en' ? 'Optional' : 'اختياري'}
        />
        <Checkbox
          checked={!!row.warrantyFollowUp}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRow(i, { warrantyFollowUp: e.target.checked })}
          className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
          aria-label={t('warrantyFollowUpColHint')}
          label={t('warrantyFollowUpCol')}
          containerClassName="cursor-pointer items-center text-[13px] font-medium text-noorix-text"
        />
      </div>
    );
  };

  const columns = [
    { key: 'index', label: '#', shrink: true, width: '3%', align: 'center', render: (v: any) => <span className="nx-cell-muted">{v}</span> },
    {
      key: 'expenseLineId',
      label: 'بند المصروف (يُملأ تلقائياً)',
      width: '17%',
      render: (_: any, row: any) => (
        <SearchableOptionsPicker
          size="sm"
          allowEmpty
          emptyValue=""
          emptyLabel="— اختر —"
          value={row.expenseLineId}
          onChange={(v) => updateRow(row.index - 1, { expenseLineId: v })}
          options={expenseLinePickerOptions}
          aria-label="بند المصروف"
        />
      ),
    },
    { key: 'categoryName', label: 'الفئة', width: '8%', render: (v: any) => <span className="nx-cell-muted block min-w-0 truncate text-[13px]" title={v}>{v}</span> },
    { key: 'supplierName', label: 'المورد', width: '9%', render: (v: any) => <span className="nx-cell-muted block min-w-0 truncate text-[13px]" title={v}>{v}</span> },
    {
      key: 'exemptThisPayment',
      label: t('expenseBatchTaxExemptShort'),
      width: '5%',
      align: 'center',
      render: (_: any, row: any) => {
        const line = expenseLines.find((l: any) => l.id === row.expenseLineId);
        const show = canExemptThisExpensePayment(line);
        if (!show) return <span className="nx-cell-muted text-[11px]">—</span>;
        return (
          <label className="inline-flex cursor-pointer items-center justify-center p-1">
            <Checkbox
              checked={!!row.exemptThisPayment}
              onChange={(e: any) => updateRow(row.index - 1, { exemptThisPayment: e.target.checked })}
              className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
              title={t('expenseBatchTaxExemptHint')}
              aria-label={`${t('expenseBatchTaxExemptHint')} — ${row.index}`}
            />
          </label>
        );
      },
    },
    {
      key: 'supplierInvoiceNumber',
      label: 'رقم فاتورة المورد',
      width: '9%',
      render: (v: any, row: any) => {
        const line = expenseLines.find((l: any) => l.id === row.expenseLineId);
        const needInv = isExpensePaymentTaxable(line, row.exemptThisPayment);
        return (
          <Input
            type="text"
            size="sm"
            value={v}
            onChange={(e: any) => updateRow(row.index - 1, { supplierInvoiceNumber: e.target.value })}
            placeholder={needInv ? (lang === 'en' ? 'Required if taxable' : 'مطلوب إن خاضع') : lang === 'en' ? 'Optional' : 'اختياري'}
          />
        );
      },
    },
    {
      key: 'totalInclusive',
      label: 'الإجمالي',
      width: '8%',
      render: (v: any, row: any) => (
        <Input
          type="number"
          step="0.01"
          min="0"
          value={v}
          onChange={(e: any) => updateRow(row.index - 1, { totalInclusive: e.target.value })}
          placeholder="0.00"
        />
      ),
    },
    { key: 'net', label: 'الصافي', numeric: true, width: '7%', align: 'center', render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green" /> },
    { key: 'tax', label: 'الضريبة', numeric: true, width: '7%', align: 'center', render: (v: any) => <FmtNum n={v} className="nx-cell-num text-noorix-amber" /> },
    {
      key: 'notes',
      label: 'ملاحظات',
      width: '10%',
      render: (v: any, row: any) => (
        <Input
          type="text"
          size="sm"
          value={v}
          onChange={(e: any) => updateRow(row.index - 1, { notes: e.target.value })}
          placeholder="اختياري"
        />
      ),
    },
    {
      key: 'warrantyFollowUp',
      label: t('warrantyFollowUpCol'),
      width: '7%',
      align: 'center',
      render: (_: any, row: any) => (
        <label className="inline-flex items-center justify-center gap-1 cursor-pointer">
          <Checkbox
            checked={!!row.warrantyFollowUp}
            onChange={(e: any) => updateRow(row.index - 1, { warrantyFollowUp: e.target.checked })}
            className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
            title={t('warrantyFollowUpColHint')}
            aria-label={`${t('warrantyFollowUpCol')} — ${row.index}`}
          />
          <span className="hidden 2xl:inline text-[11px] font-semibold text-noorix-muted">{t('warrantyFollowUpShort')}</span>
        </label>
      ),
    },
    {
      key: 'actions',
      label: t('actions'),
      align: 'center',
      width: '11%',
      render: (_: any, row: any) => (
        <div className="noorix-actions-row flex flex-wrap justify-center">
          <Button variant="danger" size="sm" onClick={() => removeRow(row.index - 1)}>
            حذف
          </Button>
        </div>
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
          <div className="min-w-0 w-full sm:w-[min(100%,11rem)]">
            <DateField
              label="تاريخ العملية"
              size="sm"
              className="w-full min-w-0 max-w-full"
              value={batchDate}
              onValueChange={setBatchDate}
            />
          </div>
          <div className="min-w-0 w-full sm:w-[min(100%,14rem)] sm:max-w-xs">
            <SearchableOptionsPicker
              label="الخزينة *"
              size="sm"
              allowEmpty
              emptyValue=""
              emptyLabel="— اختر الخزينة —"
              value={vaultId}
              onChange={(v) => setVaultId(v)}
              options={vaultPickerOptions}
              aria-label="الخزينة"
            />
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
        keyExtractor={(r: any) => r.key}
        title={t('expenseBatchTab')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{rows.length}</span>}
        showSearchInHeader={false}
        tableId="expense-batch"
        tableLayout="fixed"
        tableMinWidth={1040}
        stickyActionColumn={false}
        renderMobileCard={renderMobileCard}
        stripeMobileCards
      />

      <div className="noorix-summary-bar noorix-summary-bar--4 mt-6">
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">عدد الصفوف</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{rows.length}</div>
          <div className="mt-0.5 text-[11px] font-medium text-noorix-muted">
            {validRows.length} {t('expenseBatchRowsValidHint')}
          </div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الصافي</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--green"><FmtNum n={summary.totalNet} /> SR</div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الضريبة</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--amber"><FmtNum n={summary.totalTax} /> SR</div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الإجمالي</div>
          <div className="noorix-summary-bar__value"><FmtNum n={summary.total} /> SR</div>
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        onClick={() => saveMutation.mutate(undefined)}
        disabled={saveMutation.isPending || validRows.length === 0 || !vaultId}
        className="mt-3 w-full min-h-[44px] sm:min-h-0"
      >
        {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الدفعة'}
      </Button>

    </ScreenShell>
  );
}
