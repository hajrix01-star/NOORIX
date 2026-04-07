/**
 * جدول العمليات الكامل — فرز، تصفية، تصنيف، ملاحظات
 * واجهة محترفة مع تمييز لوني وعرض واضح للأرقام
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { getTxKey } from './bankAnalysisUtils';
import { FALLBACK_CATEGORIES } from './bankAnalysisUtils';
import { Button, Input } from '../../../ui';

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
}) {
  const { t } = useTranslation();

  /* التصنيفات: من القاعدة أولاً، ثم القواعد الافتراضية */
  const allCategoryOptions = React.useMemo(() => {
    const fromDb = (categories || []).map((c) => ({ id: c.id, label: c.nameAr || c.nameEn }));
    if (fromDb.length > 0) return fromDb;
    return FALLBACK_CATEGORIES.map((name) => ({ id: name, label: name }));
  }, [categories]);

  const SortBtn = ({ label, sortKey }) => (
    <Button
      type="button"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 12,
        padding: '4px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        color: sortConfig.key === sortKey ? 'var(--noorix-accent-blue)' : 'inherit',
        whiteSpace: 'nowrap',
      }}
      onClick={() => handleSort(sortKey)}
    >
      {label}
      <span style={{ fontSize: 10, opacity: sortConfig.key === sortKey ? 1 : 0.35 }}>
        {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
      </span>
    </Button>
  );

  const allSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedTxIds.has(getTxKey(tx)));

  return (
    <div className="grid gap-3.5">
      {/* ── شريط الفلاتر ── */}
      <div
        className="grid gap-2.5 bg-noorix-bg-muted rounded-xl p-3 border border-noorix-border"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        }}
      >
        {/* بحث */}
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              insetInlineStart: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 14,
              pointerEvents: 'none',
              color: 'var(--noorix-text-muted)',
            }}
          >
            
          </span>
          <Input
            type="search"
            placeholder={t('bankSearchTransactions')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: 8,
              border: '1px solid var(--noorix-border)',
              background: 'var(--noorix-bg)',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* فلتر الفئة */}
        <Input
          type="select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">{t('bankFilterAllCategories')}</option>
          {categoryNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Input>

        {/* فلتر النوع */}
        <Input
          type="select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">{t('bankTypeAll')}</option>
          <option value="debit">{t('bankTypeWithdrawals')}</option>
          <option value="credit">{t('bankTypeDeposits')}</option>
        </Input>

        {/* إحصاء */}
        <div
          className="flex items-center gap-10 text-[12px] rounded-lg px-3 py-1 bg-noorix-surface border border-noorix-border"
        >
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
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder={t('bankStatementCategoryName')}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--noorix-border)',
            width: '100%',
            maxWidth: 200,
            flex: '1 1 200px',
            fontSize: 13,
          }}
        />
        <Button variant="primary" size="sm" onClick={onCreateCategory}>{t('bankStatementAddCategory')}</Button>
      </div>

      {/* ── الجدول ── */}
      <div className="overflow-auto rounded-xl border border-noorix-border" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <table className="w-full text-[12px] min-w-[780px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
              <th className="w-9 p-2.5">
                <label className="nx-checkbox">
                  <input
                    type="checkbox"
                    aria-label={t('bankSelectAll')}
                    checked={allSelected}
                    onChange={toggleAllFiltered}
                  />
                </label>
              </th>
              <th className="p-2.5 text-right">
                <SortBtn label={t('bankStatementDate')} sortKey="txDate" />
              </th>
              <th className="p-2.5 text-right">
                <SortBtn label={t('bankStatementDescription')} sortKey="description" />
              </th>
              <th className="p-2.5 text-right whitespace-nowrap">
                {t('bankStatementCategories')}
              </th>
              <th className="p-2.5 text-right">
                <SortBtn label={t('bankStatementColDebit')} sortKey="debit" />
              </th>
              <th className="p-2.5 text-right">
                <SortBtn label={t('bankStatementColCredit')} sortKey="credit" />
              </th>
              <th className="p-2.5 text-right">
                <SortBtn label={t('bankStatementBalance')} sortKey="balance" />
              </th>
              <th className="p-2.5 text-right whitespace-nowrap">
                {t('bankStatementAddNote')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-noorix-muted p-8">
                  لا توجد عمليات تطابق الفلاتر المحددة.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, rowIdx) => {
                const k = getTxKey(tx);
                const catId = tx.categoryId || '';
                const isDebit = Number(tx.debit) > 0;
                const isCredit = Number(tx.credit) > 0;
                const isSelected = selectedTxIds.has(k);

                return (
                  <tr
                    key={k}
                    style={{
                      borderBottom: '1px solid var(--noorix-border)',
                      background: isSelected
                        ? 'var(--noorix-blue-6)'
                        : rowIdx % 2 === 0
                        ? 'transparent'
                        : 'var(--noorix-bg-muted)',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '8px 10px' }}>
                      <label className="nx-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTxSelection(tx)}
                        />
                      </label>
                    </td>

                    {/* التاريخ */}
                    <td className="py-2 px-2.5 whitespace-nowrap text-noorix-muted text-[11px]">
                      {tx.txDate}
                    </td>

                    {/* الوصف */}
                    <td className="py-2 px-2.5 max-w-[280px]">
                      <div
                        className="overflow-hidden text-[12px] truncate"
                        title={tx.description}
                      >
                        {tx.description}
                      </div>
                    </td>

                    {/* الفئة */}
                    <td className="py-2 px-2.5">
                      {editingTxId === tx.id ? (
                        <div className="flex flex-col gap-1">
                          <Input
                            type="select"
                            value={editingCategory}
                            onChange={(e) => setEditingCategory(e.target.value)}
                          >
                            <option value="">{t('uncategorized')}</option>
                            {allCategoryOptions.map((c) => (
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
                          style={{ textAlign: 'start', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                          onClick={() => {
                            setEditingTxId(tx.id);
                            setEditingCategory(catId);
                          }}
                        >
                          {tx.category?.nameAr || tx.category?.nameEn || t('uncategorized')}
                        </Button>
                      )}
                    </td>

                    {/* السحب */}
                    <td className="py-2 px-2.5 text-right">
                      {isDebit ? (
                        <span className="nx-ltr inline-block font-bold text-noorix-red px-2 py-[2px] rounded-[6px] text-[12px] bg-[var(--noorix-red-7)]">
                          {fmt(Number(tx.debit))}
                        </span>
                      ) : (
                        <span className="text-noorix-muted">—</span>
                      )}
                    </td>

                    {/* الإيداع */}
                    <td className="py-2 px-2.5 text-right">
                      {isCredit ? (
                        <span className="nx-ltr inline-block font-bold text-noorix-green px-2 py-[2px] rounded-[6px] text-[12px] bg-[var(--noorix-green-7)]">
                          {fmt(Number(tx.credit))}
                        </span>
                      ) : (
                        <span className="text-noorix-muted">—</span>
                      )}
                    </td>

                    {/* الرصيد */}
                    <td className="py-2 px-2.5 text-right nx-ltr text-[12px] text-noorix-muted">
                      {tx.balance != null && Number(tx.balance) !== 0 ? fmt(Number(tx.balance)) : '—'}
                    </td>

                    {/* الملاحظة */}
                    <td className="py-2 px-2.5">
                      {editingNoteId === tx.id ? (
                        <div className="flex flex-col gap-1">
                          <Input
                            value={editingNote}
                            onChange={(e) => setEditingNote(e.target.value)}
                            style={{
                              fontSize: 11,
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--noorix-border)',
                              width: 150,
                            }}
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
                          style={{ color: tx.note ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)' }}
                          onClick={() => {
                            setEditingNoteId(tx.id);
                            setEditingNote(tx.note || '');
                          }}
                        >
                          {tx.note ? `${(tx.note || '').slice(0, 20)}…` : '+ ملاحظة'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-noorix-bg-muted font-extrabold border-t-2 border-noorix-border">
              <td colSpan={4} className="p-[10px_12px] text-[12px] text-noorix-muted">
                {t('bankColumnTotalsFiltered')} ({filteredTransactions.length} عملية)
              </td>
              <td className="p-[10px_12px] text-right">
                <span className="nx-ltr inline-block text-noorix-red text-[13px]">
                  {fmt(columnTotals.debit)}
                </span>
              </td>
              <td className="p-[10px_12px] text-right">
                <span className="nx-ltr inline-block text-noorix-green text-[13px]">
                  {fmt(columnTotals.credit)}
                </span>
              </td>
              <td colSpan={2} className="p-[10px_12px] text-right text-[12px]">
                <span
                  className="nx-ltr inline-block font-[800]"
                  style={{ color: columnTotals.credit - columnTotals.debit >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-rose)' }}
                >
                  {columnTotals.credit - columnTotals.debit >= 0 ? '+' : ''}{fmt(columnTotals.credit - columnTotals.debit)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
