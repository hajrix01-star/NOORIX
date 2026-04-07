/**
 * ExpensesScreen — المصاريف الثابتة والمتغيرة
 * 4 تبويبات: أصناف المصاريف، تسجيل مصروف، إدخال جماعي، سجل المدفوعات
 */
import React, { useState, useMemo } from 'react';
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
import { Button, ScreenTabs } from '../../ui';
import Toast from '../../components/Toast';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import SmartTable from '../../components/common/SmartTable';
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

  return (
    <div className="flex flex-col gap-4 py-4 px-0 md:px-3 lg:px-6">
      <div>
        <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('fixedAndVariableExpenses')}</h1>
      </div>

      <div className="noorix-surface-card overflow-hidden p-0">
        <ScreenTabs
          variant="underline"
          items={expenseTabItems}
          value={activeTab}
          onChange={setActiveTab}
        />
        <div className="nx-tab-content">

      {activeTab === 'lines' && (
        <ExpenseLineList
          companyId={companyId}
          expenseLines={expenseLines}
          isLoading={linesLoading}
          filterKind={filterKind}
          onFilterKindChange={setFilterKind}
          onLineClick={handleLineClick}
          onCreateLine={handleCreateLine}
          onEditLine={handleEditLine}
          onDeleteLine={handleDeleteLine}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['expense-lines'] })}
        />
      )}

      {activeTab === 'entry' && (
        <ExpenseFormTab
          companyId={companyId}
          onSaved={() => {
            invalidateOnFinancialMutation(queryClient);
            queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
            showToast(t('savedSuccessfully') || 'تم الحفظ بنجاح');
          }}
        />
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
        </div>
      </div>

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
    </div>
  );
}

function ExpenseFormTab({ companyId, onSaved }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div>
      <Button variant="primary" onClick={() => setShowForm(true)}>
        + تسجيل مصروف جديد
      </Button>
      {showForm && (
        <ExpenseFormModal
          companyId={companyId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onSaved(); }}
        />
      )}
    </div>
  );
}
