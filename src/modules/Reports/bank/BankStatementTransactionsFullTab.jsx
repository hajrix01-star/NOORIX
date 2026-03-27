/**
 * جدول العمليات الكامل — فرز، تصفية، تصنيف، ملاحظات
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { getTxKey } from './bankAnalysisUtils';

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

  const th = (key, sortKey) => (
    <th>
      <button
        type="button"
        className="noorix-btn noorix-btn--ghost"
        style={{ fontWeight: 700, fontSize: 12, padding: '4px 6px' }}
        onClick={() => handleSort(sortKey)}
      >
        {t(key)}
        {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input
          type="search"
          placeholder={t('bankSearchTransactions')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: '1 1 200px',
            minWidth: 160,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg)',
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg)',
          }}
        >
          <option value="all">{t('bankFilterAllCategories')}</option>
          {categoryNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg)',
          }}
        >
          <option value="all">{t('bankTypeAll')}</option>
          <option value="debit">{t('bankTypeWithdrawals')}</option>
          <option value="credit">{t('bankTypeDeposits')}</option>
        </select>
        <button type="button" className="noorix-btn noorix-btn--secondary" onClick={toggleAllFiltered}>
          {t('bankToggleSelectFiltered')}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13 }}>{t('bankStatementAddCategory')}:</span>
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder={t('bankStatementCategoryName')}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--noorix-border)',
            width: 180,
          }}
        />
        <button type="button" className="noorix-btn noorix-btn--primary" onClick={onCreateCategory}>
          {t('bankStatementAddCategory')}
        </button>
      </div>

      <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
        <table className="noorix-table" style={{ width: '100%', fontSize: 12, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  aria-label={t('bankSelectAll')}
                  checked={
                    filteredTransactions.length > 0 &&
                    filteredTransactions.every((tx) => selectedTxIds.has(getTxKey(tx)))
                  }
                  onChange={toggleAllFiltered}
                />
              </th>
              {th('bankStatementDate', 'txDate')}
              {th('bankStatementDescription', 'description')}
              <th>{t('bankStatementCategories')}</th>
              {th('bankStatementColDebit', 'debit')}
              {th('bankStatementColCredit', 'credit')}
              {th('bankStatementBalance', 'balance')}
              <th>{t('bankStatementAddNote')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => {
              const k = getTxKey(tx);
              const catId = tx.categoryId || '';
              return (
                <tr key={k}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedTxIds.has(k)}
                      onChange={() => toggleTxSelection(tx)}
                    />
                  </td>
                  <td>{tx.txDate}</td>
                  <td style={{ maxWidth: 280, whiteSpace: 'pre-wrap' }}>{tx.description}</td>
                  <td>
                    {editingTxId === tx.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <select
                          value={editingCategory}
                          onChange={(e) => setEditingCategory(e.target.value)}
                          style={{ fontSize: 11, maxWidth: 160 }}
                        >
                          <option value="">{t('uncategorized')}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameAr || c.nameEn}
                            </option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="noorix-btn noorix-btn--primary"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            disabled={updateCategoryMutation.isPending}
                            onClick={() =>
                              handleCategoryChange(tx.id, editingCategory || null)
                            }
                          >
                            {t('save')}
                          </button>
                          <button
                            type="button"
                            className="noorix-btn noorix-btn--ghost"
                            style={{ fontSize: 11 }}
                            onClick={() => setEditingTxId(null)}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="noorix-btn noorix-btn--ghost"
                        style={{ fontSize: 11, textAlign: 'start' }}
                        onClick={() => {
                          setEditingTxId(tx.id);
                          setEditingCategory(catId);
                        }}
                      >
                        {tx.category?.nameAr || tx.category?.nameEn || t('uncategorized')}
                      </button>
                    )}
                  </td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{fmt(Number(tx.debit) || 0)}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{fmt(Number(tx.credit) || 0)}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>
                    {tx.balance != null ? fmt(Number(tx.balance)) : '—'}
                  </td>
                  <td>
                    {editingNoteId === tx.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input
                          value={editingNote}
                          onChange={(e) => setEditingNote(e.target.value)}
                          style={{ fontSize: 11, padding: 4 }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="noorix-btn noorix-btn--primary"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            disabled={updateNoteMutation.isPending}
                            onClick={() => handleNoteChange(tx.id)}
                          >
                            {t('save')}
                          </button>
                          <button
                            type="button"
                            className="noorix-btn noorix-btn--ghost"
                            style={{ fontSize: 11 }}
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNote('');
                            }}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="noorix-btn noorix-btn--ghost"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          setEditingNoteId(tx.id);
                          setEditingNote(tx.note || '');
                        }}
                      >
                        {tx.note ? `${(tx.note || '').slice(0, 24)}…` : '+'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4}>{t('bankColumnTotalsFiltered')}</th>
              <th style={{ direction: 'ltr', textAlign: 'right' }}>{fmt(columnTotals.debit)}</th>
              <th style={{ direction: 'ltr', textAlign: 'right' }}>{fmt(columnTotals.credit)}</th>
              <th colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
