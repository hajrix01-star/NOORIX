/**
 * BankStatementAnalysisScreen — تحليل كشوف الحساب (واجهة كاملة مكيّفة من المشروع السابق)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiListQuery, useApiQuery } from '../../hooks/useApiQuery';
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
import { getSaudiNow, toYmd } from '../../utils/saudiDate';
import { bankKeys } from '../../services/queryKeys';
import { Button, Badge, DateMonthScopePicker, Modal, Input, ScreenShell, ScreenTitle, ScreenTabs, MetricCard, FilterToolbar, SearchableOptionsPicker, cn } from '../../ui';
import BankStatementUploadModal from './BankStatementUploadModal';
import BankStatementMappingModal from './BankStatementMappingModal';
import BankStatementDetailView from './bank/BankStatementDetailView';
import BankStatementTemplatesPanel from './bank/BankStatementTemplatesPanel';
import BankCategoryTreePanel from './bank/BankCategoryTreePanel';
import type { BankCategoryLite, BankCreateCategoryBody, BankStatementLite } from './bank/bankAnalysisTab.types';
import type { BankSheetData } from './bank/bankMappingAutoDetect';

const TABS = [
  { id: 'statements', labelKey: 'bankStatementTabStatements' },
  { id: 'rules', labelKey: 'bankStatementTabRules' },
  { id: 'templates', labelKey: 'bankStatementTabTemplates' },
] as const;
const BANK_STATEMENT_TAB_IDS = TABS.map((tab) => tab.id);

type AppCompany = { id?: string; nameAr?: string | null; nameEn?: string | null; name?: string | null };
type BankSummaryData = {
  statementCount?: number | string | null;
  totalDeposits?: number | string | null;
  totalWithdrawals?: number | string | null;
  netFlow?: number | string | null;
};
type MappingStatement = BankStatementLite & { _fullRaw?: BankSheetData };
type MetricItem = { label: string; value: string; color: string };
type SummaryMetricItem = { key: string; labelKey: string; value: number | string | null | undefined; format: (value: number | string | null | undefined) => string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function BankStatementAnalysisScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const companyId = activeCompanyId ?? '';

  const activeCompanyName = useMemo(() => {
    const c = (companies || []).find((x: AppCompany) => x.id === companyId);
    return c?.nameAr || c?.nameEn || c?.name || '';
  }, [companies, companyId]);

  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useTabSearchParam(BANK_STATEMENT_TAB_IDS, 'statements');
  const [showUpload, setShowUpload] = useState(false);
  const [mappingStatement, setMappingStatement] = useState<MappingStatement | null>(null);
  const now = getSaudiNow();
  const [filterYear, setFilterYear] = useState(now.year);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { showToast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useApiQuery<BankSummaryData>({
    queryKey: bankKeys.statementsSummaryByCompany(companyId),
    queryFn: () => bankStatementSummary(companyId),
    enabled: !!companyId,
    fallbackMessage: t('apiRequestFailed'),
  });

  const { data: statements = [], isLoading: listLoading } = useApiListQuery<BankStatementLite>({
    queryKey: bankKeys.statementsListFiltered(companyId, filterMonth, filterBank),
    queryFn: () =>
      bankStatementsList(companyId, {
        month: filterMonth || undefined,
        bankName: filterBank || undefined,
      }),
    enabled: !!companyId && (activeTab === 'statements' || !selectedStatementId),
    fallbackMessage: t('apiRequestFailed'),
  });

  const { data: categories = [] } = useApiListQuery<BankCategoryLite>({
    queryKey: bankKeys.statementCategories(companyId),
    queryFn: () => bankStatementCategories(companyId),
    enabled: !!companyId,
    fallbackMessage: t('apiRequestFailed'),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: bankKeys.statementsList() });
    queryClient.invalidateQueries({ queryKey: bankKeys.statementsSummary() });
    queryClient.invalidateQueries({ queryKey: bankKeys.statementCategoriesRoot() });
    queryClient.invalidateQueries({ queryKey: bankKeys.statementDetailRoot() });
  }, [queryClient]);

  const handleUploadComplete = (stmt: BankStatementLite, fullRaw: BankSheetData) => {
    setShowUpload(false);
    invalidate();
    if (stmt?.status === 'mapping') setMappingStatement({ ...stmt, _fullRaw: fullRaw });
    else {
      setSelectedStatementId(stmt.id || null);
    }
  };

  const handleMappingComplete = () => {
    setMappingStatement(null);
    invalidate();
    showToast(t('bankStatementParsedCount', '0'));
  };

  const handleSelectStatement = (stmt: BankStatementLite) => {
    if (stmt.status === 'mapping') {
      setMappingStatement(stmt);
      return;
    }
      setSelectedStatementId(stmt.id || null);
  };

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => bankStatementDelete(companyId, id),
    successToast: () => t('deletedSuccessfully'),
    errorToast: (error: unknown) => errorMessage(error, t('saveFailedGeneric')),
    onSuccess: () => {
      invalidate();
      setDeleteConfirmId(null);
      setSelectedStatementId(null);
    },
  });

  const completedStatements = useMemo(
    () => statements.filter((statement) => statement.status === 'completed'),
    [statements],
  );

  const quickStats = useMemo(() => {
    const dep = completedStatements.reduce((sum, statement) => sum + (Number(statement.totalDeposits) || 0), 0);
    const wdr = completedStatements.reduce((sum, statement) => sum + (Number(statement.totalWithdrawals) || 0), 0);
    return { totalDeposits: dep, totalWithdrawals: wdr, netFlow: dep - wdr };
  }, [completedStatements]);

  const banks = [...new Set(statements.map((statement) => statement.bankName).filter((bankName): bankName is string => !!bankName))].sort();
  const filterMonthNumber = filterMonth ? Number(filterMonth.slice(5, 7)) : null;
  const filterYears = [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3];
  const setBankFilterYear = (nextYear: number) => {
    setFilterYear(nextYear);
    if (filterMonthNumber) {
      setFilterMonth(`${nextYear}-${String(filterMonthNumber).padStart(2, '0')}`);
    }
  };
  const setBankFilterMonth = (nextMonth: string) => {
    if (!nextMonth) {
      setFilterMonth('');
      return;
    }
    setFilterMonth(`${filterYear}-${String(Number(nextMonth)).padStart(2, '0')}`);
  };

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
          createCategory={(body: BankCreateCategoryBody) => bankStatementCreateCategory({ ...body, companyId })}
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
              <Button
                variant="danger"
                disabled={deleteMutation.isPending || !deleteConfirmId}
                onClick={() => {
                  if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
                }}
              >
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
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
          {([
            { label: t('bankStatementCardCount'),       value: String(completedStatements.length),    color: 'var(--color-nx-sales)'      },
            { label: t('bankStatementCardDeposits'),    value: fmt(quickStats.totalDeposits),   color: 'var(--color-nx-profit)'   },
            { label: t('bankStatementCardWithdrawals'), value: fmt(quickStats.totalWithdrawals), color: 'var(--color-nx-expenses)' },
            { label: t('bankStatementCardNetFlow'),     value: fmt(quickStats.netFlow),          color: quickStats.netFlow >= 0 ? 'var(--color-nx-profit)' : 'var(--color-nx-expenses)' },
          ] satisfies MetricItem[]).map((c, i) => (
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
          getTabClassName={(_id, active) => cn('noorix-bank-tab', active && 'noorix-bank-tab--active')}
          items={TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))}
          value={activeTab}
          onChange={setActiveTab}
          buttonSize="auto"
        />

        <div className="p-6">
          {activeTab === 'statements' && (
            <>
              {!summaryLoading && statements.length > 0 && completedStatements.length === 0 && (
                <div
                  className="grid gap-3 mb-5 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]"
                >
                  {([
                    { key: 'count', labelKey: 'bankStatementCardCount', value: summary?.statementCount ?? 0, format: (value) => String(value ?? 0) },
                    { key: 'dep', labelKey: 'bankStatementCardDeposits', value: summary?.totalDeposits ?? 0, format: (value) => fmt(Number(value)) },
                    { key: 'wdr', labelKey: 'bankStatementCardWithdrawals', value: summary?.totalWithdrawals ?? 0, format: (value) => fmt(Number(value)) },
                    { key: 'net', labelKey: 'bankStatementCardNetFlow', value: summary?.netFlow ?? 0, format: (value) => fmt(Number(value)) },
                  ] satisfies SummaryMetricItem[]).map((c) => (
                    <div
                      key={c.key}
                      className="p-[14px] rounded-[10px] bg-noorix-bg-muted border border-noorix-border"
                    >
                      <div className="text-[11px] text-noorix-muted mb-1">{t(c.labelKey)}</div>
                      <div className="text-[18px] font-bold">{c.format(c.value)}</div>
                    </div>
                  ))}
                </div>
              )}

              {!listLoading && statements.length === 0 && (
                <div
                  className="text-center bg-noorix-bg-muted rounded-xl py-12 px-6 border border-dashed border-noorix-border"
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
                  <FilterToolbar className="mb-4">
                    <DateMonthScopePicker
                      year={filterYear}
                      years={filterYears}
                      month={filterMonthNumber ? String(filterMonthNumber) : ''}
                      allowAll
                      allowYear={false}
                      fallbackMonth={now.month}
                      onYearChange={setBankFilterYear}
                      onMonthChange={setBankFilterMonth}
                    />
                    <div className="w-full min-w-0 sm:w-[min(100%,14rem)]">
                      <SearchableOptionsPicker
                        allowEmpty
                        emptyValue=""
                        emptyLabel={t('bankStatementAllBanks')}
                        value={filterBank}
                        onChange={setFilterBank}
                        options={banks.map((bank) => ({ value: bank, label: bank }))}
                        aria-label={t('bankStatementAllBanks')}
                      />
                    </div>
                  </FilterToolbar>

                  <div className="grid gap-2.5">
                    {statements.map((stmt) => {
                      const start = toYmd(stmt.startDate);
                      const end = toYmd(stmt.endDate);
                      const statusColor = stmt.status === 'mapping' ? 'amber' : stmt.status === 'completed' ? 'green' : 'gray';
                      return (
                        <div
                          key={stmt.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectStatement(stmt)}
                          onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => event.key === 'Enter' && handleSelectStatement(stmt)}
                          className="flex gap-4 p-3.5 border border-noorix-border rounded-lg cursor-pointer items-center bg-noorix-bg"
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
