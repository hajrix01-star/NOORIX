import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Checkbox, DateField, Input, SearchableOptionsPicker, SimpleTable } from '../../../../ui';
import { useApiMutation } from '../../../../hooks/useApiMutation';
import { useApiQuery } from '../../../../hooks/useApiQuery';
import { useDebouncedValue } from '../../../../ui';
import {
  cancelPurchaseDebt,
  createPurchaseDebt,
  getPurchaseDebts,
  restorePurchaseDebt,
  updatePurchaseDebt,
  type PurchaseDebtQuery,
  type PurchaseDebtRecord,
} from '../../../../services/api';
import { purchaseKeys } from '../../../../services/queryKeys';
import type { PurchaseBatchSupplier } from '../purchaseBatchTypes';
import PurchaseDebtFormModal, { type PurchaseDebtFormValue } from './PurchaseDebtFormModal';
import PurchaseDebtBatchModal from './PurchaseDebtBatchModal';

type Props = {
  companyId: string;
  lang: string;
  suppliers: PurchaseBatchSupplier[];
  onImport: (records: PurchaseDebtRecord[]) => void;
};

type DateMode = 'invoice' | 'created' | 'promoted';

const initialFilters = {
  status: '', supplierId: '', q: '', dateMode: 'invoice' as DateMode,
  dateFrom: '', dateTo: '', amountMin: '', amountMax: '',
};

function nameOf(record: PurchaseDebtRecord, lang: string) {
  return lang === 'en'
    ? (record.supplier.nameEn || record.supplier.nameAr)
    : (record.supplier.nameAr || record.supplier.nameEn || '');
}

