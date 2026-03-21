/**
 * BankStatementAnalysisScreen — تحليل كشوف الحساب
 * تبويبات: الكشوفات | دمج كشوفات | قواعد التصنيف | القوالب
 * بطاقات ملخص، رفع ملف، ربط أعمدة، قائمة كشوف، عرض تفصيلي
 */
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  bankStatementsList,
  bankStatementSummary,
  bankStatementUpload,
  bankStatementConfirmMapping,
  bankStatementGet,
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
    if (stmt.status === 'mapping') {
      setMappingStatement(stmt);
    } else {
      setDetailStatement(stmt);
    }
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

  const cards = [
    {
      key: 'count',
      labelKey: 'bankStatementCardCount',
      value: summary?.data?.statementCount ?? 0,
      format: (v) => String(v),
    },
    {
      key: 'totalDeposits',
      labelKey: 'bankStatementCardDeposits',
      value: summary?.data?.totalDeposits ?? 0,
      format: (v) => fmt(Number(v)),
    },
    {
      key: 'totalWithdrawals',
      labelKey: 'bankStatementCardWithdrawals',
      value: summary?.data?.totalWithdrawals ?? 0,
      format: (v) => fmt(Number(v)),
    },
    {
      key: 'netFlow',
      labelKey: 'bankStatementCardNetFlow',
      value: summary?.data?.netFlow ?? 0,
      format: (v) => fmt(Number(v)),
    },
  ];

  const banks = [...new Set(statements.map((s) => s.bankName).filter(Boolean))].sort();
  const months = [...new Set(statements.map((s) => s.startDate?.slice(0, 7)).filter(Boolean))].sort().reverse();

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--noorix-text)' }}>
          {t('reportBankStatementAnalysis')}
        </h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          {t('bankStatementMonthlyDesc')}
        </p>
      </div>

      <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="noorix-tab-bar"
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid var(--noorix-border)',
            flexWrap: 'wrap',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="noorix-btn-nav"
              style={{
                margin: 0,
                borderRadius: 0,
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
                background: activeTab === tab.id ? 'rgba(37,99,235,0.07)' : 'transparent',
                color: activeTab === tab.id ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                padding: '12px 18px',
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {activeTab === 'statements' && (
            <>
              {/* بطاقات الملخص */}
              {!summaryLoading && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {cards.map((c) => (
                    <div
                      key={c.key}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: 'var(--noorix-bg-muted)',
                        border: '1px solid var(--noorix-border)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>
                        {t(c.labelKey)}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--noorix-text)' }}>
                        {c.format(c.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* حالة فارغة */}
              {!listLoading && statements.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 24px',
                    background: 'var(--noorix-bg-muted)',
                    borderRadius: 12,
                    border: '1px dashed var(--noorix-border)',
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>📄</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--noorix-text)', marginBottom: 6 }}>
                    {t('bankStatementEmptyTitle')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)', marginBottom: 16 }}>
                    {t('bankStatementEmptyDesc')}
                  </div>
                  <button
                    type="button"
                    className="noorix-btn noorix-btn--primary"
                    onClick={() => setShowUpload(true)}
                  >
                    {t('bankStatementUploadNew')}
                  </button>
                </div>
              )}

              {/* قائمة الكشوف مع فلاتر */}
              {!listLoading && statements.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--noorix-border)',
                        background: 'var(--noorix-bg)',
                        fontSize: 13,
                        minWidth: 140,
                      }}
                    >
                      <option value="">{t('allMonths')}</option>
                      {months.map((m) => {
                        const [y, mo] = m.split('-');
                        const label = `${AR_MONTHS[parseInt(mo, 10) - 1] || mo} ${y}`;
                        return (
                          <option key={m} value={m}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={filterBank}
                      onChange={(e) => setFilterBank(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--noorix-border)',
                        background: 'var(--noorix-bg)',
                        fontSize: 13,
                        minWidth: 160,
                      }}
                    >
                      <option value="">{t('bankStatementAllBanks')}</option>
                      {banks.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="noorix-btn noorix-btn--primary" onClick={() => setShowUpload(true)}>
                      {t('bankStatementUploadNew')}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    {statements.map((stmt) => {
                      const start = stmt.startDate?.slice(0, 10);
                      const end = stmt.endDate?.slice(0, 10);
                      const statusBadge =
                        stmt.status === 'mapping'
                          ? { bg: 'rgba(234,179,8,0.2)', color: 'rgb(161,98,7)' }
                          : stmt.status === 'completed'
                            ? { bg: 'rgba(34,197,94,0.2)', color: 'rgb(22,101,52)' }
                            : { bg: 'var(--noorix-bg-muted)', color: 'var(--noorix-text-muted)' };
                      return (
                        <div
                          key={stmt.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenDetail(stmt)}
                          onKeyDown={(e) => e.key === 'Enter' && handleOpenDetail(stmt)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: 14,
                            borderRadius: 10,
                            border: '1px solid var(--noorix-border)',
                            background: 'var(--noorix-bg)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: 'var(--noorix-text)' }}>
                                {stmt.companyName || stmt.fileName || 'كشف'}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: statusBadge.bg,
                                  color: statusBadge.color,
                                }}
                              >
                                {stmt.status === 'mapping' ? t('bankStatementStatusMapping') : t('bankStatementStatusCompleted')}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                              {stmt.bankName || '—'} • {start && end ? `${start} – ${end}` : stmt.fileName}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
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
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
              {t('bankStatementMergeComingSoon')}
            </div>
          )}
          {activeTab === 'rules' && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
              {t('bankStatementRulesComingSoon')}
            </div>
          )}
          {activeTab === 'templates' && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
              {t('bankStatementTemplatesComingSoon')}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <BankStatementUploadModal
          companyId={companyId}
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
          importFile={importBankStatementFile}
          showToast={showToast}
        />
      )}

      {mappingStatement && (
        <BankStatementMappingModal
          statement={mappingStatement}
          companyId={companyId}
          categories={categories}
          onClose={handleCloseMapping}
          onConfirm={handleMappingComplete}
          showToast={showToast}
        />
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

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </div>
  );
}
