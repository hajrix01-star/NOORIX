import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Checkbox, DateField, Input, SearchableOptionsPicker } from '../../../../ui';
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
import { groupPurchaseDebtsBySupplier } from '../purchaseDebtSupplierGroups';

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
    pageSize: 100,
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
  const supplierGroups = useMemo(() => groupPurchaseDebtsBySupplier(items, lang), [items, lang]);
  const totalPages = Math.max(1, Math.ceil((response?.total || 0) / (response?.pageSize || 25)));

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

      <section className="space-y-3" aria-label={ar ? 'مديونيات الموردين' : 'Supplier debts'}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-noorix-muted">
          <span>{ar ? `${supplierGroups.length} مورد في الصفحة المعروضة` : `${supplierGroups.length} suppliers on this page`}</span>
          {pendingItems.length > 0 ? (
            <Checkbox
              checked={allPendingSelected}
              onChange={() => setSelected(allPendingSelected ? new Set() : new Set(pendingItems.map((item) => item.id)))}
              label={ar ? 'تحديد كل غير المرحلة في الصفحة' : 'Select all pending on this page'}
            />
          ) : null}
        </div>

        {supplierGroups.length === 0 ? (
          <Card padding="md">
            <p className="text-center text-[13px] text-noorix-muted">
              {debtsQuery.isLoading ? (ar ? 'جارٍ التحميل...' : 'Loading...') : (ar ? 'لا توجد مديونيات مطابقة.' : 'No matching debts.')}
            </p>
          </Card>
        ) : supplierGroups.map((group) => {
          const groupPending = group.records.filter((record) => record.status === 'pending');
          const isGroupSelected = groupPending.length > 0 && groupPending.every((record) => selected.has(record.id));
          return (
            <Card key={group.supplierId} padding="none" className="overflow-hidden border border-noorix-border">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-noorix-border bg-noorix-surface px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[15px] font-bold text-noorix-text">{group.supplierName}</h3>
                    <Badge color="blue">{group.records.length} {ar ? 'فاتورة' : 'invoices'}</Badge>
                    {group.pendingCount > 0 ? <Badge color="amber">{group.pendingCount} {ar ? 'غير مرحلة' : 'pending'}</Badge> : null}
                    {group.promotedCount > 0 ? <Badge color="green">{group.promotedCount} {ar ? 'مرحلة' : 'promoted'}</Badge> : null}
                    {group.cancelledCount > 0 ? <Badge color="gray">{group.cancelledCount} {ar ? 'ملغاة' : 'cancelled'}</Badge> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-noorix-muted">{ar ? 'فواتير المورد ومراحلها ضمن نطاق الفلترة الحالي.' : 'Supplier invoices and their status within the current filters.'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-end">
                    <p className="text-[11px] text-noorix-muted">{ar ? 'إجمالي المورد' : 'Supplier total'}</p>
                    <strong className="nx-font-numbers text-[16px] text-noorix-text">{money(group.totalAmount)}</strong>
                  </div>
                  {groupPending.length > 0 ? (
                    <Checkbox
                      checked={isGroupSelected}
                      onChange={() => setSelected((current) => {
                        const next = new Set(current);
                        for (const record of groupPending) {
                          if (isGroupSelected) next.delete(record.id); else next.add(record.id);
                        }
                        return next;
                      })}
                      aria-label={ar ? `تحديد فواتير ${group.supplierName} غير المرحلة` : `Select ${group.supplierName} pending invoices`}
                    />
                  ) : null}
                </div>
              </header>

              <div className="divide-y divide-noorix-border">
                {group.records.map((row) => (
                  <article key={row.id} className="grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.25fr)_auto_auto] sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <strong className="nx-font-numbers text-[13px] text-noorix-text">{row.supplierInvoiceNumber}</strong>
                        <span className="nx-font-numbers text-[12px] text-noorix-muted">{String(row.invoiceDate || '').slice(0, 10)}</span>
                        {row.isTaxable ? <Badge color="amber">VAT 15%</Badge> : null}
                        {statusBadge(row.status)}
                      </div>
                      {row.notes ? <p className="mt-1 truncate text-[11px] text-noorix-muted">{row.notes}</p> : null}
                      {row.status === 'promoted' && row.promotedInvoice ? (
                        <p className="mt-1 text-[11px] text-noorix-muted">{ar ? `رُحلت إلى ${row.promotedInvoice.invoiceNumber}` : `Promoted to ${row.promotedInvoice.invoiceNumber}`}</p>
                      ) : null}
                    </div>
                    <strong className="nx-font-numbers text-[15px] text-noorix-text sm:text-end">{money(row.totalAmount)}</strong>
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      {row.status === 'pending' ? (
                        <>
                          <Checkbox
                            checked={selected.has(row.id)}
                            onChange={() => setSelected((current) => {
                              const next = new Set(current);
                              if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                              return next;
                            })}
                            aria-label={ar ? `تحديد ${row.supplierInvoiceNumber}` : `Select ${row.supplierInvoiceNumber}`}
                          />
                          <Button size="sm" onClick={() => { setEditing(row); setFormOpen(true); }}>{ar ? 'تعديل' : 'Edit'}</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={cancelMutation.isPending && cancelMutation.variables === row.id}
                            onClick={() => {
                              if (window.confirm(ar ? 'إلغاء هذا السجل مع الاحتفاظ به في الأرشيف؟' : 'Cancel this record and keep it archived?')) cancelMutation.mutate(row.id);
                            }}
                          >{ar ? 'إلغاء' : 'Cancel'}</Button>
                        </>
                      ) : row.status === 'cancelled' ? (
                        <Button
                          size="sm"
                          loading={restoreMutation.isPending && restoreMutation.variables === row.id}
                          onClick={() => restoreMutation.mutate(row.id)}
                        >{ar ? 'استعادة' : 'Restore'}</Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          );
        })}
      </section>

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