export default function PurchaseDebtsTab({ companyId, lang, suppliers, onImport }: Props) {
  const ar = lang !== 'en';
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseDebtRecord | null>(null);
  const debouncedSearch = useDebouncedValue(filters.q.trim(), 300);

  const query = useMemo<PurchaseDebtQuery>(() => ({
    status: filters.status as PurchaseDebtQuery['status'],
    supplierId: filters.supplierId || undefined,
    q: debouncedSearch || undefined,
    amountMin: filters.amountMin || undefined,
    amountMax: filters.amountMax || undefined,
    ...(filters.dateMode === 'invoice' ? { invoiceFrom: filters.dateFrom, invoiceTo: filters.dateTo } : {}),
    ...(filters.dateMode === 'created' ? { createdFrom: filters.dateFrom, createdTo: filters.dateTo } : {}),
    ...(filters.dateMode === 'promoted' ? { promotedFrom: filters.dateFrom, promotedTo: filters.dateTo } : {}),
    page,
    pageSize: 25,
  }), [debouncedSearch, filters, page]);

  const debtsQuery = useApiQuery({
    queryKey: purchaseKeys.debts(companyId, query as Record<string, unknown>),
    queryFn: () => getPurchaseDebts(query),
    enabled: !!companyId,
    fallbackMessage: ar ? 'تعذر تحميل المديونيات السابقة.' : 'Unable to load previous debts.',
  });
  const response = debtsQuery.data;
  const items = response?.items ?? [];
  const summary = response?.summary;

  const refresh = () => {
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: purchaseKeys.debtsRoot() });
  };

  const saveMutation = useApiMutation({
    mutationFn: (value: PurchaseDebtFormValue) => editing
      ? updatePurchaseDebt(editing.id, value)
      : createPurchaseDebt(value),
    successToast: ar ? 'تم حفظ سجل المديونية.' : 'Debt record saved.',
    errorToast: (error) => error.message,
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      refresh();
    },
  });

  const cancelMutation = useApiMutation({
    mutationFn: (id: string) => cancelPurchaseDebt(id),
    successToast: ar ? 'تم إلغاء السجل دون حذفه.' : 'Record cancelled without deletion.',
    onSuccess: refresh,
  });
  const restoreMutation = useApiMutation({
    mutationFn: (id: string) => restorePurchaseDebt(id),
    successToast: ar ? 'تمت استعادة السجل إلى غير مرحّل.' : 'Record restored to pending.',
    onSuccess: refresh,
  });

  const money = (value: unknown) => `${Number(value || 0).toLocaleString(lang === 'en' ? 'en-SA' : 'ar-SA', { maximumFractionDigits: 2 })} ${ar ? 'ر.س' : 'SR'}`;
  const statusBadge = (status: string) => {
    if (status === 'promoted') return <Badge color="green" dot>{ar ? 'مرحّل' : 'Promoted'}</Badge>;
    if (status === 'cancelled') return <Badge color="gray" dot>{ar ? 'ملغي' : 'Cancelled'}</Badge>;
    return <Badge color="amber" dot>{ar ? 'غير مرحّل' : 'Pending'}</Badge>;
  };
  const pendingItems = items.filter((item) => item.status === 'pending');
  const allPendingSelected = pendingItems.length > 0 && pendingItems.every((item) => selected.has(item.id));
  const selectedRecords = items.filter((item) => selected.has(item.id) && item.status === 'pending');
  const totalPages = Math.max(1, Math.ceil((response?.total || 0) / (response?.pageSize || 25)));

  const columns = [
    {
      key: 'select', label: (
        <Checkbox
          checked={allPendingSelected}
          onChange={() => setSelected(allPendingSelected ? new Set() : new Set(pendingItems.map((item) => item.id)))}
          aria-label={ar ? 'تحديد الصفحة' : 'Select page'}
        />
      ), width: 44, render: (_: unknown, row: PurchaseDebtRecord) => row.status === 'pending' ? (
        <Checkbox
          checked={selected.has(row.id)}
          onChange={() => setSelected((current) => {
            const next = new Set(current);
            if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
            return next;
          })}
          aria-label={ar ? 'تحديد السجل' : 'Select record'}
        />
      ) : null,
    },
    { key: 'supplier', label: ar ? 'المورد' : 'Supplier', minWidth: 170, render: (_: unknown, row: PurchaseDebtRecord) => <span className="font-semibold">{nameOf(row, lang)}</span> },
    { key: 'supplierInvoiceNumber', label: ar ? 'رقم الفاتورة' : 'Invoice no.', minWidth: 120 },
    { key: 'invoiceDate', label: ar ? 'تاريخ الفاتورة' : 'Invoice date', minWidth: 110, render: (value: unknown) => String(value || '').slice(0, 10) },
    { key: 'totalAmount', label: ar ? 'الإجمالي' : 'Total', numeric: true, minWidth: 110, render: (value: unknown) => <strong>{money(value)}</strong> },
    { key: 'isTaxable', label: 'VAT', width: 70, render: (value: unknown) => value ? <Badge color="amber">15%</Badge> : <span className="text-noorix-muted">—</span> },
    { key: 'status', label: ar ? 'الحالة' : 'Status', minWidth: 100, render: (value: unknown) => statusBadge(String(value)) },
    { key: 'promotedAt', label: ar ? 'تاريخ الترحيل' : 'Promoted at', minWidth: 115, render: (value: unknown) => value ? String(value).slice(0, 10) : '—' },
    { key: 'promotionBatchId', label: ar ? 'مرجع الدفعة' : 'Batch ref.', minWidth: 135, render: (value: unknown) => value ? <span className="nx-font-numbers text-[11px]">{String(value)}</span> : '—' },
    { key: 'actions', label: '', width: 150, render: (_: unknown, row: PurchaseDebtRecord) => row.status === 'pending' ? (
      <div className="flex justify-center gap-1.5">
        <Button size="sm" onClick={() => { setEditing(row); setFormOpen(true); }}>{ar ? 'تعديل' : 'Edit'}</Button>
        <Button
          size="sm"
          variant="ghost"
          loading={cancelMutation.isPending && cancelMutation.variables === row.id}
          onClick={() => {
            if (window.confirm(ar ? 'إلغاء هذا السجل مع الاحتفاظ به في الأرشيف؟' : 'Cancel this record and keep it archived?')) cancelMutation.mutate(row.id);
          }}
        >{ar ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    ) : row.status === 'cancelled' ? (
      <Button
        size="sm"
        loading={restoreMutation.isPending && restoreMutation.variables === row.id}
        onClick={() => restoreMutation.mutate(row.id)}
      >{ar ? 'استعادة' : 'Restore'}</Button>
    ) : null },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-noorix-text">{ar ? 'سجل المديونيات السابقة' : 'Previous debt register'}</h2>
          <p className="text-[12px] text-noorix-muted">{ar ? 'توثيق تشغيلي مستقل حتى لحظة الترحيل إلى فاتورة مشتريات.' : 'Operational staging, independent until purchase-invoice promotion.'}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={selectedRecords.length === 0}
            onClick={() => onImport(selectedRecords)}
          >{ar ? `إضافة للإدخال الجماعي (${selectedRecords.length})` : `Add to batch entry (${selectedRecords.length})`}</Button>
          <Button variant="success" onClick={() => setBatchOpen(true)}>+ {ar ? 'إدخال جماعي للمديونيات' : 'Batch debt entry'}</Button>
          <Button variant="success" onClick={() => { setEditing(null); setFormOpen(true); }}>+ {ar ? 'مديونية سابقة' : 'Previous debt'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card variant="stat" color="blue" label={ar ? 'إجمالي المديونيات' : 'Total debts'} value={money(summary?.totalAmount)}>
          <p className="mt-1 text-[11px] text-noorix-muted">{summary?.totalCount || 0} {ar ? 'فاتورة' : 'invoices'}</p>
        </Card>
        <Card variant="stat" color="amber" label={ar ? 'غير مرحّل' : 'Pending'} value={money(summary?.pendingAmount)}>
          <p className="mt-1 text-[11px] text-noorix-muted">{summary?.pendingCount || 0} {ar ? 'فاتورة' : 'invoices'}</p>
        </Card>
        <Card variant="stat" color="green" label={ar ? 'تم ترحيله' : 'Promoted'} value={money(summary?.promotedAmount)}>
          <p className="mt-1 text-[11px] text-noorix-muted">{summary?.promotedCount || 0} {ar ? 'فاتورة' : 'invoices'}</p>
        </Card>
        <Card variant="stat" color="violet" label={ar ? 'نسبة الترحيل بالقيمة' : 'Promotion rate by value'} value={`${summary?.promotionRate || 0}%`} />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Input
            type="search" placeholder={ar ? 'بحث برقم الفاتورة أو المورد...' : 'Search invoice or supplier...'}
            value={filters.q} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setFilters((old) => ({ ...old, q: event.target.value })); setPage(1); }}
            containerClassName="xl:col-span-2"
          />
          <SearchableOptionsPicker
            mode="single" value={filters.status}
            onChange={(value) => { setFilters((old) => ({ ...old, status: value })); setPage(1); }}
            options={[
              { value: 'pending', label: ar ? 'غير مرحّل' : 'Pending' },
              { value: 'promoted', label: ar ? 'مرحّل' : 'Promoted' },
              { value: 'cancelled', label: ar ? 'ملغي' : 'Cancelled' },
            ]}
            allowEmpty emptyValue="" emptyLabel={ar ? 'كل الحالات' : 'All statuses'}
          />
          <SearchableOptionsPicker
            mode="single" value={filters.supplierId}
            onChange={(value) => { setFilters((old) => ({ ...old, supplierId: value })); setPage(1); }}
            options={suppliers.map((supplier) => ({
              value: supplier.id,
              label: ar ? (supplier.nameAr || supplier.nameEn || '') : (supplier.nameEn || supplier.nameAr || ''),
            }))}
            allowEmpty emptyValue="" emptyLabel={ar ? 'كل الموردين' : 'All suppliers'}
          />
          <SearchableOptionsPicker
            mode="single" value={filters.dateMode}
            onChange={(value) => setFilters((old) => ({ ...old, dateMode: value as DateMode }))}
            options={[
              { value: 'invoice', label: ar ? 'تاريخ الفاتورة' : 'Invoice date' },
              { value: 'created', label: ar ? 'تاريخ التسجيل' : 'Created date' },
              { value: 'promoted', label: ar ? 'تاريخ الترحيل' : 'Promoted date' },
            ]}
          />
          <DateField lang={ar ? 'ar' : 'en'} value={filters.dateFrom} onValueChange={(value) => { setFilters((old) => ({ ...old, dateFrom: value })); setPage(1); }} />
          <DateField lang={ar ? 'ar' : 'en'} value={filters.dateTo} onValueChange={(value) => { setFilters((old) => ({ ...old, dateTo: value })); setPage(1); }} />
          <Input type="number" min="0" placeholder={ar ? 'أقل مبلغ' : 'Min amount'} value={filters.amountMin} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setFilters((old) => ({ ...old, amountMin: event.target.value })); setPage(1); }} />
          <Input type="number" min="0" placeholder={ar ? 'أعلى مبلغ' : 'Max amount'} value={filters.amountMax} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setFilters((old) => ({ ...old, amountMax: event.target.value })); setPage(1); }} />
          <Button onClick={() => { setFilters(initialFilters); setPage(1); }}>{ar ? 'مسح الفلاتر' : 'Clear filters'}</Button>
        </div>
      </Card>

      <SimpleTable
        columns={columns}
        data={items}
        tableMinWidth={1180}
        maxHeight="520px"
        stickyHeader
        emptyMessage={debtsQuery.isLoading ? (ar ? 'جارٍ التحميل...' : 'Loading...') : (ar ? 'لا توجد مديونيات مطابقة.' : 'No matching debts.')}
      />

      <div className="flex items-center justify-between gap-3 text-[12px] text-noorix-muted">
        <span>{ar ? `إجمالي النتائج: ${response?.total || 0}` : `Total results: ${response?.total || 0}`}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{ar ? 'السابق' : 'Previous'}</Button>
          <span className="nx-font-numbers">{page} / {totalPages}</span>
          <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{ar ? 'التالي' : 'Next'}</Button>
        </div>
      </div>

      <PurchaseDebtFormModal
        open={formOpen}
        lang={lang}
        suppliers={suppliers}
        editing={editing}
        saving={saveMutation.isPending}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={(value) => saveMutation.mutate(value)}
      />
      <PurchaseDebtBatchModal
        open={batchOpen}
        lang={lang}
        suppliers={suppliers}
        onClose={() => setBatchOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
