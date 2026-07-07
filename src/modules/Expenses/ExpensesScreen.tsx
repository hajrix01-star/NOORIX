import React, { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useApiListQuery } from '../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { deactivateExpenseLine, getExpenseLines } from '../../services/api';
import { expenseKeys } from '../../services/queryKeys';
import { Button, ScreenTabs, ScreenShell, cn, FilterToolbar } from '../../ui';
import { DateFilterBar, useDateFilter } from '../../ui/date';
import type { ExpenseLineKind, ExpenseLineRecord } from '../../types/api';
import ExpenseLineList from './components/ExpenseLineList';
import ExpenseLineDetailModal from './components/ExpenseLineDetailModal';
import ExpenseLineFormModal from './components/ExpenseLineFormModal';
import ExpenseFormModal from './components/ExpenseFormModal';
import ExpenseBatchTable from './components/ExpenseBatchTable';
import PaymentHistoryTab from './components/PaymentHistoryTab';
import { expenseLineDisplayName } from './expenseModels';

type ExpenseTabId = 'lines' | 'entry' | 'batch' | 'payments';

const TABS: Array<{ id: ExpenseTabId; labelKey: string; shortLabelKey: string }> = [
  { id: 'lines', labelKey: 'expenseLinesTab', shortLabelKey: 'expenseLinesTabShort' },
  { id: 'entry', labelKey: 'expenseEntryTab', shortLabelKey: 'expenseEntryTabShort' },
  { id: 'batch', labelKey: 'expenseBatchTab', shortLabelKey: 'expenseBatchTabShort' },
  { id: 'payments', labelKey: 'paymentHistoryTab', shortLabelKey: 'paymentHistoryTabShort' },
];

const EXPENSE_TAB_IDS = TABS.map((tab) => tab.id);

export default function ExpensesScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const dateFilter = useDateFilter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useTabSearchParam(EXPENSE_TAB_IDS, 'lines');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingLine, setEditingLine] = useState<ExpenseLineRecord | null>(null);
  const [filterKind, setFilterKind] = useState<ExpenseLineKind | ''>('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const { data: expenseLines = [], isLoading: linesLoading, isError: linesError } = useApiListQuery<ExpenseLineRecord>({
    queryKey: expenseKeys.linesWithKind(companyId, filterKind),
    queryFn: () => getExpenseLines(companyId, filterKind || undefined),
    fallbackMessage: t('loadingError'),
    enabled: !!companyId,
  });

  const refreshExpenseLines = () => queryClient.invalidateQueries({ queryKey: expenseKeys.linesRoot() });

  const handleDeleteLine = (line: ExpenseLineRecord) => {
    const lineName = expenseLineDisplayName(line, lang);
    if (!window.confirm(`${t('deleteConfirm') || 'Confirm delete'}: ${lineName}`)) return;
    deactivateExpenseLine(line.id, companyId)
      .then(() => {
        refreshExpenseLines();
        showToast(t('savedSuccessfully'));
      })
      .catch((error: Error) => showToast(error.message || t('saveFailed'), 'error'));
  };

  const handleFormSaved = () => {
    invalidateOnFinancialMutation(queryClient);
    refreshExpenseLines();
    setShowFormModal(false);
    setEditingLine(null);
    showToast(t('savedSuccessfully'));
  };

  const expenseTabItems = useMemo(
    () =>
      TABS.map((tab) => {
        const full = t(tab.labelKey);
        const short = t(tab.shortLabelKey);
        return {
          id: tab.id,
          label: short === full ? full : (
            <>
              <span className="hidden sm:inline">{full}</span>
              <span className="sm:hidden">{short}</span>
            </>
          ),
        };
      }),
    [t],
  );

  useEffect(() => {
    if (activeTab !== 'entry') setShowExpenseForm(false);
  }, [activeTab]);

  return (
    <ScreenShell>
      <div className="nx-page-header flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('fixedAndVariableExpenses')}</h1>
          <p className="text-[13px] text-noorix-muted m-0 mt-1">{t('expensesDesc')}</p>
        </div>
        {companyId ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-1.5 text-[13px]">
              <span className="text-noorix-muted shrink-0">{t('expenseLinesTab')}</span>
              <span className="font-bold tabular-nums text-noorix-blue">{expenseLines.length}</span>
            </span>
          </div>
        ) : null}
      </div>

      <ScreenTabs
        items={expenseTabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content min-h-[200px]"
      >
        {activeTab === 'lines' ? (
          !companyId ? (
            <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
          ) : (
            <ExpenseLineList
              embedded
              expenseLines={expenseLines}
              isLoading={linesLoading}
              isError={linesError}
              filterKind={filterKind}
              onFilterKindChange={setFilterKind}
              onCreateLine={() => {
                setEditingLine(null);
                setShowFormModal(true);
              }}
              onRefresh={refreshExpenseLines}
              onLineClick={(line) => setSelectedLineId(line.id)}
              onEditLine={(line) => {
                setEditingLine(line);
                setShowFormModal(true);
              }}
              onDeleteLine={handleDeleteLine}
            />
          )
        ) : null}

        {activeTab === 'entry' ? (
          <ScreenShell embedded className={cn('pt-4')}>
            {!companyId ? (
              <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
            ) : (
              <>
                <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                  <p className="m-0 min-w-0 flex-1 text-[13px] text-noorix-muted">{t('expensesDesc')}</p>
                  <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setShowExpenseForm(true)}>
                    {t('expenseRecordNew')}
                  </Button>
                </div>
                {showExpenseForm ? (
                  <ExpenseFormModal
                    companyId={companyId}
                    onClose={() => setShowExpenseForm(false)}
                    onSaved={() => {
                      setShowExpenseForm(false);
                      invalidateOnFinancialMutation(queryClient);
                      refreshExpenseLines();
                      showToast(t('savedSuccessfully'));
                    }}
                  />
                ) : null}
              </>
            )}
          </ScreenShell>
        ) : null}

        {activeTab === 'batch' ? (
          <ExpenseBatchTable
            embedded
            companyId={companyId}
            onSaved={() => {
              invalidateOnFinancialMutation(queryClient);
              refreshExpenseLines();
              showToast(t('savedSuccessfully'));
            }}
          />
        ) : null}

        {activeTab === 'payments' ? (
          <ScreenShell embedded className={cn('pt-4')}>
            {!companyId ? (
              <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
            ) : (
              <>
                <FilterToolbar className="mb-3 border-b border-noorix-border pb-3">
                  <DateFilterBar filter={dateFilter} />
                </FilterToolbar>
                <PaymentHistoryTab companyId={companyId} dateFilter={dateFilter} />
              </>
            )}
          </ScreenShell>
        ) : null}
      </ScreenTabs>

      {selectedLineId ? (
        <ExpenseLineDetailModal
          lineId={selectedLineId}
          companyId={companyId}
          onClose={() => setSelectedLineId(null)}
          dateFilter={dateFilter}
          onRefresh={refreshExpenseLines}
        />
      ) : null}

      {showFormModal ? (
        <ExpenseLineFormModal
          companyId={companyId}
          editing={editingLine}
          onClose={() => {
            setShowFormModal(false);
            setEditingLine(null);
          }}
          onSaved={handleFormSaved}
        />
      ) : null}
    </ScreenShell>
  );
}
