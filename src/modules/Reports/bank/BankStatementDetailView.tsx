/**
 * تفاصيل كشف البنك — عرض التحليل والتصنيف والمطابقة والطباعة من التقرير البنكي.
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import useBankStatementView from '../../../hooks/useBankStatementView';
import { Button, DialogActions, Modal, ScreenTabs, cn, usePrintPreview } from '../../../ui';
import BankStatementSummaryCards from './BankStatementSummaryCards';
import BankStatementAnalysisCardsTab from './BankStatementAnalysisCardsTab';
import BankStatementTransactionsFullTab from './BankStatementTransactionsFullTab';
import BankStatementReconciliationTab from './BankStatementReconciliationTab';
import BankStatementSalesCompareTab from './BankStatementSalesCompareTab';
import { buildBankStatementPrintHtml, exportBankStatementExcel } from './bankStatementExportPrint';
import { throwIfApiFailed } from '../../../services/api';
import type { ApiParsedResult } from '../../../services/api';
import type { BankCategoryLite, BankCreateCategoryBody } from './bankAnalysisTab.types';

type BankStatementDetailViewProps = {
  statementId: string;
  companyId: string;
  companyName?: string;
  companyLogoUrl?: string;
  categories?: BankCategoryLite[];
  onBack: () => void;
  onDelete?: () => void;
  createCategory: (body: BankCreateCategoryBody) => Promise<ApiParsedResult<BankCategoryLite>>;
  showToast: (message: string, type?: string) => void;
  onRefresh?: () => void;
};

function errorMessage(error: unknown, fallback = 'Error'): string {
  return error instanceof Error ? error.message : fallback;
}

export default function BankStatementDetailView({
  statementId,
  companyId,
  companyName,
  companyLogoUrl,
  categories,
  onBack,
  onDelete,
  createCategory,
  showToast,
  onRefresh,
}: BankStatementDetailViewProps) {
  const { t } = useTranslation();
  const { openPrintPreview, printPreviewModal } = usePrintPreview({
    title: t('bankPrint'),
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });
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
        <Button variant="ghost" onClick={onBack}>? {t('bankBackToList')}</Button>
        <p className="mt-4">{t('bankStatementMappingRequired')}</p>
      </div>
    );
  }

  const stmt = vm.statement;

  const onCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const catRes = await createCategory({ nameAr: newCategoryName.trim(), nameEn: newCategoryName.trim() });
      throwIfApiFailed(catRes, t('saveFailed'));
      setNewCategoryName('');
      onRefresh?.();
      showToast(t('savedSuccessfully') || 'OK');
    } catch (error: unknown) {
      showToast(errorMessage(error), 'error');
    }
  };

  return (
    <div className="grid gap-5">
      {printPreviewModal}
      {/* رأس الصفحة: زر الرجوع + الأدوات */}
      <div className="nx-page-header noorix-surface-card py-[14px] px-[18px]">
          <Button size="sm" onClick={onBack}>← {t('bankBackToList')}</Button>
        <div className="nx-toolbar">
          <Button
            size="sm"
            disabled={vm.reclassifyMutation.isPending}
            onClick={() => {
              vm.reclassifyMutation.mutate(undefined, {
                onSuccess: () => showToast?.(t('bankReclassifyDone') || 'تمت إعادة التصنيف'),
                onError: (error: unknown) => showToast?.(errorMessage(error), 'error'),
              });
            }}
          >
            {vm.reclassifyMutation.isPending ? '… ' + t('loading') : t('bankReclassify')}
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await exportBankStatementExcel({
                  statement: stmt,
                  companyName,
                  filteredTransactions: vm.filteredTransactions,
                  columnTotals: vm.columnTotals,
                  summaryByCategory: vm.summaryByCategory,
                });
              } catch (error: unknown) {
                showToast?.(errorMessage(error), 'error');
              }
            }}
          >
            {t('bankExportExcel')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const html = buildBankStatementPrintHtml({
                statement: stmt,
                companyName,
                logoUrl: companyLogoUrl,
                filteredTransactions: vm.filteredTransactions,
                columnTotals: vm.columnTotals,
              });
              if (html) openPrintPreview({ title: t('bankPrint'), html });
            }}
          >
            {t('bankPrint')}
          </Button>
          {onDelete && <Button size="sm" variant="danger" onClick={onDelete}>{t('delete')}</Button>}
        </div>
      </div>

      {/* -- ?????? ?????? -- */}
      <BankStatementSummaryCards statement={stmt} t={t} />

      {/* -- ????????? -- */}
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
              onSaveTxCategory={async (txId: string, categoryId: string | null) => {
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
          <DialogActions
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => vm.setCardToDelete(null) },
              { key: 'delete', label: t('delete'), role: 'delete', onClick: () => vm.removeCard(vm.cardToDelete) },
            ]}
          />
        }
      >
        <p className="mt-0">{t('bankConfirmRemoveCard')}</p>
      </Modal>
    </div>
  );
}
