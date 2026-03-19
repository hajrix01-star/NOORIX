/**
 * ExpenseBatchTable — إدخال جماعي لمصاريف (ثابت/متغير)
 * كل صف: بند مصروف، رقم فاتورة، مبلغ، ملاحظات
 */
import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { createInvoiceBatch, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { getSaudiToday } from '../../../utils/saudiDate';
import { fmt, calcReverseVat } from '../../../utils/format';
import Toast from '../../../components/Toast';
import SmartTable from '../../../components/common/SmartTable';

const EMPTY_ROW = () => ({
  key: `${Date.now()}-${Math.random()}`,
  expenseLineId: '',
  supplierInvoiceNumber: '',
  totalInclusive: '',
  notes: '',
});

export default function ExpenseBatchTable({ companyId, onSaved }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() => [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  const [vaultId, setVaultId] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const { data: expenseLines = [] } = useQuery({
    queryKey: ['expense-lines', companyId],
    queryFn: async () => {
      const res = await getExpenseLines(companyId);
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!companyId,
  });

  const { vaultsList = [] } = useVaults({ companyId });
  const activeVaults = vaultsList.filter((v) => !v.isArchived);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!vaultId) throw new Error('اختر الخزينة');
      if (validRows.length === 0) throw new Error('لا توجد صفوف صالحة');
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
      if (!res.success) throw new Error(res.error);
      return res.data ?? res;
    },
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
      onSaved?.();
      setToast({ visible: true, message: 'تم حفظ الدفعة بنجاح', type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || 'فشل الحفظ', type: 'error' }),
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
      supplierName: line?.supplier?.nameAr || line?.supplier?.nameEn || '—',
      kind: line?.kind === 'fixed_expense' ? 'ثابت' : 'متغير',
      net,
      tax,
    };
  });

  const columns = [
    { key: 'index', label: '#', shrink: true, render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{v}</span> },
    {
      key: 'expenseLineId',
      label: 'بند المصروف (يُملأ تلقائياً)',
      render: (_, row) => (
        <select
          value={row.expenseLineId}
          onChange={(e) => {
            const line = expenseLines.find((l) => l.id === e.target.value);
            updateRow(row.index - 1, { expenseLineId: e.target.value });
          }}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            fontSize: 13,
          }}
        >
          <option value="">— اختر —</option>
          {expenseLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nameAr || l.nameEn} ({l.kind === 'fixed_expense' ? 'ثابت' : 'متغير'})
            </option>
          ))}
        </select>
      ),
    },
    { key: 'categoryName', label: 'الفئة', render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{v}</span> },
    { key: 'supplierName', label: 'المورد', render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{v}</span> },
    {
      key: 'supplierInvoiceNumber',
      label: 'رقم فاتورة المورد',
      render: (v, row) => (
        <input
          type="text"
          value={v}
          onChange={(e) => updateRow(row.index - 1, { supplierInvoiceNumber: e.target.value })}
          placeholder="مطلوب للفواتير الخاضعة للضريبة"
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            fontSize: 13,
          }}
        />
      ),
    },
    {
      key: 'totalInclusive',
      label: 'الإجمالي',
      render: (v, row) => (
        <input
          type="number"
          step="0.01"
          min="0"
          value={v}
          onChange={(e) => updateRow(row.index - 1, { totalInclusive: e.target.value })}
          placeholder="0.00"
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            fontSize: 13,
            fontFamily: 'var(--noorix-font-numbers)',
          }}
        />
      ),
    },
    { key: 'net', label: 'الصافي', numeric: true, render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a' }}>{fmt(v)}</span> },
    { key: 'tax', label: 'الضريبة', numeric: true, render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#d97706' }}>{fmt(v)}</span> },
    {
      key: 'notes',
      label: 'ملاحظات',
      render: (v, row) => (
        <input
          type="text"
          value={v}
          onChange={(e) => updateRow(row.index - 1, { notes: e.target.value })}
          placeholder="اختياري"
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            fontSize: 13,
          }}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      shrink: true,
      render: (_, row) => (
        <button type="button" onClick={() => removeRow(row.index - 1)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #fecaca', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
          حذف
        </button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>تاريخ العملية</label>
          <input
            type="date"
            value={batchDate}
            onChange={(e) => setBatchDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>الخزينة *</label>
          <select
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', minWidth: 200 }}
          >
            <option value="">— اختر الخزينة —</option>
            {activeVaults.map((v) => (
              <option key={v.id} value={v.id}>{v.nameAr || v.nameEn}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={addRow}
          style={{ padding: '10px 20px', borderRadius: 8, border: '2px dashed var(--noorix-border)', background: 'transparent', cursor: 'pointer', fontSize: 14, marginTop: 20 }}
        >
          + إضافة صف
        </button>
      </div>

      <SmartTable columns={columns} data={tableData} keyExtractor={(r) => r.key} showRowNumbers rowNumberWidth="1%" />

      <div className="noorix-summary-bar noorix-summary-bar--4" style={{ marginTop: 16 }}>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">عدد الصفوف</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{summary.count}</div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الصافي</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--green">{fmt(summary.totalNet)} ﷼</div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">الضريبة</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--amber">{fmt(summary.totalTax)} ﷼</div>
        </div>
        <div className="noorix-summary-bar__item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="noorix-summary-bar__label">الإجمالي</div>
            <div className="noorix-summary-bar__value">{fmt(summary.total)} ﷼</div>
          </div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || validRows.length === 0 || !vaultId}
            className="noorix-btn-nav noorix-btn-primary"
            style={{ whiteSpace: 'nowrap', padding: '8px 16px' }}
          >
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الدفعة'}
          </button>
        </div>
      </div>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onClose={() => setToast((p) => ({ ...p, visible: false }))} />
    </div>
  );
}
