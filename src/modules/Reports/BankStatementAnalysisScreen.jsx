/**
 * BankStatementAnalysisScreen — تحليل كشوف الحساب (واجهة كاملة مكيّفة من المشروع السابق)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  bankStatementsList,
  bankStatementSummary,
  bankStatementDelete,
  bankStatementCategories,
  bankStatementCreateCategory,
} from '../../services/api';
import { importBankStatementFile } from '../../utils/exportUtils';
import { fmt } from '../../utils/format';
import Toast from '../../components/Toast';
import BankStatementUploadModal from './BankStatementUploadModal';
import BankStatementMappingModal from './BankStatementMappingModal';
import BankStatementDetailView from './bank/BankStatementDetailView';
import BankStatementTemplatesPanel from './bank/BankStatementTemplatesPanel';
import BankCategoryTreePanel from './bank/BankCategoryTreePanel';

const TABS = [
  { id: 'statements', labelKey: 'bankStatementTabStatements' },
  { id: 'rules', labelKey: 'bankStatementTabRules' },
  { id: 'templates', labelKey: 'bankStatementTabTemplates' },
];

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function BankStatementAnalysisScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const companyId = activeCompanyId ?? '';

  const activeCompanyName = useMemo(() => {
    const c = (companies || []).find((x) => x.id === companyId);
    return c?.nameAr || c?.nameEn || c?.name || '';
  }, [companies, companyId]);

  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [activeTab, setActiveTab] = useState('statements');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [showUpload, setShowUpload] = useState(false);
  const [mappingStatement, setMappingStatement] = useState(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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
    enabled: !!companyId && (activeTab === 'statements' || !selectedStatementId),
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
    queryClient.invalidateQueries({ queryKey: ['bank-statement'] });
  }, [queryClient]);

  const handleUploadComplete = (stmt, fullRaw) => {
    setShowUpload(false);
    invalidate();
    if (stmt?.status === 'mapping') setMappingStatement({ ...stmt, _fullRaw: fullRaw });
    else {
      setSelectedStatementId(stmt.id);
    }
  };

  const handleMappingComplete = () => {
    setMappingStatement(null);
    invalidate();
    showToast(t('bankStatementParsedCount', '0'));
  };

  const handleSelectStatement = (stmt) => {
    if (stmt.status === 'mapping') {
      setMappingStatement(stmt);
      return;
    }
    setSelectedStatementId(stmt.id);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => bankStatementDelete(companyId, id),
    onSuccess: () => {
      invalidate();
      setDeleteConfirmId(null);
      setSelectedStatementId(null);
      showToast(t('deletedSuccessfully') || 'تم الحذف');
    },
    onError: (err) => showToast(err?.message || 'فشل الحذف', 'error'),
  });

  const completedStatements = useMemo(
    () => statements.filter((s) => s.status === 'completed'),
    [statements],
  );

  const quickStats = useMemo(() => {
    const dep = completedStatements.reduce((s, x) => s + (Number(x.totalDeposits) || 0), 0);
    const wdr = completedStatements.reduce((s, x) => s + (Number(x.totalWithdrawals) || 0), 0);
    return { totalDeposits: dep, totalWithdrawals: wdr, netFlow: dep - wdr };
  }, [completedStatements]);

  const banks = [...new Set(statements.map((s) => s.bankName).filter(Boolean))].sort();
  const months = [...new Set(statements.map((s) => s.startDate?.slice(0, 7)).filter(Boolean))].sort().reverse();

  if (selectedStatementId) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <BankStatementDetailView
          statementId={selectedStatementId}
          companyId={companyId}
          companyName={activeCompanyName}
          categories={categories}
          onBack={() => setSelectedStatementId(null)}
          onDelete={() => setDeleteConfirmId(selectedStatementId)}
          createCategory={(body) => bankStatementCreateCategory({ ...body, companyId })}
          showToast={showToast}
          onRefresh={invalidate}
        />

        {deleteConfirmId ? (
          <div
            className="noorix-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => e.target === e.currentTarget && setDeleteConfirmId(null)}
          >
            <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 400, width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{t('confirmDelete')}</h3>
              <p style={{ color: 'var(--noorix-text-muted)', fontSize: 14 }}>{t('bankDeleteStatementConfirm')}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="noorix-btn noorix-btn--ghost" onClick={() => setDeleteConfirmId(null)}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="noorix-btn noorix-btn--primary"
                  style={{ background: '#dc2626' }}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteConfirmId)}
                >
                  {deleteMutation.isPending ? t('loading') : t('delete')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((p) => ({ ...p, visible: false }))}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--noorix-text)' }}>
            {t('reportBankStatementAnalysis')}
          </h1>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankStatementMonthlyDesc')}</p>
        </div>
        <button type="button" className="noorix-btn noorix-btn--primary noorix-bank-cta" onClick={() => setShowUpload(true)}>
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1, opacity: 0.95 }}>＋</span>
          {t('bankStatementUploadNew')}
        </button>
      </div>

      {completedStatements.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {[
            { label: t('bankStatementCardCount'), value: String(completedStatements.length), tone: 'blue' },
            { label: t('bankStatementCardDeposits'), value: fmt(quickStats.totalDeposits), tone: 'green' },
            { label: t('bankStatementCardWithdrawals'), value: fmt(quickStats.totalWithdrawals), tone: 'red' },
            {
              label: t('bankStatementCardNetFlow'),
              value: fmt(quickStats.netFlow),
              tone: quickStats.netFlow >= 0 ? 'green' : 'red',
            },
          ].map((c, i) => (
            <div
              key={i}
              className="noorix-surface-card"
              style={{
                padding: 14,
                borderLeft: `4px solid ${
                  c.tone === 'blue' ? '#2563eb' : c.tone === 'green' ? '#16a34a' : '#dc2626'
                }`,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, direction: 'ltr', textAlign: 'right' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="noorix-bank-tab-row" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`noorix-bank-tab${activeTab === tab.id ? ' noorix-bank-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {activeTab === 'statements' && (
            <>
              {!summaryLoading && statements.length > 0 && completedStatements.length === 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {[
                    { key: 'count', labelKey: 'bankStatementCardCount', value: summary?.data?.statementCount ?? 0, f: (v) => String(v) },
                    { key: 'dep', labelKey: 'bankStatementCardDeposits', value: summary?.data?.totalDeposits ?? 0, f: (v) => fmt(Number(v)) },
                    { key: 'wdr', labelKey: 'bankStatementCardWithdrawals', value: summary?.data?.totalWithdrawals ?? 0, f: (v) => fmt(Number(v)) },
                    { key: 'net', labelKey: 'bankStatementCardNetFlow', value: summary?.data?.netFlow ?? 0, f: (v) => fmt(Number(v)) },
                  ].map((c) => (
                    <div
                      key={c.key}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: 'var(--noorix-bg-muted)',
                        border: '1px solid var(--noorix-border)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t(c.labelKey)}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{c.f(c.value)}</div>
                    </div>
                  ))}
                </div>
              )}

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
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{t('bankStatementEmptyTitle')}</div>
                  <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)', marginBottom: 16 }}>{t('bankStatementEmptyDesc')}</div>
                  <button type="button" className="noorix-btn noorix-btn--primary noorix-bank-cta" onClick={() => setShowUpload(true)}>
                    <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
                    {t('bankStatementUploadNew')}
                  </button>
                </div>
              )}

              {!listLoading && statements.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="noorix-bank-filter"
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
                      className="noorix-bank-filter"
                      style={{ minWidth: 170 }}
                    >
                      <option value="">{t('bankStatementAllBanks')}</option>
                      {banks.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
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
                          onClick={() => handleSelectStatement(stmt)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSelectStatement(stmt)}
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
                              <span style={{ fontWeight: 600 }}>{stmt.companyName || stmt.fileName || 'كشف'}</span>
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

          {activeTab === 'rules' && (
            <BankCategoryTreePanel companyId={companyId} companies={companies} showToast={showToast} />
          )}
          {activeTab === 'templates' && (
            <BankStatementTemplatesPanel companyId={companyId} showToast={showToast} />
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
          onClose={() => setMappingStatement(null)}
          onConfirm={handleMappingComplete}
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
