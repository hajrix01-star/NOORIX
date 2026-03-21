/**
 * BankStatementDetailModal — عرض تفصيلي للكشف مع العمليات والفئات
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { bankStatementGet } from '../../services/api';
import { fmt } from '../../utils/format';
import './bankStatement.css';

export default function BankStatementDetailModal({
  statement,
  companyId,
  categories,
  onClose,
  onRefresh,
  onDelete,
  onUpdateCategory,
  onUpdateNote,
  createCategory,
  deleteCategory,
  showToast,
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('transactions');
  const [editingNote, setEditingNote] = useState(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const { data: fullStatement, isLoading } = useQuery({
    queryKey: ['bank-statement', companyId, statement?.id],
    queryFn: () => bankStatementGet(companyId, statement.id),
    enabled: !!statement?.id && !!companyId,
  });

  const stmt = fullStatement?.data ?? fullStatement ?? statement;
  const transactions = stmt?.transactions ?? [];

  const byCategory = transactions.reduce((acc, tx) => {
    const catId = tx.categoryId ?? '_uncat';
    const catName = tx.category?.nameAr || tx.category?.nameEn || t('uncategorized');
    if (!acc[catName]) acc[catName] = { debit: 0, credit: 0, count: 0 };
    acc[catName].debit += Number(tx.debit) || 0;
    acc[catName].credit += Number(tx.credit) || 0;
    acc[catName].count += 1;
    return acc;
  }, {});

  const handleCategoryChange = async (txId, categoryId) => {
    try {
      await onUpdateCategory(stmt.id, txId, companyId, categoryId);
      onRefresh();
      showToast(t('savedSuccessfully') || 'تم الحفظ');
    } catch (err) {
      showToast(err?.message || 'فشل', 'error');
    }
  };

  const handleNoteSave = async (txId) => {
    try {
      await onUpdateNote(stmt.id, txId, companyId, editingNoteValue);
      setEditingNote(null);
      setEditingNoteValue('');
      onRefresh();
      showToast(t('savedSuccessfully') || 'تم الحفظ');
    } catch (err) {
      showToast(err?.message || 'فشل', 'error');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory({ nameAr: newCategoryName.trim(), nameEn: newCategoryName.trim() });
      setNewCategoryName('');
      onRefresh();
      showToast(t('savedSuccessfully') || 'تم إضافة الفئة');
    } catch (err) {
      showToast(err?.message || 'فشل', 'error');
    }
  };

  return (
    <div
      className="noorix-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div className="noorix-surface-card bank-statement__detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bank-statement__modal-header" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {stmt?.companyName || stmt?.fileName || 'كشف'} — {stmt?.bankName || '—'}
              </h2>
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
                {stmt?.startDate?.slice(0, 10)} – {stmt?.endDate?.slice(0, 10)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose}>
                {t('close')}
              </button>
              <button
                type="button"
                className="noorix-btn"
                style={{ color: 'var(--noorix-error)' }}
                onClick={() => {
                  if (confirm(t('confirmDelete') || 'هل تريد حذف هذا الكشف؟')) onDelete();
                }}
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>

        <div className="bank-statement__detail-tabs">
          {['transactions', 'analysis'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`bank-statement__detail-tab ${activeTab === tab ? 'bank-statement__detail-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'transactions' ? t('bankStatementTransactions') : t('bankStatementByCategory')}
            </button>
          ))}
        </div>

        <div className="bank-statement__detail-content">
          {isLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
              {t('loading') || 'جاري التحميل...'}
            </div>
          )}

          {!isLoading && activeTab === 'transactions' && (
            <div style={{ overflow: 'auto' }}>
              <table className="bank-statement__tx-table">
                <thead>
                  <tr>
                    <th>{t('bankStatementDate')}</th>
                    <th>{t('bankStatementDescription')}</th>
                    <th>{t('bankStatementCategories')}</th>
                    <th style={{ textAlign: 'end' }}>{t('bankStatementColDebit')}</th>
                    <th style={{ textAlign: 'end' }}>{t('bankStatementColCredit')}</th>
                    <th style={{ textAlign: 'end' }}>{t('bankStatementBalance')}</th>
                    <th>{t('note') || 'ملاحظة'}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ padding: 10 }}>{tx.txDate?.slice(0, 10)}</td>
                      <td style={{ padding: 10, maxWidth: 200 }}>{tx.description}</td>
                      <td style={{ padding: 10 }}>
                        <select
                          value={tx.categoryId ?? ''}
                          onChange={(e) => handleCategoryChange(tx.id, e.target.value || null)}
                          style={{ minWidth: 120, padding: '4px 8px' }}
                        >
                          <option value="">{t('uncategorized')}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameAr || c.nameEn}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 10, textAlign: 'end', color: Number(tx.debit) ? 'var(--noorix-error)' : undefined }}>
                        {Number(tx.debit) ? fmt(tx.debit) : '—'}
                      </td>
                      <td style={{ padding: 10, textAlign: 'end', color: Number(tx.credit) ? 'var(--noorix-success)' : undefined }}>
                        {Number(tx.credit) ? fmt(tx.credit) : '—'}
                      </td>
                      <td style={{ padding: 10, textAlign: 'end' }}>{tx.balance != null ? fmt(tx.balance) : '—'}</td>
                      <td style={{ padding: 10 }}>
                        {editingNote === tx.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={editingNoteValue}
                              onChange={(e) => setEditingNoteValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleNoteSave(tx.id);
                                if (e.key === 'Escape') setEditingNote(null);
                              }}
                              style={{ flex: 1, padding: 4 }}
                              autoFocus
                            />
                            <button type="button" className="noorix-btn noorix-btn--sm" onClick={() => handleNoteSave(tx.id)}>
                              ✓
                            </button>
                            <button type="button" className="noorix-btn noorix-btn--sm" onClick={() => { setEditingNote(null); setEditingNoteValue(''); }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="noorix-btn noorix-btn--ghost noorix-btn--sm"
                            onClick={() => {
                              setEditingNote(tx.id);
                              setEditingNoteValue(tx.note ?? '');
                            }}
                          >
                            {tx.note || (t('bankStatementAddNote') || 'إضافة ملاحظة')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
                  {t('bankStatementNoTransactions')}
                </div>
              )}
            </div>
          )}

          {!isLoading && activeTab === 'analysis' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t('bankStatementCategoryName')}
                  style={{ flex: 1, padding: '8px 12px' }}
                />
                <button type="button" className="noorix-btn noorix-btn--primary" onClick={handleCreateCategory}>
                  {t('bankStatementAddCategory')}
                </button>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {Object.entries(byCategory).map(([name, data]) => (
                  <div key={name} className="bank-statement__category-row">
                    <div style={{ flex: 1, fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{data.count} حركة</div>
                    <div style={{ color: 'var(--noorix-error)' }}>{fmt(data.debit)}</div>
                    <div style={{ color: 'var(--noorix-success)' }}>{fmt(data.credit)}</div>
                  </div>
                ))}
              </div>
              {Object.keys(byCategory).length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
                  {t('bankStatementNoCategories')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
