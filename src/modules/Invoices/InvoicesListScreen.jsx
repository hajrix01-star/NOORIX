/**
 * InvoicesListScreen — قائمة الفواتير
 * يعتمد على: useInvoices | SmartTable | DateFilterBar | format | saudiDate
 */
import React, { memo, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp }         from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useInvoices }    from '../../hooks/useInvoices';
import { useSuppliers }   from '../../hooks/useSuppliers';
import { fmt, sumAmounts } from '../../utils/format';
import { formatSaudiDateISO } from '../../utils/saudiDate';
import { updateInvoice } from '../../services/api';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import SmartTable         from '../../components/common/SmartTable';
import InvoiceActionsCell from '../../components/common/InvoiceActionsCell';
import { InvoiceEditModal } from './components/InvoiceEditModal';
import Toast              from '../../components/Toast';

const PAGE_SIZE = 50;

const Badge = memo(function Badge({ map, value }) {
  const s = map[value] || { bg: 'rgba(100,116,139,0.08)', color: '#64748b', label: value };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
});

export default function InvoicesListScreen() {
  const { activeCompanyId, userRole } = useApp();
  const { t } = useTranslation();
  const companyId           = activeCompanyId ?? '';
  const dateFilter          = useDateFilter();
  const queryClient         = useQueryClient();
  const [toast, setToast]   = useState({ visible: false, message: '', type: 'success' });
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [filterKind, setFilterKind] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('transactionDate');
  const [sortDir, setSortDir] = useState('desc');
  const [searchText, setSearchText] = useState('');

  const statusStyles = useMemo(() => ({
    active:    { bg: 'rgba(22,163,74,0.1)',  color: '#16a34a', label: t('statusActive') },
    cancelled: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: t('statusCancelled') },
  }), [t]);
  const kindStyles = useMemo(() => ({
    purchase:     { bg: 'transparent', color: '#2563eb', label: t('categoryTypes') },
    expense:      { bg: 'transparent', color: '#d97706', label: t('categoryTypeExpense') },
    fixed_expense: { bg: 'transparent', color: '#64748b', label: t('fixedExpenseType') || 'مصروف ثابت' },
    hr_expense:   { bg: 'transparent', color: '#7c3aed', label: t('invoiceKindHrExpense') || 'إقامة/HR' },
    salary:       { bg: 'transparent', color: '#22c55e', label: t('totalSalary') || 'راتب' },
    advance:      { bg: 'transparent', color: '#f59e0b', label: t('quickAdvance') || 'سلفية' },
    sale:         { bg: 'transparent', color: '#16a34a', label: t('categoryTypeSale') },
  }), [t]);

  const columns = useMemo(() => [
    { key: 'invoiceNumber', label: t('documentNumber'), shrink: true, width: '15%',
      render: (v) => (
        <span
          style={{
            fontWeight: 700, color: 'var(--noorix-accent-blue)', fontFamily: 'var(--noorix-font-numbers)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0, maxWidth: '100%',
          }}
          title={v || ''}
        >
          {v || '—'}
        </span>
      ) },
    { key: 'supplierInvoiceNumber', label: t('supplierInvoiceNumber'), shrink: true, width: '13%',
      render: (v) => (
        <span
          style={{
            fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0, maxWidth: '100%',
          }}
          title={v || ''}
        >
          {v || '—'}
        </span>
      ) },
    { key: 'supplierName',  label: t('supplier'), width: '14%',
      render: (v) => <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0, maxWidth: '100%' }} title={v || ''}>{v || '—'}</span> },
    { key: 'notesOrEmployee', label: t('invoiceNotesColumn') || 'ملاحظة', width: '16%',
      render: (_, row) => <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0, maxWidth: '100%' }} title={row.notes || ''}>{row.notes || '—'}</span> },
    { key: 'kind',          label: t('type'), shrink: true, width: '8%', render: (v) => <Badge map={kindStyles} value={v} /> },
    { key: 'netAmount',     label: t('net'),    numeric: true, shrink: true, width: '5%',
      render: (v) => <span style={{ color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v, 2)}</span> },
    { key: 'taxAmount',     label: t('tax'),   numeric: true, shrink: true, width: '5%',
      render: (v) => <span style={{ color: '#d97706', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v, 2)}</span> },
    { key: 'totalAmount',   label: t('total'),  numeric: true, shrink: true, width: '7%',
      render: (v) => <span style={{ fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v, 2)}</span> },
    { key: 'transactionDate', label: t('date'), sortable: true, shrink: true, width: '6%',
      render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{formatSaudiDateISO(v)}</span> },
    { key: 'status',        label: t('statusLabel'), shrink: true, width: '6%', render: (v) => <Badge map={statusStyles} value={v} /> },
    { key: 'actions', label: t('actions'), align: 'center', width: '5%', shrink: true,
      render: (_, row) => (
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onPrint={() => window.print()}
          onEdit={(r) => setEditingInvoice(r)}
          onDelete={async (r) => {
            if (!confirm(t('cancelInvoiceConfirm'))) return;
            const res = await updateInvoice(r.id, { status: 'cancelled' }, companyId);
            if (res.success) {
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
              queryClient.invalidateQueries({ queryKey: ['vaults'] });
              queryClient.invalidateQueries({ queryKey: ['ledger'] });
              setToast({ visible: true, message: t('invoiceCancelled'), type: 'success' });
            } else setToast({ visible: true, message: res.error || t('cancelFailed'), type: 'error' });
          }}
        />
      ),
    },
  ], [userRole, companyId, queryClient, t, statusStyles, kindStyles]);

  const { suppliers } = useSuppliers(companyId);

  const { items, total, isLoading, isError, error } = useInvoices({
    companyId,
    startDate: dateFilter.startDate,
    endDate:   dateFilter.endDate,
    page,
    pageSize:  PAGE_SIZE,
    kind: filterKind || undefined,
    supplierId: filterSupplierId || undefined,
    sortBy: sortKey,
    sortDir,
  });

  // بيانات مُحوَّلة لـ SmartTable
  const tableData = useMemo(() => {
    const mapped = (items || []).map((inv) => ({
      ...inv,
      supplierName: inv.kind === 'sale' ? (t('categoryTypeSale') || 'مبيعات') : (inv.supplier?.nameAr || ''),
      notesOrEmployee: inv.notes || '',
    }));
    const q = (searchText || '').trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter((inv) =>
      [inv.invoiceNumber, inv.supplierInvoiceNumber, inv.supplierName, inv.notesOrEmployee]
        .some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [items, t, searchText]);

  const activeOnly      = tableData.filter((inv) => inv.status !== 'cancelled');
  const displayedTotal  = total || 0;
  const totalAmount     = sumAmounts(activeOnly, 'totalAmount');
  const totalNet        = sumAmounts(activeOnly, 'netAmount');
  const totalTax        = sumAmounts(activeOnly, 'taxAmount');

  const toggleSort = (key) => {
    if (key !== 'transactionDate') return;
    setPage(1);
    setSortKey('transactionDate');
    setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  // فصل الداخل (مبيعات) عن الخارج (مشتريات ومصروفات)
  const inflowInvoices  = activeOnly.filter((inv) => inv.kind === 'sale');
  const outflowInvoices = activeOnly.filter((inv) => inv.kind !== 'sale');
  const inflowNet       = sumAmounts(inflowInvoices, 'netAmount');
  const inflowTax       = sumAmounts(inflowInvoices, 'taxAmount');
  const inflowTotal     = sumAmounts(inflowInvoices, 'totalAmount');
  const outflowNet     = sumAmounts(outflowInvoices, 'netAmount');
  const outflowTax     = sumAmounts(outflowInvoices, 'taxAmount');
  const outflowTotal   = sumAmounts(outflowInvoices, 'totalAmount');

  const footerCells = (
    <>
      <td colSpan={6} style={{ padding: '6px 10px', fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('totalInvoices', activeOnly.length)}</td>
      <td style={{ padding: '6px 10px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 13, color: '#16a34a', textAlign: 'right' }}>{fmt(totalNet.toNumber(), 2)}</td>
      <td style={{ padding: '6px 10px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 13, color: '#d97706', textAlign: 'right' }}>{fmt(totalTax.toNumber(), 2)}</td>
      <td style={{ padding: '6px 10px', fontFamily: 'var(--noorix-font-numbers)', fontSize: 13, color: '#7c3aed', fontWeight: 900, textAlign: 'right' }}>{fmt(totalAmount.toNumber(), 2)}</td>
      <td colSpan={3} />
    </>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('invoicesTitle')}</h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          {t('invoicesDesc')}
        </p>
      </div>

      <DateFilterBar filter={dateFilter} />

      {!companyId && (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompany')}
        </div>
      )}

      {editingInvoice && (
        <InvoiceEditModal
          invoice={editingInvoice}
          suppliers={suppliers}
          companyId={companyId}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            setEditingInvoice(null);
          }}
          onClose={() => setEditingInvoice(null)}
        />
      )}

      {companyId && (
        <>
          {/* كروت ملخص — نفس ثيم VaultCard */}
          <div className="noorix-exec-card-grid">
            {/* الداخل — المبيعات */}
            <div className="noorix-exec-card noorix-exec-card--inbound">
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </div>
                <span className="noorix-exec-card__title">{t('inbound')} — {t('categoryTypeSale')}</span>
              </div>
              <div className="noorix-exec-card__total">
                <span className="noorix-exec-card__amount">{fmt(inflowTotal.toNumber())}</span>
                <span className="noorix-exec-card__currency">﷼</span>
              </div>
              <div className="noorix-exec-card__divider" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
                  <span className="noorix-exec-card__stat-value">{inflowInvoices.length}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('net')}</span>
                  <span className="noorix-exec-card__stat-value">{fmt(inflowNet.toNumber())} ﷼</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('tax')}</span>
                  <span className="noorix-exec-card__stat-value">{fmt(inflowTax.toNumber())} ﷼</span>
                </div>
              </div>
            </div>

            {/* الخارج — المشتريات والمصروفات */}
            <div className="noorix-exec-card noorix-exec-card--outbound">
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M12 5v14M5 12l7 7 7-7"/>
                  </svg>
                </div>
                <span className="noorix-exec-card__title">{t('outbound')} — {t('purchases')} / {t('categoryTypeExpense')}</span>
              </div>
              <div className="noorix-exec-card__total">
                <span className="noorix-exec-card__amount">{fmt(outflowTotal.toNumber())}</span>
                <span className="noorix-exec-card__currency">﷼</span>
              </div>
              <div className="noorix-exec-card__divider" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
                  <span className="noorix-exec-card__stat-value">{outflowInvoices.length}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('net')}</span>
                  <span className="noorix-exec-card__stat-value">{fmt(outflowNet.toNumber())} ﷼</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('tax')}</span>
                  <span className="noorix-exec-card__stat-value">{fmt(outflowTax.toNumber())} ﷼</span>
                </div>
              </div>
            </div>
          </div>
          <div className="noorix-exec-filters">
            <span className="noorix-exec-filters__icon" title={t('filterByType')} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="4 2 20 2 14 10 14 22 10 22 10 10 4 2"/></svg>
            </span>
            <label className="noorix-exec-filters__label">
              <select
                value={filterKind}
                onChange={(e) => { setFilterKind(e.target.value); setPage(1); }}
                className="noorix-exec-filters__select"
              >
                <option value="">{t('filterAllTypes')}</option>
                <option value="purchase">{t('categoryTypes')}</option>
                <option value="expense">{t('categoryTypeExpense')}</option>
                <option value="fixed_expense">{t('fixedExpenseType')}</option>
                <option value="hr_expense">{t('invoiceKindHrExpense')}</option>
                <option value="salary">{t('totalSalary')}</option>
                <option value="advance">{t('quickAdvance')}</option>
                <option value="sale">{t('categoryTypeSale')}</option>
              </select>
            </label>
            <label className="noorix-exec-filters__label">
              <select
                value={filterSupplierId}
                onChange={(e) => { setFilterSupplierId(e.target.value); setPage(1); }}
                className="noorix-exec-filters__select"
              >
                <option value="">{t('allSuppliers')}</option>
                {(suppliers || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.nameAr || s.nameEn || s.id}</option>
                ))}
              </select>
            </label>
          </div>
          <SmartTable
          compact
          showRowNumbers
          tableLayout="fixed"
          rowNumberWidth="1%"
          innerPadding={8}
          getRowClassName={(row) => row.status === 'cancelled' ? 'noorix-row-cancelled' : ''}
          columns={columns}
          data={tableData}
          total={displayedTotal}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error?.message || t('loadInvoicesFailed')}
          footerCells={footerCells}
          title={t('invoicesTitle')}
          badge={
            <>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>— {dateFilter.label}</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 700 }}>{t('invoiceCount', displayedTotal)}</span>
            </>
          }
          searchValue={searchText}
          onSearchChange={(val) => { setSearchText(val); setPage(1); }}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyMessage={t('noInvoicesInPeriod')}
        />
        </>
      )}
    </div>
  );
}
