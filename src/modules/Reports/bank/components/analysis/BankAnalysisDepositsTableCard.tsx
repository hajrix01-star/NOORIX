import React from 'react';
import { FmtNum } from '../../../../../ui';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { ANALYSIS_CARD_COLORS } from '../../bankAnalysisConstants';
import { BankAnalysisCardShell, BankAnalysisProgressBar } from './BankAnalysisCardShell';

export function BankAnalysisDepositsTableCard({
  cardId,
  depositsByCategory,
  t,
  removeLabel,
  onRemoveCard,
  setCategoryFilter,
  setTypeFilter,
  setActiveTab,
}: {
  cardId: AnalysisCardId;
  depositsByCategory: Array<{ name: string; count: number; total: number }>;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
  setCategoryFilter: (name: string) => void;
  setTypeFilter: (v: string) => void;
  setActiveTab: (tab: string) => void;
}) {
  const totalDep = depositsByCategory.reduce((s, r) => s + r.total, 0);

  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardDepositsTable')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      {depositsByCategory.length === 0 ? (
        <p className="text-noorix-muted text-[13px]">لا توجد إيداعات.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-[12px] nx-table-collapse nx-table-min-400">
            <thead>
              <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
                <th className="font-bold nx-th-pad">#</th>
                <th className="font-bold nx-th-pad">الفئة</th>
                <th className="font-bold nx-th-pad-center">العمليات</th>
                <th className="font-bold text-noorix-green nx-th-pad">إجمالي الإيداعات</th>
                <th className="font-bold nx-th-pad min-w-[120px]">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {depositsByCategory.map((row, i) => {
                const pct = totalDep > 0 ? (row.total / totalDep) * 100 : 0;
                return (
                  <tr
                    key={row.name}
                    className={`nx-bank-row nx-bank-row--click ${i % 2 === 0 ? 'nx-bank-row--a' : 'nx-bank-row--b'}`}
                    onClick={() => {
                      setCategoryFilter(row.name);
                      setTypeFilter('credit');
                      setActiveTab('transactions');
                    }}
                  >
                    <td className="text-noorix-muted font-bold nx-td-pad-9">{i + 1}</td>
                    <td className="nx-td-pad-9">
                      <div className="flex items-center gap-7">
                        <span
                          className="nx-bank-dot-8"
                          style={{ background: ANALYSIS_CARD_COLORS[i % ANALYSIS_CARD_COLORS.length] }}
                        />
                        {row.name}
                      </div>
                    </td>
                    <td className="text-center text-noorix-muted nx-td-pad-9">{row.count}</td>
                    <td className="text-end nx-ltr text-noorix-green font-bold nx-td-pad-9">
                      <FmtNum n={row.total} />
                    </td>
                    <td className="nx-td-pad-9">
                      <div className="flex items-center gap-8">
                        <BankAnalysisProgressBar value={row.total} max={totalDep} color="#16a34a" />
                        <span className="text-noorix-muted shrink-0 min-w-[38px] nx-ltr text-start">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-extrabold bg-noorix-bg-muted border-t-2 border-noorix-border">
                <td colSpan={2} className="nx-td-pad-10">
                  الإجمالي
                </td>
                <td className="text-center nx-td-pad-10">
                  {depositsByCategory.reduce((s, r) => s + r.count, 0)}
                </td>
                <td className="text-end nx-ltr text-noorix-green nx-td-pad-10">
                  <FmtNum n={totalDep} />
                </td>
                <td className="text-noorix-muted nx-td-pad-10">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </BankAnalysisCardShell>
  );
}
