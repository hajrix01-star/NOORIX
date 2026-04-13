/**
 * عرض كشف كامل (صفحة) — بديل النافذة المنبثقة البسيطة؛ مستوحى من المشروع السابق.
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import useBankStatementView from '../../../hooks/useBankStatementView';
import { Button, Modal, ScreenTabs, cn } from '../../../ui';
import BankStatementSummaryCards from './BankStatementSummaryCards';
import BankStatementAnalysisCardsTab from './BankStatementAnalysisCardsTab';
import BankStatementTransactionsFullTab from './BankStatementTransactionsFullTab';
import BankStatementReconciliationTab from './BankStatementReconciliationTab';
import BankStatementSalesCompareTab from './BankStatementSalesCompareTab';
import { exportBankStatementExcel, printBankStatement } from './bankStatementExportPrint';
import { assertApiOk } from '../../../utils/apiResponse';

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

  const txCount = vm.statement?.transactions?.length ?? 0;
  const detailTabItems = useMemo(
    () => [
      { id: 'analysis', label: t('bankTabAnalysis') },
      {
        id: 'transactions',
        label: (
          <>
            {t('bankTabTransactions')}
            <span
              className={cn(
                'noorix-bank-detail-tab__count',
                vm.activeTab === 'transactions' && 'noorix-bank-detail-tab__count--active',
              )}
            >
              {txCount}
            </span>
          </>
        ),
      },
      { id: 'reconciliation', label: t('bankTabReconciliation') },
      { id: 'sales', label: t('bankTabSalesCompare') },
    ],
    [t, vm.activeTab, txCount],
  );

  if (vm.isLoading) {
    return (
      <div className="text-center text-noorix-muted p-12">
        {t('loading')}…
      </div>
    );
  }

  if (!vm.statement) {
    return (
      <div className="text-center p-12">
        <p className="text-[16px]">{t('bankStatementNotFound')}</p>
        <Button variant="primary" className="mt-4" onClick={onBack}>{t('bankBackToList')}</Button>
      </div>
    );
  }

  if (vm.statement.status === 'mapping') {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onBack}>← {t('bankBackToList')}</Button>
        <p className="mt-4">{t('bankStatementMappingRequired')}</p>
      </div>
    );
  }

  const stmt = vm.statement;

  const onCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const catRes = await createCategory({ nameAr: newCategoryName.trim(), nameEn: newCategoryName.trim() });
      assertApiOk(catRes, t('saveFailed'));
      setNewCategoryName('');
      onRefresh?.();
      showToast(t('savedSuccessfully') || 'OK');
    } catch (e) {
      showToast(e?.message || 'Error', 'error');
    }
  };

  return (
    <div className="grid gap-5">
      {/* ── رأس الصفحة: زر الرجوع + أدوات ── */}
      <div className="nx-page-header noorix-surface-card py-[14px] px-[18px]">
        <Button size="sm" onClick={onBack}>← {t('bankBackToList')}</Button>
        <div className="nx-toolbar">
          <Button
            size="sm"
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
            size="sm"
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
            size="sm"
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
          {onDelete && <Button size="sm" variant="danger" onClick={onDelete}>{t('delete')}</Button>}
        </div>
      </div>

      {/* ── بطاقات الملخص ── */}
      <BankStatementSummaryCards statement={stmt} t={t} />

      {/* ── التبويبات ── */}
      <div
        className="noorix-surface-card overflow-hidden p-0"
      >
        <ScreenTabs
          omitDefaultBarClasses
          fadeWrap={false}
          variant="underline"
          barClassName="noorix-bank-detail-tab-row"
          getTabClassName={() => 'noorix-bank-detail-tab'}
          items={detailTabItems}
          value={vm.activeTab}
          onChange={vm.setActiveTab}
          buttonSize="auto"
        />
        <div className="p-5">
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
        variant="danger"
        footer={
          <>
            <Button variant="ghost" onClick={() => vm.setCardToDelete(null)}>{t('cancel')}</Button>
            <Button variant="danger" onClick={() => vm.removeCard(vm.cardToDelete)}>{t('delete')}</Button>
          </>
        }
      >
        <p className="mt-0">{t('bankConfirmRemoveCard')}</p>
      </Modal>
    </div>
  );
}
