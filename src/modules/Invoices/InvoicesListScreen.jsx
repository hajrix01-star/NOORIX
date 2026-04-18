/**
 * InvoicesListScreen — قائمة الفواتير
 * يعتمد على: useInvoices | SmartTable | DateFilterBar | format | saudiDate
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp }         from '../../context/AppContext';
import { useToast }       from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useInvoices }    from '../../hooks/useInvoices';
import { useSuppliers }   from '../../hooks/useSuppliers';
import { useVaults }      from '../../hooks/useVaults';
import { fmt, sumAmounts } from '../../utils/format';
import { formatSaudiDate, formatSaudiDateISO } from '../../utils/saudiDate';
import { updateInvoice, getInvoices, deleteInvoice, fetchAllInvoicesForExport, getInvoiceCreatorFilterOptions } from '../../services/api';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { Badge, Button, Modal, Input, ScreenShell, FmtNum, cn, SmartTable } from '../../ui';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import InvoiceActionsCell from '../../components/common/InvoiceActionsCell';
import { InvoiceEditModal } from './components/InvoiceEditModal';
import ImportExportModal  from '../../components/ImportExportModal';
import { formatInvoiceForExport } from '../../utils/importTemplates';
import DayCloseReportModal from './components/DayCloseReportModal';
import { buildActiveCancelledStatusMap, buildInvoiceKindBadgeMap } from '../../constants/badgeMaps';
import { vaultDisplayName } from '../../utils/vaultDisplay';

const PAGE_SIZE = 50;
/** أقصى عدد أعمدة خزائن في تصدير Excel (اسم + نوع + مبلغ لكل خزينة) */
const MAX_VAULT_SLOTS = 5;

function vaultTypeLabelForExport(type, t) {
  const map = { cash: 'vaultTypeCash', bank: 'vaultTypeBank', app: 'vaultTypeApp' };
  const k = map[type];
  return k ? t(k) : (type ? String(type) : '—');
}

function getAllocationsForExport(inv, lang, t) {
  const out = [];
  const a = inv.vaultAllocations;
  if (Array.isArray(a) && a.length > 0) {
    for (const al of a) {
      out.push({
        name: vaultDisplayName(al.vault, lang),
        type: vaultTypeLabelForExport(al.vault?.type, t),
        amount: Number(al.amount ?? 0),
      });
    }
    return out;
  }
  if (inv.vault) {
    out.push({
      name: vaultDisplayName(inv.vault, lang),
      type: vaultTypeLabelForExport(inv.vault?.type, t),
      amount: Number(inv.totalAmount ?? 0),
    });
  }
  return out;
}

