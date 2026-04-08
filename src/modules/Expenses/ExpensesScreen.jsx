/**
 * ExpensesScreen — المصاريف الثابتة والمتغيرة
 * 4 تبويبات: أصناف المصاريف، تسجيل مصروف، إدخال جماعي، سجل المدفوعات
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getExpenseLines,
  deactivateExpenseLine,
} from '../../services/api';
import { useCategories } from '../../hooks/useCategories';
import { useSuppliers } from '../../hooks/useSuppliers';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { fmt, sumAmounts } from '../../utils/format';
import { Button, Input, ScreenTabs, ScreenShell } from '../../ui';
import Toast from '../../components/Toast';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import SmartTable from '../../components/common/SmartTable';
import ExpenseLineList from './components/ExpenseLineList';
import ExpenseLineDetailModal from './components/ExpenseLineDetailModal';
import ExpenseLineFormModal from './components/ExpenseLineFormModal';
import ExpenseFormModal from './components/ExpenseFormModal';
import ExpenseBatchTable from './components/ExpenseBatchTable';
import PaymentHistoryTab from './components/PaymentHistoryTab';

const REFRESH_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

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

  const handleCreateLine = () => { setEditingLine(null); setShowFormModal(true); };
  const handleEditLine = (line) => { setEditingLine(line); setShowFormModal(true); };
  const handleCloseForm = () => { setShowFormModal(false); setEditingLine(null); };

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
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('fixedAndVariableExpenses')}</h1>
      </div>

      <ScreenTabs
        items={expenseTabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content"
        tabBarEnd={
          !companyId
            ? null
            : activeTab === 'lines'
              ? (
                  <div className="nx-toolbar !flex-nowrap max-w-full min-w-0 justify-end">
                    <div className="w-[min(100%,11rem)] shrink-0">
                      <Input
                        type="select"
                        size="sm"
                        value={filterKind}
                        onChange={(e) => setFilterKind(e.target.value)}
                        className="w-full"
                        aria-label={t('allTypes')}
                      >
                        <option value="">{t('allTypes')}</option>
                        <option value="fixed_expense">{t('fixedExpense')}</option>
                        <option value="expense">{t('variableExpense')}</option>
                      </Input>
                    </div>
                    <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={handleCreateLine}>
                      {t('addExpenseLine')}
                    </Button>
                    <Button
                      size="sm"
                      className="shrink-0 whitespace-nowrap"
                      icon={REFRESH_ICON}
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['expense-lines'] })}
                    >
                      {t('refresh')}
                    </Button>
                  </div>
                )
              : activeTab === 'entry'
                ? (
                    <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setShowExpenseForm(true)}>
                      {t('expenseRecordNew')}
                    </Button>
                  )
                : null
        }
      >
      {activeTab === 'lines' && (
        <ExpenseLineList
          expenseLines={expenseLines}
          isLoading={linesLoading}
          onLineClick={handleLineClick}
          onEditLine={handleEditLine}
          onDeleteLine={handleDeleteLine}
        />
      )}

      {activeTab === 'entry' && companyId && showExpenseForm && (
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

      {activeTab === 'entry' && !companyId && (
        <p className="m-0 text-[13px] text-noorix-muted">{t('pleaseSelectCompany')}</p>
      )}

      {activeTab === 'entry' && companyId && !showExpenseForm && (
        <p className="m-0 text-[13px] text-noorix-muted">{t('expensesDesc')}</p>
      )}

      {activeTab === 'batch' && (
        <ExpenseBatchTable
          companyId={companyId}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
            showToast(t('savedSuccessfully') || 'تم الحفظ بنجاح');
          }}
        />
      )}

      {activeTab === 'payments' && (
        <div>
          <DateFilterBar filter={dateFilter} />
          <div className="mt-4">
            <PaymentHistoryTab companyId={companyId} dateFilter={dateFilter} />
          </div>
        </div>
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
