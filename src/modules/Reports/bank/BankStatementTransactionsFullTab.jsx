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
          <span style={{ color: 'var(--noorix-text-muted)' }}>النتائج:</span>
          <span style={{ fontWeight: 700 }}>{filteredTransactions.length}</span>
          <span style={{ color: 'var(--noorix-text-muted)' }}>عملية</span>
          {selectedTxIds.size > 0 && (
            <span
              style={{
                background: 'var(--noorix-accent-blue)',
                color: '#fff',
                borderRadius: 12,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 780 }}>
          <thead>
            <tr
              className="bg-noorix-bg-muted"
              style={{
                borderBottom: '2px solid var(--noorix-border)',
              }}
            >
              <th style={{ width: 36, padding: '10px 10px' }}>
                <label className="nx-checkbox">
                  <input
                    type="checkbox"
                    aria-label={t('bankSelectAll')}
                    checked={allSelected}
                    onChange={toggleAllFiltered}
                  />
                </label>
              </th>
              <th style={{ padding: '10px 10px', textAlign: 'right' }}>
                <SortBtn label={t('bankStatementDate')} sortKey="txDate" />
              </th>
              <th style={{ padding: '10px 10px', textAlign: 'right' }}>
                <SortBtn label={t('bankStatementDescription')} sortKey="description" />
              </th>
              <th style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {t('bankStatementCategories')}
              </th>
              <th style={{ padding: '10px 10px', textAlign: 'right' }}>
                <SortBtn label={t('bankStatementColDebit')} sortKey="debit" />
              </th>
              <th style={{ padding: '10px 10px', textAlign: 'right' }}>
                <SortBtn label={t('bankStatementColCredit')} sortKey="credit" />
              </th>
              <th style={{ padding: '10px 10px', textAlign: 'right' }}>
                <SortBtn label={t('bankStatementBalance')} sortKey="balance" />
              </th>
              <th style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {t('bankStatementAddNote')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-noorix-muted" style={{ padding: 32 }}>
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
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--noorix-text-muted)', fontSize: 11 }}>
                      {tx.txDate}
                    </td>

                    {/* الوصف */}
                    <td style={{ padding: '8px 10px', maxWidth: 280 }}>
                      <div
                        className="overflow-hidden text-[12px]"
                        style={{
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={tx.description}
                      >
                        {tx.description}
                      </div>
                    </td>

                    {/* الفئة */}
                    <td style={{ padding: '8px 10px' }}>
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
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {isDebit ? (
                        <span
                          style={{
                            direction: 'ltr',
                            display: 'inline-block',
                            fontWeight: 700,
                            color: 'var(--noorix-accent-red)',
                            background: 'var(--noorix-red-7)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 12,
                          }}
                        >
                          {fmt(Number(tx.debit))}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--noorix-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* الإيداع */}
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {isCredit ? (
                        <span
                          style={{
                            direction: 'ltr',
                            display: 'inline-block',
                            fontWeight: 700,
                            color: 'var(--noorix-accent-green)',
                            background: 'var(--noorix-green-7)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 12,
                          }}
                        >
                          {fmt(Number(tx.credit))}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--noorix-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* الرصيد */}
                    <td style={{ padding: '8px 10px', textAlign: 'right', direction: 'ltr', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                      {tx.balance != null && Number(tx.balance) !== 0 ? fmt(Number(tx.balance)) : '—'}
                    </td>

                    {/* الملاحظة */}
                    <td style={{ padding: '8px 10px' }}>
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
            <tr
              className="bg-noorix-bg-muted font-extrabold"
              style={{
                borderTop: '2px solid var(--noorix-border)',
              }}
            >
              <td colSpan={4} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                {t('bankColumnTotalsFiltered')} ({filteredTransactions.length} عملية)
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                <span style={{ color: 'var(--noorix-accent-red)', direction: 'ltr', display: 'inline-block', fontSize: 13 }}>
                  {fmt(columnTotals.debit)}
                </span>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                <span style={{ color: 'var(--noorix-accent-green)', direction: 'ltr', display: 'inline-block', fontSize: 13 }}>
                  {fmt(columnTotals.credit)}
                </span>
              </td>
              <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12 }}>
                <span
                  style={{
                    color: columnTotals.credit - columnTotals.debit >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-rose)',
                    fontWeight: 800,
                    direction: 'ltr',
                    display: 'inline-block',
                  }}
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