/* ══ نافذة عرض الفاتورة (قراءة فقط) ══════════════════════════════════════════ */
function InvoiceViewModal({ invoice, onClose, t, lang, fmt }) {
  if (!invoice) return null;
  const fmtDate = (d) => (d ? formatSaudiDate(d) : '—');
  const supplierName = (lang === 'en' ? invoice.supplier?.nameEn || invoice.supplier?.nameAr : invoice.supplier?.nameAr || invoice.supplier?.nameEn) || '—';
  const alloc = invoice.vaultAllocations;
  let vaultSummary = '—';
  if (alloc?.length > 1) {
    vaultSummary = t('invoiceVaultMultiple');
  } else if (alloc?.length === 1) {
    const v = alloc[0].vault;
    vaultSummary = (lang === 'en' ? v?.nameEn || v?.nameAr : v?.nameAr || v?.nameEn) || '—';
  } else if (invoice.vault) {
    vaultSummary = (lang === 'en' ? invoice.vault.nameEn || invoice.vault.nameAr : invoice.vault.nameAr || invoice.vault.nameEn) || '—';
  }
  const fields = [
    { label: t('invoiceNumber'),   value: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '—' },
    { label: t('date'),            value: fmtDate(invoice.transactionDate) },
    { label: t('type'),            value: invoice.kind || '—' },
    { label: t('status'),          value: invoice.status || '—' },
    { label: t('supplier'),        value: supplierName },
    { label: t('invoiceVaultColumn'), value: vaultSummary },
    { label: t('net'),             value: invoice.netAmount != null ? `${fmt(invoice.netAmount)} SR` : '—', highlight: 'var(--noorix-accent-green)' },
    { label: t('tax'),             value: invoice.taxAmount != null ? `${fmt(invoice.taxAmount)} SR` : '—', highlight: 'var(--noorix-accent-amber)' },
    { label: t('total'),           value: invoice.totalAmount != null ? `${fmt(invoice.totalAmount)} SR` : '—', highlight: 'var(--noorix-accent-blue)', bold: true },
  ].filter(Boolean);
  return (
    <Modal open={!!invoice} onClose={onClose} size="sm" hideClose className="nx-modal--flush">
      {/* هيدر بـ gradient */}
      <div className="flex items-center justify-between py-4 px-5" style={{ background: 'linear-gradient(135deg, var(--noorix-accent-blue) 0%, var(--noorix-navy-mid, #1d4ed8) 100%)' }}>
        <div>
          <div className="text-[11px] mb-[3px]" style={{ color: 'rgba(255,255,255,0.75)' }}>{t('invoicesTitle')}</div>
          <h3 className="m-0 font-bold text-[17px]" style={{ color: 'var(--noorix-navy-text)' }}>{invoice.supplierInvoiceNumber || invoice.invoiceNumber || '—'}</h3>
        </div>
        <Button className="nx-gradient-close-btn" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
      {/* حقول التفاصيل */}
      <div className="grid grid-cols-2 gap-2.5 p-5">
        {fields.map(({ label, value, highlight, bold }) => (
          <div key={label} className="bg-noorix-bg-muted py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">{label}</div>
            <div className="text-[14px]" style={{ fontWeight: bold ? 700 : 600, color: highlight || 'var(--noorix-text)', fontFamily: 'var(--noorix-font-numbers)' }}>{value}</div>
          </div>
        ))}
        {alloc?.length > 1 && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-2 text-[10px] uppercase tracking-[0.05em]">{t('invoiceVaultSplitsDetail')}</div>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {alloc.map((a) => {
                const vn = lang === 'en' ? a.vault?.nameEn || a.vault?.nameAr : a.vault?.nameAr || a.vault?.nameEn;
                return (
                  <li key={a.id} className="flex justify-between gap-2 text-[13px] text-noorix-text">
                    <span className="truncate">{vn || '—'}</span>
                    <span className="ltr font-semibold shrink-0"><FmtNum n={a.amount} /> <span className="nx-sar">SR</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {invoice.notes && (
          <div className="bg-noorix-bg-muted col-span-full py-[10px] px-3 rounded-[10px] border border-noorix-border">
            <div className="text-noorix-muted mb-1 text-[10px] uppercase tracking-[0.05em]">{t('notes')}</div>
            <div className="text-[13px] text-noorix-text">{invoice.notes}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function InvoicesListScreen() {
  const { activeCompanyId, userRole, companies } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams] = useSearchParams();
  /** من الرابط مباشرة — أول إطار يطابق فلتر الدفعة قبل useEffect */
  const fromUrl = searchParams.get('from')?.slice(0, 10) || '';
  const toUrl = searchParams.get('to')?.slice(0, 10) || '';
  const invoiceBatchIdFromUrl = searchParams.get('batchId')?.trim() || '';
  const urlDrillKeyRef = useRef('');
  const companyId           = activeCompanyId ?? '';
  const dateFilter          = useDateFilter();
  const queryClient         = useQueryClient();
  const { showToast }       = useToast();
  const [exportBusy, setExportBusy] = useState(false);
  const activeCo = companies?.find((c) => c.id === activeCompanyId);
  const companyName = (lang === 'en' ? (activeCo?.nameEn || activeCo?.nameAr) : (activeCo?.nameAr || activeCo?.nameEn)) || '';
  const logoUrl = activeCo?.logoUrl || '';
  const [editingInvoice, setEditingInvoice]   = useState(null);
  const [viewingInvoice, setViewingInvoice]   = useState(null);
  const [filterKind, setFilterKind] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterCreatedByUserId, setFilterCreatedByUserId] = useState('');
  const [filterVaultId, setFilterVaultId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [filterHasNotesOnly, setFilterHasNotesOnly] = useState(false);
  const [urlExtra, setUrlExtra] = useState({ kind: '', categoryId: '', expenseLineId: '' });
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('transactionDate');
  const [sortDir, setSortDir] = useState('desc');
  const [showImportExport, setShowImportExport] = useState(false);
  const [dayCloseOpen, setDayCloseOpen] = useState(false);
  const qInit = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('q') || '') : '';
  const [searchText, setSearchText] = useState(qInit);
  const debouncedQ = useDebouncedValue((searchText || '').trim(), 300);

  /** تواريخ الاستعلام: إن وُجد from+to في الرابط يُطبَّقان فوراً (قبل مزامنة useEffect مع dateFilter) */
  const invoiceQueryStartDate = useMemo(
    () => (fromUrl && toUrl ? fromUrl : dateFilter.startDate),
    [fromUrl, toUrl, dateFilter.startDate],
  );
  const invoiceQueryEndDate = useMemo(
    () => (fromUrl && toUrl ? toUrl : dateFilter.endDate),
    [fromUrl, toUrl, dateFilter.endDate],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, dateFilter.startDate, dateFilter.endDate, filterKind, filterSupplierId, filterCreatedByUserId, showCancelled, filterHasNotesOnly, urlExtra.kind, urlExtra.categoryId, urlExtra.expenseLineId, invoiceBatchIdFromUrl, fromUrl, toUrl]);

  useEffect(() => {
    const keys = ['from', 'to', 'kind', 'supplierId', 'categoryId', 'expenseLineId', 'q', 'batchId'];
    const parts = keys.map((k) => searchParams.get(k) || '');
    const drillKey = parts.join('\u001f');
    if (!parts.some(Boolean)) {
      urlDrillKeyRef.current = '';
      return;
    }
    if (urlDrillKeyRef.current === drillKey) return;
    urlDrillKeyRef.current = drillKey;

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const kind = searchParams.get('kind') || '';
    const supplierId = searchParams.get('supplierId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const expenseLineId = searchParams.get('expenseLineId') || '';
    const q = searchParams.get('q') || '';
    if (from && to) {
      dateFilter.setMode('range');
      dateFilter.setRangeStart(from.slice(0, 10));
      dateFilter.setRangeEnd(to.slice(0, 10));
    }
    if (kind) {
      if (kind.includes(',')) {
        setFilterKind('');
        setUrlExtra((p) => ({ ...p, kind }));
      } else {
        setFilterKind(kind);
        setUrlExtra((p) => ({ ...p, kind: '' }));
      }
    }
    if (supplierId) setFilterSupplierId(supplierId);
    if (categoryId) setUrlExtra((p) => ({ ...p, categoryId }));
    if (expenseLineId) setUrlExtra((p) => ({ ...p, expenseLineId }));
    if (q) {
      setSearchText(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- نقرأ فقط دوال فلتر التاريخ المستقرة
  }, [searchParams]);

  const STATUS_MAP = useMemo(() => buildActiveCancelledStatusMap(t), [t]);
  const KIND_MAP = useMemo(() => buildInvoiceKindBadgeMap(t), [t]);

  const deleteInvoiceMut = useApiMutation({
    mutationFn: ({ id }) => deleteInvoice(id, companyId),
    invalidateQueries: [['invoices'], ['vaults'], ['ledger']],
    successToast: () => t('invoiceDeleted'),
    errorToast: (e) => e?.message || t('deleteFailed'),
  });

  const confirmAndDeleteInvoice = useCallback((r) => {
    if (!confirm(t('deleteInvoiceConfirm', r.invoiceNumber || ''))) return;
    deleteInvoiceMut.mutate({ id: r.id });
  }, [t, deleteInvoiceMut]);

  const columns = useMemo(() => [
    { key: 'invoiceNumber', label: t('documentNumber'), align: 'center', shrink: true, width: '12%', sortable: true,
      render: (v, row) => {
        const isInbound = row.kind === 'sale';
        return (
          <span
            className="nx-cell-num nx-cell-ellipsis"
            style={{ color: isInbound ? 'var(--color-nx-sales)' : 'var(--color-nx-expenses)', fontWeight: 700 }}
            title={v || ''}
          >
            {v || '—'}
          </span>
        );
      } },
    { key: 'supplierInvoiceNumber', label: t('supplierInvoiceNumber'), align: 'center', shrink: true, width: '7%',
      render: (v) => <span className="nx-cell-num nx-cell-muted nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
    { key: 'supplierName',  label: t('supplier'), align: 'center', width: '7%',
      render: (v) => <span className="nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
    { key: 'createdByDisplayName', label: t('invoiceUserColumn'), align: 'center', width: '8%',
      render: (v) => <span className="nx-cell-ellipsis" title={v || ''}>{v || '—'}</span> },
    { key: 'notesOrEmployee', label: t('invoiceNotesColumn') || 'ملاحظة', align: 'center', width: '8%',
      render: (_, row) => <span className="nx-cell-ellipsis" title={row.notes || ''}>{row.notes || '—'}</span> },
    { key: 'kind',          label: t('type'), align: 'center', shrink: true, width: '6%',
      render: (v) => <Badge {...Badge.fromStatus(v, KIND_MAP)} size="sm" /> },
    { key: 'vaultLabel', label: t('invoiceVaultColumn'), align: 'center', width: '20%',
      render: (_, row) => {
        const a = row.vaultAllocations;
        if (a?.length > 0) {
          return (
            /* flex-nowrap: الشرائح في صف واحد دائماً — overflow-hidden يقطع ما يزيد */
            <div className="flex flex-nowrap gap-1.5 justify-center overflow-hidden">
              {a.map((al) => {
                const vn = lang === 'en' ? al.vault?.nameEn || al.vault?.nameAr : al.vault?.nameAr || al.vault?.nameEn;
                return (
                  <div
                    key={al.id}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-noorix-border',
                      'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
                    )}
                    title={vn ? `${vn} — ${fmt(al.amount)} SR` : ''}
                  >
                    <span className="truncate text-[11px] font-semibold text-noorix-text max-w-[60px]">{vn || '—'}</span>
                    <span dir="ltr" className="shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums text-nx-sales">
                      <FmtNum n={al.amount} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }
        const vn = row.vault
          ? (lang === 'en' ? row.vault.nameEn || row.vault.nameAr : row.vault.nameAr || row.vault.nameEn)
          : '';
        return <span className="nx-cell-ellipsis text-[12px] text-center" title={vn || ''}>{vn || '—'}</span>;
      },
    },
    { key: 'netAmount',     label: t('net'),    align: 'center', numeric: true, shrink: true, width: '7%', sortable: true,
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green" /> },
    { key: 'taxAmount',     label: t('tax'),    align: 'center', numeric: true, shrink: true, width: '6%',
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-num--amber" /> },
    { key: 'totalAmount',   label: t('total'),  align: 'center', numeric: true, shrink: true, width: '7%', sortable: true,
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-bold" /> },
    { key: 'transactionDate', label: t('date'), align: 'center', sortable: true, shrink: true, width: '7%',
      render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDateISO(v)}</span> },
    { key: 'status',        label: t('statusLabel'), align: 'center', shrink: true, width: '6%',
      render: (v) => <Badge {...Badge.fromStatus(v, STATUS_MAP)} size="sm" /> },
    { key: 'actions', label: t('actions'), align: 'center', width: '5%', shrink: true,
      render: (_, row) => (
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onView={(r) => setViewingInvoice(r)}
          onPrint={() => window.print()}
          onEdit={(r) => setEditingInvoice(r)}
          onDelete={confirmAndDeleteInvoice}
        />
      ),
    },
  ], [userRole, companyId, t, lang, STATUS_MAP, KIND_MAP, confirmAndDeleteInvoice, fmt]);

  const { suppliers } = useSuppliers(companyId);
  const { data: creatorFilterOptions = { users: [] } } = useQuery({
    queryKey: ['invoice-creator-filter-options', companyId],
    queryFn: async () => {
      const res = await getInvoiceCreatorFilterOptions(companyId);
      return res.success ? { users: res.users } : { users: [] };
    },
    enabled: !!companyId,
  });
  const creatorUsersForFilter = creatorFilterOptions.users || [];
  const { vaultsList = [], paymentVaults = [] } = useVaults({ companyId });

  const dayCloseDefaultYmd = useMemo(
    () => (dateFilter.endDate || dateFilter.startDate || '').slice(0, 10),
    [dateFilter.endDate, dateFilter.startDate],
  );

  const kindForApi = filterKind || urlExtra.kind || undefined;

  const { items, total, sums, inflowByVault, outflowSummary, isLoading, isError, error } = useInvoices({
    companyId,
    startDate: invoiceQueryStartDate,
    endDate:   invoiceQueryEndDate,
    page,
    pageSize:  PAGE_SIZE,
    kind: kindForApi,
    supplierId: filterSupplierId || undefined,
    sortBy: sortKey,
    sortDir,
    q: debouncedQ || undefined,
    categoryId: urlExtra.categoryId || undefined,
    expenseLineId: urlExtra.expenseLineId || undefined,
    includeCancelled: showCancelled,
    hasNotes: filterHasNotesOnly || undefined,
    vaultId: filterVaultId || undefined,
    batchId: invoiceBatchIdFromUrl || undefined,
    createdByUserId: filterCreatedByUserId || undefined,
  });

  // بيانات مُحوَّلة لـ SmartTable
  const tableData = useMemo(() => (items || []).map((inv) => ({
    ...inv,
    supplierName: inv.kind === 'sale' ? (t('categoryTypeSale') || 'مبيعات') : (lang === 'en' ? (inv.supplier?.nameEn || inv.supplier?.nameAr || '') : (inv.supplier?.nameAr || inv.supplier?.nameEn || '')),
    createdByDisplayName: inv.createdByUser
      ? (lang === 'en'
        ? (inv.createdByUser.nameEn || inv.createdByUser.nameAr || inv.createdByUser.email || '')
        : (inv.createdByUser.nameAr || inv.createdByUser.nameEn || inv.createdByUser.email || ''))
      : '',
    notesOrEmployee: inv.notes || '',
  })), [items, t, lang]);

  const activeOnly      = tableData.filter((inv) => inv.status !== 'cancelled');
  const displayedTotal  = total || 0;

  const toggleSort = (key) => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const mapInvoiceToExportRow = useCallback((inv) => {
    const supplierName = inv.kind === 'sale'
      ? (t('categoryTypeSale') || 'مبيعات')
      : (lang === 'en' ? (inv.supplier?.nameEn || inv.supplier?.nameAr || '') : (inv.supplier?.nameAr || inv.supplier?.nameEn || ''));
    const createdByUserName = inv.createdByUser
      ? (lang === 'en'
        ? (inv.createdByUser.nameEn || inv.createdByUser.nameAr || inv.createdByUser.email || '')
        : (inv.createdByUser.nameAr || inv.createdByUser.nameEn || inv.createdByUser.email || ''))
      : '';
    const kindLabel = KIND_MAP[inv.kind]?.label ?? inv.kind ?? '—';
    const statusLabel = STATUS_MAP[inv.status]?.label ?? inv.status ?? '—';
    const allocs = getAllocationsForExport(inv, lang, t);
    const row = {
      invoiceNumber: inv.invoiceNumber ?? '',
      supplierInvoiceNumber: inv.supplierInvoiceNumber ?? '',
      supplierName: supplierName || '—',
      createdByUserName: createdByUserName || '—',
      notes: inv.notes ?? '',
      kind: kindLabel,
      netAmount: Number(inv.netAmount ?? 0),
      taxAmount: Number(inv.taxAmount ?? 0),
      totalAmount: Number(inv.totalAmount ?? 0),
      transactionDate: inv.transactionDate ? formatSaudiDateISO(inv.transactionDate) : '—',
      status: statusLabel,
    };
    for (let i = 0; i < MAX_VAULT_SLOTS; i++) {
      const slot = i + 1;
      const al = allocs[i];
      row[`vault${slot}Name`] = al?.name ?? '';
      row[`vault${slot}Type`] = al?.type ?? '';
      row[`vault${slot}Amount`] = al != null ? al.amount : '';
    }
    return row;
  }, [KIND_MAP, STATUS_MAP, t, lang]);

  const exportColumnDefs = useMemo(() => {
    const vaultCols = [];
    for (let s = 1; s <= MAX_VAULT_SLOTS; s++) {
      vaultCols.push(
        { key: `vault${s}Name`, label: t('invoicesExportVaultSlotName', s) },
        { key: `vault${s}Type`, label: t('invoicesExportVaultSlotType', s) },
        { key: `vault${s}Amount`, label: t('invoicesExportVaultSlotAmount', s) },
      );
    }
    return [
      { key: 'invoiceNumber', label: t('documentNumber') },
      { key: 'supplierInvoiceNumber', label: t('supplierInvoiceNumber') },
      { key: 'supplierName', label: t('supplier') },
      { key: 'createdByUserName', label: t('invoiceUserColumn') },
      { key: 'notes', label: t('invoiceNotesColumn') || 'ملاحظة' },
      { key: 'kind', label: t('type') },
      ...vaultCols,
      { key: 'netAmount', label: t('net') },
      { key: 'taxAmount', label: t('tax') },
      { key: 'totalAmount', label: t('total') },
      { key: 'transactionDate', label: t('date') },
      { key: 'status', label: t('statusLabel') },
    ];
  }, [t]);

  const handleExportExcel = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId || undefined,
        q: debouncedQ || undefined,
        categoryId: urlExtra.categoryId || undefined,
        expenseLineId: urlExtra.expenseLineId || undefined,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly || undefined,
        vaultId: filterVaultId || undefined,
        batchId: invoiceBatchIdFromUrl || undefined,
        createdByUserId: filterCreatedByUserId || undefined,
      });
      const rows = all.map(mapInvoiceToExportRow);
      const safeStart = String(invoiceQueryStartDate || '').slice(0, 10).replace(/[^\d-]/g, '') || 'start';
      const safeEnd = String(invoiceQueryEndDate || '').slice(0, 10).replace(/[^\d-]/g, '') || 'end';
      await exportToExcel({
        data: rows,
        filename: `invoices-${safeStart}_${safeEnd}.xlsx`,
        title: `${t('invoicesTitle')} — ${dateFilter.label || ''}`,
        companyName,
        sheetName: lang === 'en' ? 'Invoices' : 'فواتير',
        columns: exportColumnDefs,
        rtl: true,
      });
      showToast(t('exportSuccess') || 'تم التصدير', 'success');
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [
    companyId, displayedTotal, invoiceQueryStartDate, invoiceQueryEndDate, dateFilter.label,
    kindForApi, sortKey, sortDir, filterSupplierId, debouncedQ, urlExtra.categoryId,
    urlExtra.expenseLineId, showCancelled, mapInvoiceToExportRow, exportColumnDefs,
    companyName, t, lang, showToast, filterHasNotesOnly, filterVaultId, invoiceBatchIdFromUrl,
    filterCreatedByUserId,
  ]);

  // المجاميع الحقيقية من السيرفر (كل النتائج المُفلترة، ليس الصفحة فقط)
  const serverAll     = sums.all;
  const serverInflow  = sums.inflow;
  const serverOutflow = sums.outflow;

  const handlePrintInvoices = useCallback(async () => {
    if (!companyId || displayedTotal === 0) return;
    setExportBusy(true);
    try {
      const all = await fetchAllInvoicesForExport({
        companyId,
        startDate: invoiceQueryStartDate,
        endDate: invoiceQueryEndDate,
        kind: kindForApi,
        sortBy: sortKey,
        sortDir,
        supplierId: filterSupplierId || undefined,
        q: debouncedQ || undefined,
        categoryId: urlExtra.categoryId || undefined,
        expenseLineId: urlExtra.expenseLineId || undefined,
        includeCancelled: showCancelled,
        hasNotes: filterHasNotesOnly || undefined,
        vaultId: filterVaultId || undefined,
        batchId: invoiceBatchIdFromUrl || undefined,
        createdByUserId: filterCreatedByUserId || undefined,
      });
      const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rowsHtml = all.map((inv) => {
        const r = mapInvoiceToExportRow(inv);
        return `<tr>${exportColumnDefs.map((c) => `<td>${esc(r[c.key])}</td>`).join('')}</tr>`;
      }).join('');
      const head = `<tr>${exportColumnDefs.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>`;
      const nc = exportColumnDefs.length;
      const baseMetaCols = 6;
      const vaultBlockCols = MAX_VAULT_SLOTS * 3;
      const foot = `<tr><td colspan="${baseMetaCols}">${esc(t('totalInvoices', serverAll.count))}</td><td colspan="${vaultBlockCols}"></td><td>${esc(fmt(Number(serverAll.net)))} SR</td><td>${esc(fmt(Number(serverAll.tax)))} SR</td><td>${esc(fmt(Number(serverAll.total)))} SR</td><td colspan="2"></td></tr>`;
      const table = `<table><thead>${head}</thead><tbody>${rowsHtml || `<tr><td colspan="${nc}">${esc(t('noInvoicesInPeriod'))}</td></tr>`}</tbody><tfoot>${foot}</tfoot></table>`;
      openPrintWindow({
        title: t('invoicesTitle'),
        companyName,
        subtitle: `${t('invoicesTitle')} — ${(fromUrl && toUrl ? `${fromUrl} — ${toUrl}` : dateFilter.label) || ''}`,
        logoUrl,
        landscape: true,
        body: table,
      });
    } catch (e) {
      showToast(e?.message || t('exportFailed'), 'error');
    } finally {
      setExportBusy(false);
    }
  }, [
    companyId, displayedTotal, invoiceQueryStartDate, invoiceQueryEndDate, fromUrl, toUrl, dateFilter.label,
    kindForApi, sortKey, sortDir, filterSupplierId, debouncedQ, urlExtra.categoryId,
    urlExtra.expenseLineId, showCancelled, mapInvoiceToExportRow, exportColumnDefs, t,
    companyName, logoUrl, serverAll, fmt, showToast, filterHasNotesOnly, filterVaultId, invoiceBatchIdFromUrl,
    filterCreatedByUserId,
  ]);

  const vaultRowLabel = useCallback((row) => {
    if (row.unassigned) return t('invoicesSalesUnassignedVault');
    const n = lang === 'en' ? (row.nameEn || row.nameAr) : (row.nameAr || row.nameEn);
    return n || '—';
  }, [t, lang]);

  const footerRow = useMemo(() => [
    {
      keys: ['invoiceNumber', 'supplierInvoiceNumber', 'supplierName', 'createdByDisplayName', 'notesOrEmployee', 'kind', 'vaultLabel'],
      className: 'nx-tfoot-label text-[12px] text-center',
      content: (
        <>
          {t('totalInvoices', serverAll.count)}
          {total > PAGE_SIZE && (
            <span className="text-[11px]" style={{ opacity: 0.65 }}> ({t('allPages')})</span>
          )}
        </>
      ),
    },
    {
      keys: ['netAmount'],
      className: 'nx-tfoot-num nx-cell-num--green text-center',
      content: <FmtNum n={Number(serverAll.net)} />,
    },
    {
      keys: ['taxAmount'],
      className: 'nx-tfoot-num nx-cell-num--amber text-center',
      content: <FmtNum n={Number(serverAll.tax)} />,
    },
    {
      keys: ['totalAmount'],
      className: 'nx-tfoot-num nx-cell-num--violet text-center',
      content: <FmtNum n={Number(serverAll.total)} />,
    },
  ], [t, serverAll, total]);

  const renderMobileCard = useCallback((row) => (
    <div>
      <div className="nx-mc__header">
        <span className="nx-cell-num nx-cell-accent text-[14px]">
          {row.invoiceNumber || '—'}
        </span>
        <div className="nx-mc__meta">
          <span className="nx-cell-muted-sm">{formatSaudiDateISO(row.transactionDate)}</span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-1.5 items-stretch text-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge {...Badge.fromStatus(row.kind, KIND_MAP)} size="sm" />
        </div>
        {row.supplierName ? (
          <div className="text-[13px] text-noorix-muted leading-snug break-words">{row.supplierName}</div>
        ) : null}
        {row.createdByDisplayName ? (
          <div className="text-[12px] text-noorix-text leading-snug break-words">
            <span className="text-noorix-muted font-semibold">{t('invoiceUserColumn')}: </span>
            {row.createdByDisplayName}
          </div>
        ) : null}
      </div>
      <div className="mb-2">
        <div className="text-[10px] font-bold text-noorix-muted mb-1 text-end">{t('invoiceVaultColumn')}</div>
        {row.vaultAllocations?.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {row.vaultAllocations.map((al) => {
              const vn = lang === 'en' ? al.vault?.nameEn || al.vault?.nameAr : al.vault?.nameAr || al.vault?.nameEn;
              return (
                <div
                  key={al.id}
                  className={cn(
                    'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-noorix-border',
                    'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
                  )}
                >
                  <span className="min-w-0 truncate text-[11px] font-semibold text-noorix-text">{vn || '—'}</span>
                  <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-sales">
                    <FmtNum n={al.amount} /> <span className="nx-sar">SR</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[12px] text-noorix-muted">
            {row.vault
              ? (lang === 'en' ? row.vault.nameEn || row.vault.nameAr : row.vault.nameAr || row.vault.nameEn)
              : '—'}
          </div>
        )}
      </div>
      <div className="nx-mc__grid nx-mc__grid--3">
        <div>
          <div className="nx-mc__stat-label">{t('total')}</div>
          <div className="nx-mc__stat-value"><FmtNum n={row.totalAmount} /></div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('net')}</div>
          <div className="nx-mc__stat-value nx-cell-num--green text-[13px]"><FmtNum n={row.netAmount} /></div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('tax')}</div>
          <div className="nx-mc__stat-value nx-cell-num--amber text-[13px]"><FmtNum n={row.taxAmount} /></div>
        </div>
      </div>
      <div className="nx-mc__actions">
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onPrint={() => window.print()}
          onEdit={(r) => setEditingInvoice(r)}
          onDelete={confirmAndDeleteInvoice}
        />
      </div>
    </div>
  ), [KIND_MAP, STATUS_MAP, userRole, companyId, t, lang, confirmAndDeleteInvoice]);

  return (
    <ScreenShell>
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('invoicesTitle')}</h1>
      </div>

      <div className="noorix-print-hide nx-page-header nx-page-header--filter-row">
        <DateFilterBar filter={dateFilter} />
        {companyId && (
          <div className="nx-toolbar">
            <Button
              type="button"
              size="sm"
              onClick={handleExportExcel}
              disabled={exportBusy || displayedTotal === 0}
            >
              {exportBusy ? '…' : t('exportExcel')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handlePrintInvoices}
              disabled={exportBusy || displayedTotal === 0}
            >
              {t('print')}
            </Button>
          </div>
        )}
      </div>

      {!companyId && (
        <div className="noorix-surface-card nx-empty-state">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {editingInvoice && (
        <InvoiceEditModal
          invoice={editingInvoice}
          suppliers={suppliers}
          companyId={companyId}
          vaultsList={paymentVaults}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            setEditingInvoice(null);
          }}
          onClose={() => setEditingInvoice(null)}
        />
      )}
      {dayCloseOpen && (
        <DayCloseReportModal
          companyId={companyId}
          isOpen={dayCloseOpen}
          onClose={() => setDayCloseOpen(false)}
          defaultDateYmd={dayCloseDefaultYmd}
        />
      )}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        entityType="invoices"
        companyId={companyId}
        exportFetcher={async () => {
          const kindForExport = filterKind || (urlExtra.kind ? urlExtra.kind.split(',')[0] : '');
          const res = await getInvoices(
            companyId,
            dateFilter.startDate, dateFilter.endDate,
            1, 2000,
            undefined,
            undefined,
            kindForExport || undefined, undefined, undefined,
            filterSupplierId || undefined, debouncedQ || undefined,
            urlExtra.categoryId || undefined, urlExtra.expenseLineId || undefined,
            true,
            filterHasNotesOnly || undefined,
            filterVaultId || undefined,
            filterCreatedByUserId || undefined,
          );
          return (res?.data?.items ?? []).map(formatInvoiceForExport);
        }}
        onImportSuccess={(count) => {
          invalidateOnFinancialMutation(queryClient);
          showToast(`تم استيراد ${count} فاتورة بنجاح`, 'success');
        }}
      />

      {companyId && (
        <>
          {/* كروت ملخص — نفس ثيم VaultCard */}
          <div className="noorix-exec-card-grid">
            {/* الداخل — المبيعات */}
            <div className="noorix-exec-card noorix-exec-card--inbound flex flex-col">
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </div>
                <span className="noorix-exec-card__title">{t('inbound')} — {t('categoryTypeSale')}</span>
              </div>
              <div className="flex min-h-0 w-full flex-1 flex-col gap-2 px-1 pt-1">
                <div className="border-b border-noorix-border/50 pb-2 text-center">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <FmtNum n={Number(serverInflow.total)} className="text-[22px] font-black tabular-nums leading-none text-noorix-text sm:text-[24px]" />
                    <span className="nx-sar text-noorix-muted">SR</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-noorix-muted">{t('total')}</div>
                </div>
                <div className="text-center text-[10px] font-semibold text-noorix-muted">
                  {t('invoicesVaultChannelFlowTitle')} — {t('invoicesVaultFlowInAbbr')} / {t('invoicesVaultFlowOutAbbr')} / {t('invoicesVaultFlowRemainAbbr')}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {!inflowByVault?.length ? (
                    <div className="col-span-full rounded-lg border border-dashed border-noorix-border/60 py-2 text-center text-[12px] text-noorix-muted">—</div>
                  ) : (
                    inflowByVault.map((row) => {
                      const outNum = Number(row.outflow ?? 0);
                      const remNum = Number(row.remainder ?? 0);
                      return (
                        <div
                          key={row.vaultId}
                          className="flex min-w-0 flex-col gap-1 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5"
                        >
                          <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{vaultRowLabel(row)}</span>
                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div>
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-noorix-muted">{t('invoicesVaultFlowInAbbr')}</div>
                              <div dir="ltr" className="text-[11px] font-bold tabular-nums text-nx-profit">
                                <FmtNum n={Number(row.total)} /> <span className="nx-sar">SR</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-noorix-muted">{t('invoicesVaultFlowOutAbbr')}</div>
                              <div dir="ltr" className="text-[11px] font-bold tabular-nums text-nx-expenses">
                                <FmtNum n={outNum} /> <span className="nx-sar">SR</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-noorix-muted">{t('invoicesVaultFlowRemainAbbr')}</div>
                              <div
                                dir="ltr"
                                className={cn(
                                  'text-[11px] font-bold tabular-nums',
                                  remNum > 0 ? 'text-nx-profit' : remNum < 0 ? 'text-nx-expenses' : 'text-noorix-muted',
                                )}
                              >
                                <FmtNum n={remNum} /> <span className="nx-sar">SR</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="noorix-exec-card__divider mt-1" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
                  <span className="noorix-exec-card__stat-value">{serverInflow.count}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('net')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverInflow.net)} /> <span className="nx-sar">SR</span></span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('tax')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverInflow.tax)} /> <span className="nx-sar">SR</span></span>
                </div>
              </div>
            </div>

            {/* الخارج — المشتريات والمصروفات */}
            <div className="noorix-exec-card noorix-exec-card--outbound flex flex-col">
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M12 5v14M5 12l7 7 7-7"/>
                  </svg>
                </div>
                <span className="noorix-exec-card__title">{t('outbound')} — {t('purchases')} / {t('categoryTypeExpense')}</span>
              </div>
              <div className="flex min-h-0 w-full flex-1 flex-col gap-2 px-1 pt-1">
                <div className="border-b border-noorix-border/50 pb-2 text-center">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <FmtNum n={Number(serverOutflow.total)} className="text-[22px] font-black tabular-nums leading-none text-noorix-text sm:text-[24px]" />
                    <span className="nx-sar text-noorix-muted">SR</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-noorix-muted">{t('total')}</div>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5">
                    <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{t('purchases')}</span>
                    <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-purchases">
                      <FmtNum n={Number(outflowSummary.purchasesTotal)} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5">
                    <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{t('invoicesCardNonPurchaseOutflow')}</span>
                    <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-expenses">
                      <FmtNum n={Number(outflowSummary.expensesTotal)} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 px-2 py-1.5">
                    <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-text">{t('tax')}</span>
                    <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-noorix-amber">
                      <FmtNum n={Number(outflowSummary.taxTotal)} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="noorix-exec-card__divider mt-1" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('validInvoices')}</span>
                  <span className="noorix-exec-card__stat-value">{serverOutflow.count}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('net')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverOutflow.net)} /> <span className="nx-sar">SR</span></span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">{t('tax')}</span>
                  <span className="noorix-exec-card__stat-value"><FmtNum n={Number(serverOutflow.tax)} /> <span className="nx-sar">SR</span></span>
                </div>
              </div>
            </div>
          </div>
          {(urlExtra.categoryId || urlExtra.expenseLineId || urlExtra.kind) && (
            <div
            className="noorix-surface-card flex items-center justify-between flex-wrap gap-3 text-[12px] py-[10px] px-[14px] border border-dashed border-[var(--noorix-blue-35)] bg-[var(--noorix-blue-4)]"
            >
              <span className="nx-cell-muted">{t('invoicesDrillBanner')}</span>
              <Button size="sm" onClick={() => { setUrlExtra({ kind: '', categoryId: '', expenseLineId: '' }); setPage(1); }}>
                {t('clearDrillFilters')}
              </Button>
            </div>
          )}
          <div className="noorix-exec-filters noorix-exec-filters--scroll">
            <Button
              size="sm"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
              onClick={() => setDayCloseOpen(true)}
            >
              {t('dayCloseOpenBtn')}
            </Button>
            <Button
              size="sm"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
              onClick={() => setShowImportExport(true)}
            >
              {t('importExportLabel')}
            </Button>
            <Button
              size="sm"
              variant={filterHasNotesOnly ? 'primary' : 'ghost'}
              aria-pressed={filterHasNotesOnly}
              onClick={() => { setFilterHasNotesOnly((v) => !v); setPage(1); }}
            >
              {t('filterInvoicesWithNotesOnly')}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCancelled((v) => !v)}
              style={showCancelled ? { color: 'var(--noorix-accent-red)', borderColor: 'var(--noorix-red-25)', background: 'var(--noorix-red-6)' } : undefined}
            >
              {showCancelled ? t('hideCancelledInvoices') : t('showCancelledInvoices')}
            </Button>
            <span className="noorix-exec-filters__icon" title={t('filterByType')} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="4 2 20 2 14 10 14 22 10 22 10 10 4 2"/></svg>
            </span>
            <Input
              type="select"
              value={filterKind}
              onChange={(e) => { setFilterKind(e.target.value); setUrlExtra((p) => ({ ...p, kind: '' })); setPage(1); }}
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
            </Input>
            <Input
              type="select"
              value={filterSupplierId}
              onChange={(e) => { setFilterSupplierId(e.target.value); setPage(1); }}
              className="noorix-exec-filters__select"
            >
              <option value="">{t('allSuppliers')}</option>
              {(suppliers || []).map((s) => (
                <option key={s.id} value={s.id}>{(lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn) || s.id}</option>
              ))}
            </Input>
            <span className="noorix-exec-filters__icon" title={t('invoiceUserColumn')} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </span>
            <Input
              type="select"
              value={filterCreatedByUserId}
              onChange={(e) => { setFilterCreatedByUserId(e.target.value); setPage(1); }}
              className="noorix-exec-filters__select"
              aria-label={t('invoiceUserColumn')}
            >
              <option value="">{t('invoicesFilterCreatorAll')}</option>
              <option value="__none__">{t('invoicesFilterCreatorUnrecorded')}</option>
              {creatorUsersForFilter.map((u) => (
                <option key={u.id} value={u.id}>
                  {lang === 'en' ? (u.nameEn || u.nameAr || u.email) : (u.nameAr || u.nameEn || u.email)}
                </option>
              ))}
            </Input>
            <span className="noorix-exec-filters__icon" title={t('invoiceVaultColumn')} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M12 10v4M8 12h8"/></svg>
            </span>
            <Input
              type="select"
              value={filterVaultId}
              onChange={(e) => { setFilterVaultId(e.target.value); setPage(1); }}
              className="noorix-exec-filters__select"
              aria-label={t('invoiceVaultColumn')}
            >
              <option value="">{t('invoicesFilterVaultAll')}</option>
              {vaultsList.map((v) => (
                <option key={v.id} value={v.id}>{vaultDisplayName(v, lang) || v.id}</option>
              ))}
            </Input>
          </div>
          {/* ── عرض الفاتورة (قراءة فقط) ── */}
        {viewingInvoice && (
          <InvoiceViewModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} t={t} lang={lang} fmt={fmt} />
        )}
        <SmartTable
          compact
          showRowNumbers
          tableLayout="fixed"
          innerPadding={8}
          tableId="invoices-list"
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
          footerRow={footerRow}
          title={t('invoicesTitle')}
          badge={
            <>
              <span className="nx-cell-muted-sm">— {dateFilter.label}</span>
              <span className="nx-pill nx-pill--blue nx-pill--sm">{t('invoiceCount', displayedTotal)}</span>
            </>
          }
          searchValue={searchText}
          onSearchChange={setSearchText}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyMessage={t('noInvoicesInPeriod')}
          renderMobileCard={renderMobileCard}
          stripeMobileCards
        />
        </>
      )}
    </ScreenShell>
  );
}
