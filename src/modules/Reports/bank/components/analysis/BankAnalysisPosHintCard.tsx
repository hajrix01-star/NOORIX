import React from 'react';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { BankAnalysisCardShell } from './BankAnalysisCardShell';

export function BankAnalysisPosHintCard({
  cardId,
  posCount,
  txTotal,
  t,
  removeLabel,
  onRemoveCard,
}: {
  cardId: AnalysisCardId;
  posCount: number;
  txTotal: number;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
}) {
  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardPosHint')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      <div className="flex gap-4 flex flex-wrap">
        <div className="bg-noorix-bg-muted border border-noorix-border nx-stat-tile">
          <div className="font-extrabold text-noorix-blue text-[28px]">{posCount}</div>
          <div className="text-[11px] text-noorix-muted mt-1">عملية تشبه نقاط البيع</div>
        </div>
        <div className="bg-noorix-bg-muted border border-noorix-border nx-stat-tile">
          <div className="font-extrabold text-[28px] text-noorix-violet">{txTotal}</div>
          <div className="text-[11px] text-noorix-muted mt-1">إجمالي العمليات</div>
        </div>
      </div>
    </BankAnalysisCardShell>
  );
}
