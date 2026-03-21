/**
 * BankStatementAnalysisScreen — تحليل كشوف الحساب
 * تصميم احترافي: بطاقات ملخص، رفع ملف، ربط أعمدة، قائمة كشوف
 */
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  bankStatementsList,
  bankStatementSummary,
  bankStatementDelete,
  bankStatementCategories,
  bankStatementUpdateTxCategory,
  bankStatementUpdateTxNote,
  bankStatementCreateCategory,
  bankStatementDeleteCategory,
} from '../../services/api';
import { importBankStatementFile } from '../../utils/exportUtils';
import { fmt } from '../../utils/format';
import Toast from '../../components/Toast';
import BankStatementUploadModal from './BankStatementUploadModal';
import BankStatementMappingModal from './BankStatementMappingModal';
import BankStatementDetailModal from './BankStatementDetailModal';
import './bankStatement.css';

const TABS = [
  { id: 'statements', labelKey: 'bankStatementTabStatements' },
  { id: 'merge', labelKey: 'bankStatementTabMerge' },
  { id: 'rules', labelKey: 'bankStatementTabRules' },
  { id: 'templates', labelKey: 'bankStatementTabTemplates' },
];

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function BankStatementAnalysisScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const companyId = activeCompanyId ?? '';

  const [activeTab, setActiveTab] = useState('statements');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [showUpload, setShowUpload] = useState(false);
  const [mappingStatement, setMappingStatement] = useState(null);
  const [detailStatement, setDetailStatement] = useState(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBank, setFilterBank] = useState('');

  const showToast = (message, type = 'success') => setToast({ visible: true, message, type });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['bank-statements-summary', companyId],
    queryFn: () => bankStatementSummary(companyId),
    enabled: !!companyId,
  });

  const { data: statements = [], isLoading: listLoading } = useQuery({
    queryKey: ['bank-statements', companyId, filterMonth, filterBank],
    queryFn: async () => {
      const res = await bankStatementsList(companyId, {
        month: filterMonth || undefined,
        bankName: filterBank || undefined,
      });
      return res?.data ?? [];
    },
    enabled: !!companyId && activeTab === 'statements',
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['bank-statement-categories', companyId],
    queryFn: async () => {
      const res = await bankStatementCategories(companyId);
      return res?.data ?? [];
    },
    enabled: !!companyId,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
    queryClient.invalidateQueries({ queryKey: ['bank-statements-summary'] });
    queryClient.invalidateQueries({ queryKey: ['bank-statement-categories'] });
  }, [queryClient]);

  const handleUploadComplete = (stmt, fullRaw) => {
    setShowUpload(false);
    invalidate();
    if (stmt?.status === 'mapping') setMappingStatement({ ...stmt, _fullRaw: fullRaw });
    else setDetailStatement(stmt);
  };

  const handleMappingComplete = () => {
    setMappingStatement(null);
    invalidate();
    showToast(t('bankStatementParsedCount', String(0)));
  };

  const handleCloseMapping = () => setMappingStatement(null);
  const handleOpenDetail = (stmt) => {
    if (stmt.status === 'mapping') setMappingStatement(stmt);
    else setDetailStatement(stmt);
  };
  const handleCloseDetail = () => setDetailStatement(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => bankStatementDelete(companyId, id),
    onSuccess: () => {
      invalidate();
      handleCloseDetail();
      showToast(t('deletedSuccessfully') || 'تم الحذف');
    },
    onError: (err) => showToast(err?.message || 'فشل الحذف', 'error'),
  });

  const netFlow = Number(summary?.data?.netFlow ?? 0);
  const cards = [
    { key: 'count', labelKey: 'bankStatementCardCount', value: summary?.data?.statementCount ?? 0, format: (v) => String(v), accent: null },
    { key: 'totalDeposits', labelKey: 'bankStatementCardDeposits', value: summary?.data?.totalDeposits ?? 0, format: (v) => fmt(Number(v)), accent: 'positive' },
    { key: 'totalWithdrawals', labelKey: 'bankStatementCardWithdrawals', value: summary?.data?.totalWithdrawals ?? 0, format: (v) => fmt(Number(v)), accent: 'negative' },
    { key: 'netFlow', labelKey: 'bankStatementCardNetFlow', value: summary?.data?.netFlow ?? 0, format: (v) => fmt(Number(v)), accent: netFlow >= 0 ? 'positive' : 'negative' },
  ];

  const banks = [...new Set(statements.map((s) => s.bankName).filter(Boolean))].sort();
  const months = [...new Set(statements.map((s) => s.startDate?.slice(0, 7)).filter(Boolean))].sort().reverse();

  return (
    <div className="bank-statement" style={{ display: 'grid', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--noorix-text)', letterSpacing: '-0.02em' }}>
          {t('reportBankStatementAnalysis')}
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--noorix-text-muted)', lineHeight: 1.5 }}>
          {t('bankStatementMonthlyDesc')}
        </p>
      </div>

      <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="noorix-btn-nav"
              style={{
                margin: 0,
                borderRadius: 0,
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid var(--noorix-accent-blue)' : '3px solid transparent',
                background: activeTab === tab.id ? 'rgba(37,99,235,0.06)' : 'transparent',
                color: activeTab === tab.id ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                padding: '14px 22px',
                fontSize: 14,
                transition: 'all 0.2s ease',
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div style={{ padding: 28 }}>
          {activeTab === 'statements' && (
            <>
              {!summaryLoading && (
                <div className="bank-statement__summary-grid" style={{ marginBottom: 28 }}>
                  {cards.map((c) => (
                    <div
                      key={c.key}
                      className={`bank-statement__card ${c.key === 'totalDeposits' ? 'bank-statement__card--deposits' : ''} ${c.key === 'totalWithdrawals' ? 'bank-statement__card--withdrawals' : ''} ${c.key === 'netFlow' ? 'bank-statement__card--net' : ''}`}
                    >
                      <div className="bank-statement__card-label">{t(c.labelKey)}</div>
                      <div
                        className={`bank-statement__card-value ${c.accent === 'positive' ? 'bank-statement__card-value--positive' : ''} ${c.accent === 'negative' ? 'bank-statement__card-value--negative' : ''}`}
                      >
                        {c.format(c.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!listLoading && statements.length === 0 && (
                <div className="bank-statement__empty">
                  <div className="bank-statement__empty-icon">📄</div>
                  <div className="bank-statement__empty-title">{t('bankStatementEmptyTitle')}</div>
                  <div className="bank-statement__empty-desc">{t('bankStatementEmptyDesc')}</div>
                  <button type="button" className="noorix-btn noorix-btn--primary" style={{ padding: '12px 24px', fontSize: 15, fontWeight: 600 }} onClick={() => setShowUpload(true)}>
                    {t('bankStatementUploadNew')}
                  </button>
                </div>
              )}

              {!listLoading && statements.length > 0 && (
                <>
                  <div className="bank-statement__filters" style={{ marginBottom: 20 }}>
                    <select className="bank-statement__filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                      <option value="">{t('allMonths')}</option>
                      {months.map((m) => {
                        const [y, mo] = m.split('-');
                        const label = `${AR_MONTHS[parseInt(mo, 10) - 1] || mo} ${y}`;
                        return <option key={m} value={m}>{label}</option>;
                      })}
                    </select>
                    <select className="bank-statement__filter-select" value={filterBank} onChange={(e) => setFilterBank(e.target.value)}>
                      <option value="">{t('bankStatementAllBanks')}</option>
                      {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <button type="button" className="noorix-btn noorix-btn--primary" style={{ marginInlineStart: 'auto' }} onClick={() => setShowUpload(true)}>
                      {t('bankStatementUploadNew')}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    {statements.map((stmt) => {
                      const start = stmt.startDate?.slice(0, 10);
                      const end = stmt.endDate?.slice(0, 10);
                      return (
                        <div
                          key={stmt.id}
                          role="button"
                          tabIndex={0}
                          className="bank-statement__item"
                          onClick={() => handleOpenDetail(stmt)}
                          onKeyDown={(e) => e.key === 'Enter' && handleOpenDetail(stmt)}
                        >
                          <div className="bank-statement__item-icon">📑</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--noorix-text)' }}>
                                {stmt.companyName || stmt.fileName || 'كشف'}
                              </span>
                              <span className={`bank-statement__badge ${stmt.status === 'mapping' ? 'bank-statement__badge--mapping' : 'bank-statement__badge--completed'}`}>
                                {stmt.status === 'mapping' ? t('bankStatementStatusMapping') : t('bankStatementStatusCompleted')}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>
                              {stmt.bankName || '—'} • {start && end ? `${start} – ${end}` : stmt.fileName}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)', fontWeight: 500 }}>
                            {stmt.transactionCount ?? 0} {t('bankStatementTransactions')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'merge' && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
              {t('bankStatementMergeComingSoon')}
            </div>
          )}
          {activeTab === 'rules' && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
              {t('bankStatementRulesComingSoon')}
            </div>
          )}
          {activeTab === 'templates' && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
              {t('bankStatementTemplatesComingSoon')}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <BankStatementUploadModal companyId={companyId} onClose={() => setShowUpload(false)} onComplete={handleUploadComplete} importFile={importBankStatementFile} showToast={showToast} />
      )}
      {mappingStatement && (
        <BankStatementMappingModal statement={mappingStatement} companyId={companyId} categories={categories} onClose={handleCloseMapping} onConfirm={handleMappingComplete} showToast={showToast} />
      )}
      {detailStatement && (
        <BankStatementDetailModal
          statement={detailStatement}
          companyId={companyId}
          categories={categories}
          onClose={handleCloseDetail}
          onRefresh={invalidate}
          onDelete={() => deleteMutation.mutate(detailStatement.id)}
          onUpdateCategory={bankStatementUpdateTxCategory}
          onUpdateNote={bankStatementUpdateTxNote}
          createCategory={(body) => bankStatementCreateCategory({ ...body, companyId })}
          deleteCategory={(id) => bankStatementDeleteCategory(companyId, id)}
          showToast={showToast}
        />
      )}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onClose={() => setToast((p) => ({ ...p, visible: false }))} />
    </div>
  );
}
