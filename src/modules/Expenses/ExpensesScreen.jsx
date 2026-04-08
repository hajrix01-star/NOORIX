/**
 * ExpensesScreen — المصاريف الثابتة والمتغيرة
 * نفس إيقاع الموارد البشرية: nx-page-header، تبويبات متصلة، محتوى تبويب داخل ScreenShell embedded + pt-4
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { getExpenseLines, deactivateExpenseLine } from '../../services/api';
import { Button, ScreenTabs, ScreenShell, cn } from '../../ui';
import Toast from '../../components/Toast';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import ExpenseLineList from './components/ExpenseLineList';
import ExpenseLineDetailModal from './components/ExpenseLineDetailModal';
import ExpenseLineFormModal from './components/ExpenseLineFormModal';
import ExpenseFormModal from './components/ExpenseFormModal';
import ExpenseBatchTable from './components/ExpenseBatchTable';
import PaymentHistoryTab from './components/PaymentHistoryTab';

const TABS = [
  { id: 'lines', labelKey: 'expenseLinesTab' },
  { id: 'entry', labelKey: 'expenseEntryTab' },
  { id: 'batch', labelKey: 'expenseBatchTab' },
  { id: 'payments', labelKey: 'paymentHistoryTab' },
];

export default function ExpensesScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const companyId = activeCompanyId ?? '';
  const queryClient = useQueryClient();
  const dateFilter = useDateFilter();

  const [activeTab, setActiveTab] = useState('lines');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [filterKind, setFilterKind] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const { data: expenseLines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['expense-lines', companyId, filterKind],
    queryFn: async () => {
      const res = await getExpenseLines(companyId, filterKind || undefined);
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!companyId,
  });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const handleLineClick = (line) => setSelectedLineId(line?.id ?? null);
  const handleCloseDetail = () => setSelectedLineId(null);

  const handleCreateLine = () => {
    setEditingLine(null);
    setShowFormModal(true);
  };
  const handleEditLine = (line) => {
    setEditingLine(line);
    setShowFormModal(true);
  };
  const handleCloseForm = () => {
    setShowFormModal(false);
    setEditingLine(null);
  };

  const handleDeleteLine = (line) => {
    if (!confirm(`هل تريد إلغاء تفعيل بند المصروف "${line.nameAr || line.nameEn}"؟\n(لن يُحذف حذفاً نهائياً، بل سيُستبعد من القوائم النشطة)`)) return;
    deactivateExpenseLine(line.id, companyId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
        showToast(t('savedSuccessfully') || 'تم إلغاء التفعيل بنجاح');
      })
      .catch((err) => showToast(err?.message || 'فشل', 'error'));
  };

  const handleFormSaved = () => {
    invalidateOnFinancialMutation(queryClient);
    queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
    handleCloseForm();
    showToast(t('savedSuccessfully') || 'تم الحفظ بنجاح');
  };

  const expenseTabItems = useMemo(
    () => TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
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
        {companyId && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-1.5 text-[13px]">
              <span className="text-noorix-muted shrink-0">{t('expenseLinesTab')}</span>
              <span className="font-bold tabular-nums text-noorix-blue">{expenseLines.length}</span>
            </span>
          </div>
        )}
      </div>

      <ScreenTabs
        items={expenseTabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content min-h-[200px]"
      >
        {activeTab === 'lines' && (
          !companyId ? (
            <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
          ) : (
            <ExpenseLineList
              embedded
              expenseLines={expenseLines}
              isLoading={linesLoading}
              filterKind={filterKind}
              onFilterKindChange={setFilterKind}
              onCreateLine={handleCreateLine}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['expense-lines'] })}
              onLineClick={handleLineClick}
              onEditLine={handleEditLine}
              onDeleteLine={handleDeleteLine}
            />
          )
        )}

        {activeTab === 'entry' && (
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
                {showExpenseForm && (
                  <ExpenseFormModal
                    companyId={companyId}
                    onClose={() => setShowExpenseForm(false)}
                    onSaved={() => {
                      setShowExpenseForm(false);
                      invalidateOnFinancialMutation(queryClient);
                      queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
                      showToast(t('savedSuccessfully') || 'تم الحفظ بنجاح');
                    }}
                  />
                )}
              </>
            )}
          </ScreenShell>
        )}

        {activeTab === 'batch' && (
          <ExpenseBatchTable embedded companyId={companyId} onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
            showToast(t('savedSuccessfully') || 'تم الحفظ بنجاح');
          }}
          />
        )}

        {activeTab === 'payments' && (
          <ScreenShell embedded className={cn('pt-4')}>
            {!companyId ? (
              <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
            ) : (
              <>
                <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
                  <div className="min-w-0 flex-1">
                    <DateFilterBar filter={dateFilter} />
                  </div>
                </div>
                <PaymentHistoryTab companyId={companyId} dateFilter={dateFilter} />
              </>
            )}
          </ScreenShell>
        )}
      </ScreenTabs>

      {selectedLineId && (
        <ExpenseLineDetailModal
          lineId={selectedLineId}
          companyId={companyId}
          onClose={handleCloseDetail}
          dateFilter={dateFilter}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['expense-lines'] })}
        />
      )}

      {showFormModal && (
        <ExpenseLineFormModal
          companyId={companyId}
          editing={editingLine}
          onClose={handleCloseForm}
          onSaved={handleFormSaved}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </ScreenShell>
  );
}
