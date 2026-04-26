/**
 * BankStatementAnalysisScreen — تحليل كشوف الحساب (واجهة كاملة مكيّفة من المشروع السابق)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
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
import { Button, Badge, Modal, Input, ScreenShell, ScreenTitle, ScreenTabs, MetricCard, cn } from '../../ui';
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
const BANK_STATEMENT_TAB_IDS = TABS.map((tab: any) => tab.id);

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function BankStatementAnalysisScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const companyId = activeCompanyId ?? '';

  const activeCompanyName = useMemo(() => {
    const c = (companies || []).find((x: any) => x.id === companyId);
    return c?.nameAr || c?.nameEn || c?.name || '';
  }, [companies, companyId]);

  const [selectedStatementId, setSelectedStatementId] = useState<any>(null);
  const [activeTab, setActiveTab] = useTabSearchParam(BANK_STATEMENT_TAB_IDS, 'statements');
  const [showUpload, setShowUpload] = useState(false);
  const [mappingStatement, setMappingStatement] = useState<any>(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<any>(null);

  const { showToast } = useToast();

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

  const handleUploadComplete = (stmt: any, fullRaw: any) => {
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

  const handleSelectStatement = (stmt: any) => {
    if (stmt.status === 'mapping') {
      setMappingStatement(stmt);
      return;
    }
    setSelectedStatementId(stmt.id);
  };

  const deleteMutation = useApiMutation({
    mutationFn: (id: any) => bankStatementDelete(companyId, id),
    successToast: () => t('deletedSuccessfully'),
    errorToast: (err: any) => err?.message || t('saveFailedGeneric'),
    onSuccess: () => {
      invalidate();
      setDeleteConfirmId(null);
      setSelectedStatementId(null);
    },
  });

  const completedStatements = useMemo(
    () => statements.filter((s: any) => s.status === 'completed'),
    [statements],
  );

  const quickStats = useMemo(() => {
    const dep = completedStatements.reduce((s: any, x: any) => s + (Number(x.totalDeposits) || 0), 0);
    const wdr = completedStatements.reduce((s: any, x: any) => s + (Number(x.totalWithdrawals) || 0), 0);
    return { totalDeposits: dep, totalWithdrawals: wdr, netFlow: dep - wdr };
  }, [completedStatements]);

  const banks = [...new Set(statements.map((s: any) => s.bankName).filter(Boolean))].sort() as string[];
  const months = [...new Set(statements.map((s: any) => s.startDate?.slice(0, 7)).filter(Boolean))].sort().reverse() as string[];

  if (selectedStatementId) {
    return (
      <ScreenShell>
        <BankStatementDetailView
          statementId={selectedStatementId}
          companyId={companyId}
          companyName={activeCompanyName}
          categories={categories}
          onBack={() => setSelectedStatementId(null)}
          onDelete={() => setDeleteConfirmId(selectedStatementId)}
          createCategory={(body: any) => bankStatementCreateCategory({ ...body, companyId })}
          showToast={showToast}
          onRefresh={invalidate}
        />

        <Modal
          open={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          title={t('confirmDelete')}
          size="sm"
          variant="danger"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>{t('cancel')}</Button>
              <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteConfirmId)}>
                {deleteMutation.isPending ? t('loading') : t('delete')}
              </Button>
            </>
          }
        >
          <p className="text-noorix-muted text-[14px]">{t('bankDeleteStatementConfirm')}</p>
        </Modal>

      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <div className="nx-page-header">
        <ScreenTitle>{t('reportBankStatementAnalysis')}</ScreenTitle>
        <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
          <span aria-hidden className="text-[18px] leading-none opacity-[0.95]">＋</span>
          {t('bankStatementUploadNew')}
        </Button>
      </div>

      {completedStatements.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {[
            { label: t('bankStatementCardCount'),       value: String(completedStatements.length),    color: 'var(--color-nx-sales)'      },
            { label: t('bankStatementCardDeposits'),    value: fmt(quickStats.totalDeposits),   color: 'var(--color-nx-profit)'   },
            { label: t('bankStatementCardWithdrawals'), value: fmt(quickStats.totalWithdrawals), color: 'var(--color-nx-expenses)' },
            { label: t('bankStatementCardNetFlow'),     value: fmt(quickStats.netFlow),          color: quickStats.netFlow >= 0 ? 'var(--color-nx-profit)' : 'var(--color-nx-expenses)' },
          ].map((c: any, i: any) => (
            <MetricCard key={i} color={c.color}>
              <MetricCard.Header label={c.label} />
              <MetricCard.Value value={c.value} />
            </MetricCard>
          ))}
        </div>
      )}

        <div className="noorix-surface-card p-0 overflow-hidden">
        <ScreenTabs
          omitDefaultBarClasses
          fadeWrap={false}
          variant="underline"
          barClassName="noorix-bank-tab-row"
          getTabClassName={(_: any, active: any) => cn('noorix-bank-tab', active && 'noorix-bank-tab--active')}
          items={TABS.map((tab: any) => ({ id: tab.id, label: t(tab.labelKey) }))}
          value={activeTab}
          onChange={setActiveTab}
          buttonSize="auto"
        />

        <div className="p-6">
          {activeTab === 'statements' && (
            <>
              {!summaryLoading && statements.length > 0 && completedStatements.length === 0 && (
                <div
                  className="grid gap-3 mb-5"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
                >
                  {[
                    { key: 'count', labelKey: 'bankStatementCardCount', value: summary?.data?.statementCount ?? 0, f: (v: any) => String(v) },
                    { key: 'dep', labelKey: 'bankStatementCardDeposits', value: summary?.data?.totalDeposits ?? 0, f: (v: any) => fmt(Number(v)) },
                    { key: 'wdr', labelKey: 'bankStatementCardWithdrawals', value: summary?.data?.totalWithdrawals ?? 0, f: (v: any) => fmt(Number(v)) },
                    { key: 'net', labelKey: 'bankStatementCardNetFlow', value: summary?.data?.netFlow ?? 0, f: (v: any) => fmt(Number(v)) },
                  ].map((c: any) => (
                    <div
                      key={c.key}
                      className="p-[14px] rounded-[10px] bg-noorix-bg-muted border border-noorix-border"
                    >
                      <div className="text-[11px] text-noorix-muted mb-1">{t(c.labelKey)}</div>
                      <div className="text-[18px] font-bold">{c.f(c.value)}</div>
                    </div>
                  ))}
                </div>
              )}

              {!listLoading && statements.length === 0 && (
                <div
                  className="text-center bg-noorix-bg-muted rounded-xl py-12 px-6"
                  style={{ border: '1px dashed var(--noorix-border)' }}
                >
                  <div className="text-[48px] mb-3 opacity-50"></div>
                  <div className="text-[16px] font-semibold mb-1.5">{t('bankStatementEmptyTitle')}</div>
                  <div className="text-[13px] text-noorix-muted mb-4">{t('bankStatementEmptyDesc')}</div>
                  <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
                    <span aria-hidden className="text-[18px] leading-none">＋</span>
                    {t('bankStatementUploadNew')}
                  </Button>
                </div>
              )}

              {!listLoading && statements.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-3 mb-4 items-center">
                    <Input
                      type="select"
                      value={filterMonth}
                      onChange={(e: any) => setFilterMonth(e.target.value)}
                    >
                      <option value="">{t('allMonths')}</option>
                      {months.map((m: any) => {
                        const [y, mo] = m.split('-');
                        const label = `${AR_MONTHS[parseInt(mo, 10) - 1] || mo} ${y}`;
                        return (
                          <option key={m} value={m}>
                            {label}
                          </option>
                        );
                      })}
                    </Input>
                    <Input
                      type="select"
                      value={filterBank}
                      onChange={(e: any) => setFilterBank(e.target.value)}
                    >
                      <option value="">{t('bankStatementAllBanks')}</option>
                      {banks.map((b: any) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </Input>
                  </div>

                  <div className="grid gap-2.5">
                    {statements.map((stmt: any) => {
                      const start = stmt.startDate?.slice(0, 10);
                      const end = stmt.endDate?.slice(0, 10);
                      const statusColor = stmt.status === 'mapping' ? 'amber' : stmt.status === 'completed' ? 'green' : 'gray';
                      return (
                        <div
                          key={stmt.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectStatement(stmt)}
                          onKeyDown={(e: any) => e.key === 'Enter' && handleSelectStatement(stmt)}
                          className="flex gap-4 p-3.5 border border-noorix-border rounded-lg cursor-pointer items-center"
                          style={{ background: 'var(--noorix-bg)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-2 items-center mb-1">
                              <span className="font-semibold">{stmt.companyName || stmt.fileName || 'كشف'}</span>
                              <Badge color={statusColor} size="sm">
                                {stmt.status === 'mapping' ? t('bankStatementStatusMapping') : t('bankStatementStatusCompleted')}
                              </Badge>
                            </div>
                            <div className="text-[12px] text-noorix-muted">
                              {stmt.bankName || '—'} • {start && end ? `${start} – ${end}` : stmt.fileName}
                            </div>
                          </div>
                          <div className="text-[12px] text-noorix-muted">
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
            <BankCategoryTreePanel companyId={companyId} companies={companies} />
          )}
          {activeTab === 'templates' && (
            <BankStatementTemplatesPanel companyId={companyId} />
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

    </ScreenShell>
  );
}
