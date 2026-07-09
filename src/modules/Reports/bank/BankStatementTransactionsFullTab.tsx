/**
 * جدول العمليات الكامل — فرز، تصفية، تصنيف، ملاحظات
 * واجهة محترفة مع تمييز لوني وعرض واضح للأرقام
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { getTxKey, FALLBACK_CATEGORIES } from './bankAnalysisUtils';
import { Button, Checkbox, FilterToolbar, Input, SearchableOptionsPicker, SmartTable , FmtNum } from '../../../ui';
import type {
  BankCategoryLite,
  BankCategoryOption,
  BankColumnTotals,
  BankSortConfig,
  BankStatementLite,
  BankTransactionLite,
} from './bankAnalysisTab.types';

type PendingMutation = { isPending?: boolean };

type BankStatementTransactionsFullTabProps = {
  statement: BankStatementLite;
  categories?: BankCategoryLite[];
  filteredTransactions: BankTransactionLite[];
  columnTotals: BankColumnTotals;
  categoryNames: string[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  editingTxId: string | null;
  setEditingTxId: (value: string | null) => void;
  editingCategory: string;
  setEditingCategory: (value: string) => void;
  editingNoteId: string | null;
  setEditingNoteId: (value: string | null) => void;
  editingNote: string;
  setEditingNote: (value: string) => void;
  sortConfig: BankSortConfig;
  handleSort: (key: string) => void;
  selectedTxIds: Set<string>;
  toggleTxSelection: (tx: BankTransactionLite) => void;
  toggleAllFiltered: () => void;
  handleCategoryChange: (txId: string, categoryId: string | null) => void;
  handleNoteChange: (txId: string) => void;
  updateCategoryMutation: PendingMutation;
  updateNoteMutation: PendingMutation;
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  onCreateCategory: () => void;
};

export default function BankStatementTransactionsFullTab({
  statement: _statement,
  categories,
  filteredTransactions,
  columnTotals,
  categoryNames,
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  typeFilter,
  setTypeFilter,
  editingTxId,
  setEditingTxId,
  editingCategory,
  setEditingCategory,
  editingNoteId,
  setEditingNoteId,
  editingNote,
  setEditingNote,
  sortConfig,
  handleSort,
  selectedTxIds,
  toggleTxSelection,
  toggleAllFiltered,
  handleCategoryChange,
  handleNoteChange,
  updateCategoryMutation,
  updateNoteMutation,
  newCategoryName,
  setNewCategoryName,
  onCreateCategory,
}: BankStatementTransactionsFullTabProps) {
  const { t } = useTranslation();

  /* التصنيفات: من القاعدة أولاً، ثم القواعد الافتراضية */
  const allCategoryOptions = React.useMemo(() => {
    const fromDb: BankCategoryOption[] = (categories || [])
      .filter((category): category is BankCategoryLite & { id: string } => typeof category.id === 'string' && !!category.id)
      .map((category) => ({ id: category.id, label: category.nameAr || category.nameEn || category.id }));
    if (fromDb.length > 0) return fromDb;
    return FALLBACK_CATEGORIES.map((name) => ({ id: name, label: name }));
  }, [categories]);

  const allSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedTxIds.has(getTxKey(tx)));

  return (
    <div className="grid gap-3.5">
      {/* ── شريط الفلاتر ── */}
      <FilterToolbar variant="bare" className="bank-transactions-filter-grid grid gap-2.5 bg-noorix-bg-muted rounded-xl p-3 border border-noorix-border">
        {/* بحث */}
        <div className="bank-transactions-search-wrap">
          <span className="bank-transactions-search-icon">
            
          </span>
          <Input
            type="search"
            placeholder={t('bankSearchTransactions')}
            value={searchTerm}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
            className="bank-transactions-search-input"
          />
        </div>

        {/* فلتر الفئة */}
        <SearchableOptionsPicker
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: 'all', label: t('bankFilterAllCategories') },
            ...categoryNames.map((name) => ({ value: name, label: name })),
          ]}
          aria-label={t('bankFilterAllCategories')}
        />

        {/* فلتر النوع */}
        <SearchableOptionsPicker
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: t('bankTypeAll') },
            { value: 'debit', label: t('bankTypeWithdrawals') },
            { value: 'credit', label: t('bankTypeDeposits') },
          ]}
          aria-label={t('bankTypeAll')}
        />

        {/* إحصاء */}
        <div className="noorix-surface-card flex items-center gap-10 px-3 py-1 text-[12px]">
          <span className="text-noorix-muted">النتائج:</span>
          <span className="font-bold">{filteredTransactions.length}</span>
          <span className="text-noorix-muted">عملية</span>
          {selectedTxIds.size > 0 && (
            <span className="bg-noorix-blue text-white rounded-xl px-2 py-[2px] text-[11px] font-bold">
              {selectedTxIds.size} محدد
            </span>
          )}
        </div>
      </FilterToolbar>

      {/* ── إضافة فئة جديدة ── */}
      <div
        className="flex items-center flex flex-wrap gap-2 bg-noorix-bg-muted rounded-lg border border-noorix-border px-3 py-2"
      >
        <span className="text-[12px] font-semibold text-noorix-muted">
          {t('bankStatementAddCategory')}:
        </span>
        <Input
          value={newCategoryName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNewCategoryName(event.target.value)}
          placeholder={t('bankStatementCategoryName')}
          className="bank-transactions-new-category-input"
        />
        <Button variant="primary" size="sm" onClick={onCreateCategory}>{t('bankStatementAddCategory')}</Button>
      </div>

      {/* ── الجدول ── */}
      <SmartTable
        columns={[
          {
            key: 'select',
            shrink: true,
            width: 36,
            label: (
              <Checkbox
                aria-label={t('bankSelectAll')}
                checked={allSelected}
                onChange={toggleAllFiltered}
              />
            ),
            render: (_value, tx) => (
              <Checkbox
                checked={selectedTxIds.has(getTxKey(tx))}
                onChange={() => toggleTxSelection(tx)}
              />
            ),
          },
          {
            key: 'txDate',
            label: t('bankStatementDate'),
            shrink: true,
            sortable: true,
            render: (value) => <span className="whitespace-nowrap text-noorix-muted text-[11px]">{String(value || '')}</span>,
          },
          {
            key: 'description',
            label: t('bankStatementDescription'),
            sortable: true,
            render: (value) => (
              <div className="max-w-[280px] truncate text-[12px]" title={String(value || '')}>{String(value || '')}</div>
            ),
          },
          {
            key: 'categoryId',
            label: t('bankStatementCategories'),
            render: (catId, tx) =>
              editingTxId === tx.id ? (
                <div className="flex flex-col gap-1">
                  <SearchableOptionsPicker
                    allowEmpty
                    emptyValue=""
                    emptyLabel={t('uncategorized')}
                    value={editingCategory}
                    onChange={setEditingCategory}
                    options={allCategoryOptions.map((category) => ({ value: category.id, label: category.label }))}
                    aria-label={t('bankStatementCategories')}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={updateCategoryMutation.isPending}
                      onClick={() => {
                        if (!tx.id) return;
                        handleCategoryChange(tx.id, editingCategory || null);
                      }}
                    >
                      {t('save')}
                    </Button>
                    <Button size="sm" onClick={() => setEditingTxId(null)}>{t('cancel')}</Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="text-start max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap block"
                  onClick={() => { setEditingTxId(tx.id || null); setEditingCategory(String(catId || '')); }}
                >
                  {tx.category?.nameAr || tx.category?.nameEn || t('uncategorized')}
                </Button>
              ),
          },
          {
            key: 'debit',
            label: t('bankStatementColDebit'),
            sortable: true,
            numeric: true,
            render: (value) => Number(value) > 0 ? (
              <span className="nx-ltr inline-block font-bold text-noorix-red px-2 py-[2px] rounded-[6px] text-[12px] bg-[var(--noorix-red-7)]">
                <FmtNum n={Number(value)} />
              </span>
            ) : <span className="text-noorix-muted">—</span>,
          },
          {
            key: 'credit',
            label: t('bankStatementColCredit'),
            sortable: true,
            numeric: true,
            render: (value) => Number(value) > 0 ? (
              <span className="nx-ltr inline-block font-bold text-noorix-green px-2 py-[2px] rounded-[6px] text-[12px] bg-[var(--noorix-green-7)]">
                <FmtNum n={Number(value)} />
              </span>
            ) : <span className="text-noorix-muted">—</span>,
          },
          {
            key: 'balance',
            label: t('bankStatementBalance'),
            sortable: true,
            numeric: true,
            render: (value) => (
              <span className="nx-ltr text-[12px] text-noorix-muted">
                {value != null && Number(value) !== 0 ? fmt(Number(value)) : '—'}
              </span>
            ),
          },
          {
            key: 'note',
            label: t('bankStatementAddNote'),
            render: (value, tx) =>
              editingNoteId === tx.id ? (
                <div className="flex flex-col gap-1">
                  <Input
                    value={editingNote}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEditingNote(event.target.value)}
                    className="bank-transactions-note-input"
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={updateNoteMutation.isPending || !tx.id}
                      onClick={() => {
                        if (!tx.id) return;
                        handleNoteChange(tx.id);
                      }}
                    >
                      {t('save')}
                    </Button>
                    <Button size="sm" onClick={() => { setEditingNoteId(null); setEditingNote(''); }}>{t('cancel')}</Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  className={value ? 'text-noorix-blue' : 'text-noorix-muted'}
                  onClick={() => { setEditingNoteId(tx.id || null); setEditingNote(String(value || '')); }}
                >
                  {value ? `${String(value).slice(0, 20)}…` : '+ ملاحظة'}
                </Button>
              ),
          },
        ]}
        data={filteredTransactions}
        tableMinWidth={780}
        sortKey={sortConfig.key}
        sortDir={sortConfig.direction}
        onSort={handleSort}
        emptyMessage="لا توجد عمليات تطابق الفلاتر المحددة."
        getRowStyle={(tx) =>
          selectedTxIds.has(getTxKey(tx))
            ? { background: 'var(--noorix-blue-6)', transition: 'background 0.15s' }
            : undefined
        }
        footerCells={
          <>
            <td colSpan={4} className="bank-transactions-footer-cell text-[12px] text-noorix-muted">
              {t('bankColumnTotalsFiltered')} ({filteredTransactions.length} عملية)
            </td>
            <td className="bank-transactions-footer-cell text-right">
              <FmtNum n={columnTotals.debit} className="nx-ltr inline-block text-noorix-red text-[13px] font-extrabold" />
            </td>
            <td className="bank-transactions-footer-cell text-right">
              <FmtNum n={columnTotals.credit} className="nx-ltr inline-block text-noorix-green text-[13px] font-extrabold" />
            </td>
            <td colSpan={2} className="bank-transactions-footer-cell text-right text-[12px]">
              <span
                className={`nx-ltr inline-block font-[800]${columnTotals.credit - columnTotals.debit >= 0 ? ' text-noorix-green' : ' text-noorix-red'}`}
              >
                {columnTotals.credit - columnTotals.debit >= 0 ? '+' : ''}<FmtNum n={columnTotals.credit - columnTotals.debit} />
              </span>
            </td>
          </>
        }
      />
    </div>
  );
}
