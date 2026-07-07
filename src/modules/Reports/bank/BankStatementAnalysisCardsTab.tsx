/**
 * تبويب التحليل — بطاقات قابلة للإضافة/الحذف (العرض في مكوّنات فرعية).
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { MoneyLang } from '../../../utils/money';
import type { BankCategoryAgg } from './bankAnalysisUtils';
import BankStatementPieDrilldownModal from './BankStatementPieDrilldownModal';
import { useBankAnalysisDerived } from './hooks/useBankAnalysisDerived';
import {
  ANALYSIS_CARD_FULL_WIDTH,
} from './bankAnalysisConstants';
import type {
  AnalysisCardId,
  BankTransactionLite,
  BankStatementAnalysisCardsTabProps,
  PieDisplayMode,
} from './bankAnalysisTab.types';
import { BankAnalysisCashFlowCard } from './components/analysis/BankAnalysisCashFlowCard';
import { BankAnalysisAlertsCard } from './components/analysis/BankAnalysisAlertsCard';
import { BankAnalysisPosHintCard } from './components/analysis/BankAnalysisPosHintCard';
import { BankAnalysisCategoryPieCard } from './components/analysis/BankAnalysisCategoryPieCard';
import { BankAnalysisCategoryBarCard } from './components/analysis/BankAnalysisCategoryBarCard';
import { BankAnalysisCategoryTableCard } from './components/analysis/BankAnalysisCategoryTableCard';
import { BankAnalysisDepositsTableCard } from './components/analysis/BankAnalysisDepositsTableCard';
import { BankAnalysisPosTerminalsCard } from './components/analysis/BankAnalysisPosTerminalsCard';
import { BankAnalysisCardsToolbar } from './components/analysis/BankAnalysisCardsToolbar';

export default function BankStatementAnalysisCardsTab({
  statement,
  summaryByCategory: summaryByCategoryIn,
  activeCards,
  availableToAdd,
  addCard,
  setCardToDelete,
  setCategoryFilter,
  setTypeFilter,
  setActiveTab,
  categories = [],
  showToast,
  onSaveTxCategory,
}: BankStatementAnalysisCardsTabProps) {
  const summaryByCategory: Record<string, BankCategoryAgg> = summaryByCategoryIn ?? {};
  const { t, lang } = useTranslation();
  const moneyLang = lang as MoneyLang;
  const txs = useMemo<readonly BankTransactionLite[]>(() => statement?.transactions ?? [], [statement?.transactions]);
  const [addOpen, setAddOpen] = useState(false);
  const [pieMode, setPieMode] = useState<PieDisplayMode>('combined');
  const [pieDrilldownCategory, setPieDrilldownCategory] = useState<string | null>(null);

  const derived = useBankAnalysisDerived(
    txs,
    summaryByCategory,
    pieMode,
    t('uncategorized'),
  );

  const removeLabel = t('bankRemoveCard');
  const onRemoveCard = (id: AnalysisCardId) => setCardToDelete(id);

  const renderCard = (cardId: AnalysisCardId): React.ReactNode => {
    switch (cardId) {
      case 'cash_flow':
        return (
          <BankAnalysisCashFlowCard
            cardId={cardId}
            dailyData={derived.dailyData}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
          />
        );
      case 'alerts':
        return (
          <BankAnalysisAlertsCard
            cardId={cardId}
            alerts={derived.alerts}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
            setTypeFilter={setTypeFilter}
            setActiveTab={setActiveTab}
          />
        );
      case 'pos_hint':
        return (
          <BankAnalysisPosHintCard
            cardId={cardId}
            posCount={derived.posCount}
            txTotal={txs.length}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
          />
        );
      case 'category_pie':
        return (
          <BankAnalysisCategoryPieCard
            cardId={cardId}
            pieMode={pieMode}
            setPieMode={setPieMode}
            pieDisplayData={derived.pieDisplayData}
            pieGrandTotals={derived.pieGrandTotals}
            summaryKeysLen={Object.keys(summaryByCategory).length}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
            setPieDrilldownCategory={setPieDrilldownCategory}
          />
        );
      case 'category_bar':
        return (
          <BankAnalysisCategoryBarCard
            cardId={cardId}
            barRowsDebit={derived.barRowsDebit}
            barRowsCredit={derived.barRowsCredit}
            barDebitAxisW={derived.barDebitAxisW}
            barCreditAxisW={derived.barCreditAxisW}
            moneyLang={moneyLang}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
          />
        );
      case 'category_table':
        return (
          <BankAnalysisCategoryTableCard
            cardId={cardId}
            categoryRows={derived.categoryRows}
            totalDebit={derived.totalDebit}
            totalCredit={derived.totalCredit}
            moneyLang={moneyLang}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
            setCategoryFilter={setCategoryFilter}
            setActiveTab={setActiveTab}
          />
        );
      case 'deposits_table':
        return (
          <BankAnalysisDepositsTableCard
            cardId={cardId}
            depositsByCategory={derived.depositsByCategory}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
            setCategoryFilter={setCategoryFilter}
            setTypeFilter={setTypeFilter}
            setActiveTab={setActiveTab}
          />
        );
      case 'pos_terminals':
        return (
          <BankAnalysisPosTerminalsCard
            cardId={cardId}
            posTerminals={derived.posTerminals}
            t={t}
            removeLabel={removeLabel}
            onRemoveCard={onRemoveCard}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-[18px]">
      <BankAnalysisCardsToolbar
        activeCount={activeCards.length}
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        availableToAdd={availableToAdd}
        addCard={addCard}
        addLabel={t('bankAddAnalysisCard')}
        t={t}
      />

      <div className="grid nx-bank-cards-grid">
        {activeCards.map((id) => {
          const card = renderCard(id as AnalysisCardId);
          if (!card) return null;
          const fullRow = ANALYSIS_CARD_FULL_WIDTH.has(id as AnalysisCardId);
          return (
            <div key={id} className={`nx-bank-card-cell${fullRow ? ' nx-bank-card-cell--full' : ''}`}>
              {card}
            </div>
          );
        })}
      </div>

      {!activeCards.length && (
        <div className="text-center text-noorix-muted p-12">
          <div className="mb-4 text-[40px]" />
          <p className="text-[15px] font-semibold">{t('bankNoCardsPickAbove')}</p>
        </div>
      )}

      <BankStatementPieDrilldownModal
        open={!!pieDrilldownCategory}
        onClose={() => setPieDrilldownCategory(null)}
        categoryName={pieDrilldownCategory}
        transactions={txs}
        categories={categories}
        uncategorizedLabel={t('uncategorized')}
        t={t}
        onSaveTxCategory={onSaveTxCategory}
        showToast={showToast}
      />
    </div>
  );
}
