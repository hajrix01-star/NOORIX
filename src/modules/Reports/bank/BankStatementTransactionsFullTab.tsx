/**
 * جدول العمليات الكامل — فرز، تصفية، تصنيف، ملاحظات
 * واجهة محترفة مع تمييز لوني وعرض واضح للأرقام
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { getTxKey } from './bankAnalysisUtils';
import { FALLBACK_CATEGORIES } from './bankAnalysisUtils';
import { Button, Checkbox, Input, SmartTable , FmtNum } from '../../../ui';

export default function BankStatementTransactionsFullTab({
  statement,
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
}: any) {
  const { t } = useTranslation();

  /* التصنيفات: من القاعدة أولاً، ثم القواعد الافتراضية */
  const allCategoryOptions = React.useMemo(() => {
    const fromDb = (categories || []).map((c: any) => ({ id: c.id, label: c.nameAr || c.nameEn }));
    if (fromDb.length > 0) return fromDb;
    return FALLBACK_CATEGORIES.map((name: any) => ({ id: name, label: name }));
  }, [categories]);

  const allSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx: any) => selectedTxIds.has(getTxKey(tx)));

  return (
    <div className="grid gap-3.5">
      {/* ── شريط الفلاتر ── */}
      <div className="bank-transactions-filter-grid grid gap-2.5 bg-noorix-bg-muted rounded-xl p-3 border border-noorix-border">
        {/* بحث */}
        <div className="bank-transactions-search-wrap">
          <span className="bank-transactions-search-icon">
            
          </span>
          <Input
            type="search"
            placeholder={t('bankSearchTransactions')}
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            className="bank-transactions-search-input"
          />
        </div>

        {/* فلتر الفئة */}
        <Input
          type="select"
          value={categoryFilter}
          onChange={(e: any) => setCategoryFilter(e.target.value)}
        >
          <option value="all">{t('bankFilterAllCategories')}</option>
          {categoryNames.map((n: any) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Input>

        {/* فلتر النوع */}
        <Input
          type="select"
          value={typeFilter}
          onChange={(e: any) => setTypeFilter(e.target.value)}
        >
          <option value="all">{t('bankTypeAll')}</option>
          <option value="debit">{t('bankTypeWithdrawals')}</option>
          <option value="credit">{t('bankTypeDeposits')}</option>
        </Input>

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
      </div>

      {/* ── إضافة فئة جديدة ── */}
      <div
        className="flex items-center flex flex-wrap gap-2 bg-noorix-bg-muted rounded-lg border border-noorix-border px-3 py-2"
      >
        <span className="text-[12px] font-semibold text-noorix-muted">
          {t('bankStatementAddCategory')}:
        </span>
        <Input
          value={newCategoryName}
          onChange={(e: any) => setNewCategoryName(e.target.value)}
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
            render: (_: any, tx: any) => (
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
            render: (v: any) => <span className="whitespace-nowrap text-noorix-muted text-[11px]">{v}</span>,
          },
          {
            key: 'description',
            label: t('bankStatementDescription'),
            sortable: true,
            render: (v: any) => (
              <div className="max-w-[280px] truncate text-[12px]" title={v}>{v}</div>
            ),
          },
          {
            key: 'categoryId',
            label: t('bankStatementCategories'),
            render: (catId: any, tx: any) =>
              editingTxId === tx.id ? (
                <div className="flex flex-col gap-1">
                  <Input
                    type="select"
                    value={editingCategory}
                    onChange={(e: any) => setEditingCategory(e.target.value)}
                  >
                    <option value="">{t('uncategorized')}</option>
                    {allCategoryOptions.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </Input>
                  <div className="flex gap-1">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={updateCategoryMutation.isPending}
                      onClick={() => handleCategoryChange(tx.id, editingCategory || null)}
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
                  onClick={() => { setEditingTxId(tx.id); setEditingCategory(catId || ''); }}
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
            render: (v: any) => Number(v) > 0 ? (
              <span className="nx-ltr inline-block font-bold text-noorix-red px-2 py-[2px] rounded-[6px] text-[12px] bg-[var(--noorix-red-7)]">
                <FmtNum n={Number(v)} />
              </span>
            ) : <span className="text-noorix-muted">—</span>,
          },
          {
            key: 'credit',
            label: t('bankStatementColCredit'),
            sortable: true,
            numeric: true,
            render: (v: any) => Number(v) > 0 ? (
              <span className="nx-ltr inline-block font-bold text-noorix-green px-2 py-[2px] rounded-[6px] text-[12px] bg-[var(--noorix-green-7)]">
                <FmtNum n={Number(v)} />
              </span>
            ) : <span className="text-noorix-muted">—</span>,
          },
          {
            key: 'balance',
            label: t('bankStatementBalance'),
            sortable: true,
            numeric: true,
            render: (v: any) => (
              <span className="nx-ltr text-[12px] text-noorix-muted">
                {v != null && Number(v) !== 0 ? fmt(Number(v)) : '—'}
              </span>
            ),
          },
          {
            key: 'note',
            label: t('bankStatementAddNote'),
            render: (v: any, tx: any) =>
              editingNoteId === tx.id ? (
                <div className="flex flex-col gap-1">
                  <Input
                    value={editingNote}
                    onChange={(e: any) => setEditingNote(e.target.value)}
                    className="bank-transactions-note-input"
                  />
                  <div className="flex gap-1">
                    <Button variant="primary" size="sm" disabled={updateNoteMutation.isPending} onClick={() => handleNoteChange(tx.id)}>
                      {t('save')}
                    </Button>
                    <Button size="sm" onClick={() => { setEditingNoteId(null); setEditingNote(''); }}>{t('cancel')}</Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  className={v ? 'text-noorix-blue' : 'text-noorix-muted'}
                  onClick={() => { setEditingNoteId(tx.id); setEditingNote(v || ''); }}
                >
                  {v ? `${(v || '').slice(0, 20)}…` : '+ ملاحظة'}
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
        getRowStyle={(tx: any) =>
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
