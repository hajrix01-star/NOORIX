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
import { useVaults } from '../../hooks/useVaults';
import { getSaudiToday, formatSaudiDate } from '../../utils/saudiDate';
import { fmt, sumAmounts } from '../../utils/format';
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
  { id: 'lines', labelKey: 'expenseLinesTab', icon: '📋' },
  { id: 'entry', labelKey: 'expenseEntryTab', icon: '📝' },
  { id: 'batch', labelKey: 'expenseBatchTab', icon: '📦' },
  { id: 'payments', labelKey: 'paymentHistoryTab', icon: '💰' },
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
    queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
    handleCloseForm();
    showToast(t('savedSuccessfully') || 'تم الحفظ بنجاح');
  };

  const tabLabels = useMemo(() => ({
    expenseLinesTab: 'أصناف المصاريف',
    expenseEntryTab: 'تسجيل مصروف',
    expenseBatchTab: 'إدخال جماعي',
    paymentHistoryTab: 'سجل المدفوعات',
  }), []);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--noorix-text)' }}>
          {t('fixedAndVariableExpenses') || 'المصاريف الثابتة والمتغيرة'}
        </h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          {t('expensesDesc') || 'إدارة المصاريف الثابتة والمتغيرة للشركة'}
        </p>
      </div>

      <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="noorix-btn-nav"
              onClick={() => setActiveTab(tab.id)}
              style={{
                margin: 0, borderRadius: 0, border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
                background: activeTab === tab.id ? 'rgba(37,99,235,0.07)' : 'transparent',
                color: activeTab === tab.id ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {tab.icon} {t(tab.labelKey) || tab.labelKey}
            </button>
          ))}
        </div>
        <div style={{ padding: 20 }}>

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
          <div style={{ marginTop: 16 }}>
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
      <button
        type="button"
        onClick={() => setShowForm(true)}
        style={{
          padding: '12px 24px',
          borderRadius: 8,
          border: '2px solid var(--noorix-accent-blue)',
          background: 'rgba(37,99,235,0.1)',
          color: 'var(--noorix-accent-blue)',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        + تسجيل مصروف جديد
      </button>
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
