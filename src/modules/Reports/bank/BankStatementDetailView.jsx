/**
 * عرض كشف كامل (صفحة) — بديل النافذة المنبثقة البسيطة؛ مستوحى من المشروع السابق.
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import useBankStatementView from './useBankStatementView';
import { Button, Modal } from '../../../ui';
import BankStatementSummaryCards from './BankStatementSummaryCards';
import BankStatementAnalysisCardsTab from './BankStatementAnalysisCardsTab';
import BankStatementTransactionsFullTab from './BankStatementTransactionsFullTab';
import BankStatementReconciliationTab from './BankStatementReconciliationTab';
import BankStatementSalesCompareTab from './BankStatementSalesCompareTab';
import { exportBankStatementExcel, printBankStatement } from './bankStatementExportPrint';

export default function BankStatementDetailView({
  statementId,
  companyId,
  companyName,
  categories,
  onBack,
  onDelete,
  createCategory,
  showToast,
  onRefresh,
}) {
  const { t } = useTranslation();
  const vm = useBankStatementView(statementId, companyId, t);
  const [newCategoryName, setNewCategoryName] = useState('');

  if (vm.isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
        {t('loading')}…
      </div>
    );
  }

  if (!vm.statement) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 16 }}>{t('bankStatementNotFound')}</p>
        <Button variant="primary" style={{ marginTop: 16 }} onClick={onBack}>{t('bankBackToList')}</Button>
      </div>
    );
  }

  if (vm.statement.status === 'mapping') {
    return (
      <div style={{ padding: 24 }}>
        <Button variant="ghost" onClick={onBack}>← {t('bankBackToList')}</Button>
        <p style={{ marginTop: 16 }}>{t('bankStatementMappingRequired')}</p>
      </div>
    );
  }

  const stmt = vm.statement;

  const onCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory({ nameAr: newCategoryName.trim(), nameEn: newCategoryName.trim() });
      setNewCategoryName('');
      onRefresh?.();
      showToast(t('savedSuccessfully') || 'OK');
    } catch (e) {
      showToast(e?.message || 'Error', 'error');
    }
  };

  const tabBtn = (id, label, count) => (
    <Button
      key={id}
      type="button"
      style={{
        margin: 0,
        borderRadius: 0,
        border: 'none',
        borderBottom: vm.activeTab === id ? '3px solid var(--noorix-accent-blue)' : '3px solid transparent',
        background: vm.activeTab === id ? 'rgba(37,99,235,0.08)' : 'transparent',
        color: vm.activeTab === id ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
        fontWeight: vm.activeTab === id ? 700 : 500,
        padding: '13px 20px',
        fontSize: 13,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
      onClick={() => vm.setActiveTab(id)}
    >
      {label}
      {count != null ? (
        <span
          style={{
            marginInlineStart: 6,
            background: vm.activeTab === id ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)',
            color: vm.activeTab === id ? '#fff' : 'var(--noorix-text-muted)',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      ) : null}
    </Button>
  );

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── رأس الصفحة: زر الرجوع + أدوات ── */}
      <div className="nx-page-header" style={{ padding: '14px 18px', background: 'var(--noorix-surface)', borderRadius: 14, border: '1px solid var(--noorix-border)', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <Button onClick={onBack}>← {t('bankBackToList')}</Button>
        <div className="nx-toolbar">
          <Button
            disabled={vm.reclassifyMutation.isPending}
            onClick={() => {
              vm.reclassifyMutation.mutate(undefined, {
                onSuccess: () => showToast?.(t('bankReclassifyDone') || 'تم إعادة التصنيف'),
                onError: (e) => showToast?.(e?.message || 'Error', 'error'),
              });
            }}
          >
            {vm.reclassifyMutation.isPending ? '⟳ ' + t('loading') : t('bankReclassify')}
          </Button>
          <Button
            onClick={() =>
              exportBankStatementExcel({
                statement: stmt,
                companyName,
                filteredTransactions: vm.filteredTransactions,
                columnTotals: vm.columnTotals,
                summaryByCategory: vm.summaryByCategory,
              })
            }
          >
            {t('bankExportExcel')}
          </Button>
          <Button
            onClick={() =>
              printBankStatement({
                statement: stmt,
                companyName,
                filteredTransactions: vm.filteredTransactions,
                columnTotals: vm.columnTotals,
              })
            }
          >
            {t('bankPrint')}
          </Button>
          {onDelete && <Button variant="danger" onClick={onDelete}>{t('delete')}</Button>}
        </div>
      </div>

      {/* ── بطاقات الملخص ── */}
      <BankStatementSummaryCards statement={stmt} t={t} />

      {/* ── التبويبات ── */}
      <div
        className="noorix-surface-card"
        style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--noorix-border)' }}
      >
        <div
          className="noorix-tab-bar"
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: 0,
            borderBottom: '2px solid var(--noorix-border)',
            background: 'var(--noorix-bg-muted)',
          }}
        >
          {tabBtn('analysis', t('bankTabAnalysis'))}
          {tabBtn('transactions', t('bankTabTransactions'), stmt.transactions?.length)}
          {tabBtn('reconciliation', t('bankTabReconciliation'))}
          {tabBtn('sales', t('bankTabSalesCompare'))}
        </div>
        <div style={{ padding: 20 }}>
          {vm.activeTab === 'analysis' && (
            <BankStatementAnalysisCardsTab
              statement={stmt}
              summaryByCategory={vm.summaryByCategory}
              activeCards={vm.activeCards}
              availableToAdd={vm.availableToAdd}
              isCardActive={vm.isCardActive}
              addCard={vm.addCard}
              setCardToDelete={vm.setCardToDelete}
              setCategoryFilter={vm.setCategoryFilter}
              setTypeFilter={vm.setTypeFilter}
              setActiveTab={vm.setActiveTab}
              categories={categories}
              showToast={showToast}
              onSaveTxCategory={async (txId, categoryId) => {
                await vm.updateCategoryMutation.mutateAsync({ txId, categoryId });
                await vm.refetch();
              }}
            />
          )}
          {vm.activeTab === 'transactions' && (
            <BankStatementTransactionsFullTab
              statement={stmt}
              categories={categories}
              filteredTransactions={vm.filteredTransactions}
              columnTotals={vm.columnTotals}
              categoryNames={vm.categoryNames}
              searchTerm={vm.searchTerm}
              setSearchTerm={vm.setSearchTerm}
              categoryFilter={vm.categoryFilter}
              setCategoryFilter={vm.setCategoryFilter}
              typeFilter={vm.typeFilter}
              setTypeFilter={vm.setTypeFilter}
              editingTxId={vm.editingTxId}
              setEditingTxId={vm.setEditingTxId}
              editingCategory={vm.editingCategory}
              setEditingCategory={vm.setEditingCategory}
              editingNoteId={vm.editingNoteId}
              setEditingNoteId={vm.setEditingNoteId}
              editingNote={vm.editingNote}
              setEditingNote={vm.setEditingNote}
              sortConfig={vm.sortConfig}
              handleSort={vm.handleSort}
              selectedTxIds={vm.selectedTxIds}
              toggleTxSelection={vm.toggleTxSelection}
              toggleAllFiltered={vm.toggleAllFiltered}
              handleCategoryChange={vm.handleCategoryChange}
              handleNoteChange={vm.handleNoteChange}
              updateCategoryMutation={vm.updateCategoryMutation}
              updateNoteMutation={vm.updateNoteMutation}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              onCreateCategory={onCreateCategory}
            />
          )}
          {vm.activeTab === 'reconciliation' && (
            <BankStatementReconciliationTab
              balanceVerification={vm.balanceVerification}
              reconciliationStats={vm.reconciliationStats}
              reconLoading={vm.reconLoading}
            />
          )}
          {vm.activeTab === 'sales' && (
            <BankStatementSalesCompareTab
              statement={stmt}
              reconciliationStats={vm.reconciliationStats}
              reconLoading={vm.reconLoading}
            />
          )}
        </div>
      </div>

      <Modal
        open={!!vm.cardToDelete}
        onClose={() => vm.setCardToDelete(null)}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => vm.setCardToDelete(null)}>{t('cancel')}</Button>
            <Button variant="danger" onClick={() => vm.removeCard(vm.cardToDelete)}>{t('delete')}</Button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>{t('bankConfirmRemoveCard')}</p>
      </Modal>
    </div>
  );
}
