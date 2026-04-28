import React from 'react';
import type { MoneyLang } from '../../../../../utils/money';
import { formatNumber } from '../../../../../utils/money';
import { FmtNum } from '../../../../../ui';
import type { AnalysisCardId, CategoryTableRow } from '../../bankAnalysisTab.types';
import { ANALYSIS_CARD_COLORS } from '../../bankAnalysisConstants';
import { BankAnalysisCardShell, BankAnalysisProgressBar } from './BankAnalysisCardShell';

export function BankAnalysisCategoryTableCard({
  cardId,
  categoryRows,
  totalDebit,
  totalCredit,
  moneyLang,
  t,
  removeLabel,
  onRemoveCard,
  setCategoryFilter,
  setActiveTab,
}: {
  cardId: AnalysisCardId;
  categoryRows: CategoryTableRow[];
  totalDebit: number;
  totalCredit: number;
  moneyLang: MoneyLang;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
  setCategoryFilter: (name: string) => void;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardCategoryTable')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      <div className="overflow-auto">
        <table className="w-full text-[12px] nx-table-collapse nx-table-min-540">
          <thead>
            <tr className="bg-noorix-bg-muted border-b-2 border-noorix-border">
              <th className="font-bold whitespace-nowrap nx-th-pad">الفئة</th>
              <th className="font-bold nx-th-pad-center">العمليات</th>
              <th className="font-bold text-noorix-red whitespace-nowrap nx-th-pad">السحوبات</th>
              <th className="font-bold text-noorix-green whitespace-nowrap nx-th-pad">الإيداعات</th>
              <th className="font-bold nx-th-pad min-w-[120px]">النسبة (سحب)</th>
            </tr>
          </thead>
          <tbody>
            {categoryRows.map((row, i) => (
              <tr
                key={row.name}
                className={`nx-bank-row nx-bank-row--click ${i % 2 === 0 ? 'nx-bank-row--a' : 'nx-bank-row--b'}`}
                onClick={() => {
                  setCategoryFilter(row.name);
                  setActiveTab('transactions');
                }}
                title="انقر لعرض عمليات هذه الفئة"
              >
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
                <td
                  className={`text-end nx-ltr nx-td-pad-9 ${
                    row.debit > 0 ? 'text-noorix-red font-bold' : 'text-noorix-muted font-normal'
                  }`}
                >
                  {row.debit > 0 ? formatNumber(row.debit, moneyLang) : '—'}
                </td>
                <td
                  className={`text-end nx-ltr nx-td-pad-9 ${
                    row.credit > 0 ? 'text-noorix-green font-bold' : 'text-noorix-muted font-normal'
                  }`}
                >
                  {row.credit > 0 ? formatNumber(row.credit, moneyLang) : '—'}
                </td>
                <td className="nx-td-pad-9">
                  <div className="flex items-center gap-8">
                    <BankAnalysisProgressBar
                      value={row.debit}
                      max={totalDebit}
                      color={ANALYSIS_CARD_COLORS[i % ANALYSIS_CARD_COLORS.length]}
                    />
                    <span className="text-noorix-muted shrink-0 min-w-[38px] nx-ltr text-start">
                      {row.debitPct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-extrabold bg-noorix-bg-muted border-t-2 border-noorix-border">
              <td className="nx-td-pad-10">الإجمالي</td>
              <td className="text-center nx-td-pad-10">
                {categoryRows.reduce((s, r) => s + r.count, 0)}
              </td>
              <td className="text-end nx-ltr text-noorix-red nx-td-pad-10">
                <FmtNum n={totalDebit} />
              </td>
              <td className="text-end nx-ltr text-noorix-green nx-td-pad-10">
                <FmtNum n={totalCredit} />
              </td>
              <td className="text-noorix-muted nx-td-pad-10">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </BankAnalysisCardShell>
  );
}
