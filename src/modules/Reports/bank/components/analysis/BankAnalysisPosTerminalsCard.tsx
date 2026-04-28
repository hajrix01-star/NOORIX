import React from 'react';
import { FmtNum } from '../../../../../ui';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { ANALYSIS_CARD_COLORS } from '../../bankAnalysisConstants';
import { BankAnalysisCardShell, BankAnalysisProgressBar } from './BankAnalysisCardShell';

type PosTerminal = { terminalId: string; count: number; total: number };

export function BankAnalysisPosTerminalsCard({
  cardId,
  posTerminals,
  t,
  removeLabel,
  onRemoveCard,
}: {
  cardId: AnalysisCardId;
  posTerminals: PosTerminal[];
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
}) {
  const totalPOS = posTerminals.reduce((sum, row) => sum + row.total, 0);

  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardPosTerminals')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      {posTerminals.length === 0 ? (
        <p className="text-noorix-muted text-[13px]">لم يتم الكشف عن أجهزة نقاط بيع في هذا الكشف.</p>
      ) : (
        <div className="grid gap-3">
          <div className="nx-grid-auto-fill-140">
            <div className="bg-noorix-bg-muted border border-noorix-border rounded-xl text-center py-3 px-3.5">
              <div className="font-extrabold text-noorix-green text-[22px]">
                {posTerminals.reduce((s, x) => s + x.count, 0)}
              </div>
              <div className="text-[11px] text-noorix-muted mt-1">عدد العمليات</div>
            </div>
            <div className="bg-noorix-bg-muted border border-noorix-border rounded-xl text-center py-3 px-3.5">
              <div className="text-[18px] font-extrabold text-noorix-green nx-ltr">
                <FmtNum n={totalPOS} />
              </div>
              <div className="text-[11px] text-noorix-muted mt-1">إجمالي المبيعات</div>
            </div>
          </div>
          <div className="overflow-auto rounded-lg border border-noorix-border">
            <table className="w-full text-[12px] nx-table-collapse">
              <thead>
                <tr className="bg-noorix-bg-muted border-b border-noorix-border">
                  <th className="font-bold nx-th-pad w-10">#</th>
                  <th className="font-bold nx-th-pad">الجهاز</th>
                  <th className="font-bold nx-th-pad-center">العمليات</th>
                  <th className="font-bold nx-th-pad">المبلغ</th>
                  <th className="font-bold nx-th-pad">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {posTerminals.slice(0, 8).map((term, i) => {
                  const pct = totalPOS > 0 ? (term.total / totalPOS) * 100 : 0;
                  return (
                    <tr key={term.terminalId} className={`nx-bank-row ${i % 2 ? 'nx-bank-row--b' : 'nx-bank-row--a'}`}>
                      <td className="font-bold text-noorix-muted nx-td-pad">{i + 1}</td>
                      <td className="nx-td-pad">
                        <code className="nx-code-inline">…{term.terminalId.slice(-8)}</code>
                      </td>
                      <td className="text-center nx-td-pad">{term.count}</td>
                      <td className="text-end nx-ltr font-extrabold text-noorix-green nx-td-pad">
                        <FmtNum n={term.total} />
                      </td>
                      <td className="text-end nx-td-pad">
                        <div className="flex items-center justify-end gap-2">
                          <BankAnalysisProgressBar
                            value={term.total}
                            max={totalPOS}
                            color={ANALYSIS_CARD_COLORS[i % ANALYSIS_CARD_COLORS.length]}
                          />
                          <span className="text-[11px] text-noorix-muted min-w-[36px] nx-ltr text-start">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </BankAnalysisCardShell>
  );
}
