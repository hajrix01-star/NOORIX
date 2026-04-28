import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { MoneyLang } from '../../../../../utils/money';
import { formatNumber } from '../../../../../utils/money';
import type { AnalysisCardId, BarRow } from '../../bankAnalysisTab.types';
import { BAR_CHART_TOOLTIP_STYLE } from '../../bankAnalysisConstants';
import { BankAnalysisCardShell } from './BankAnalysisCardShell';

export function BankAnalysisCategoryBarCard({
  cardId,
  barRowsDebit,
  barRowsCredit,
  barDebitAxisW,
  barCreditAxisW,
  moneyLang,
  t,
  removeLabel,
  onRemoveCard,
}: {
  cardId: AnalysisCardId;
  barRowsDebit: BarRow[];
  barRowsCredit: BarRow[];
  barDebitAxisW: number;
  barCreditAxisW: number;
  moneyLang: MoneyLang;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
}) {
  if (!barRowsDebit.length && !barRowsCredit.length) return null;

  const renderBarBlock = (rows: BarRow[], blockTitle: string, color: string, yAxisW: number) => {
    if (!rows.length) return null;
    const h = Math.max(168, 52 + rows.length * 46);
    return (
      <div className="mb-2">
        <div className="text-[12px] font-bold text-noorix-muted border-b border-noorix-border nx-bank-bar-section-hdr">
          {blockTitle}
        </div>
        <div className="w-full" style={{ height: h }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 32, top: 6, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--noorix-text-muted)' }}
                tickFormatter={(v: number) =>
                  Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                width={yAxisW}
                tick={{ fontSize: 12, fill: 'var(--noorix-text)' }}
                interval={0}
              />
              <Tooltip
                formatter={(v: unknown) => [formatNumber(Number(v ?? 0), moneyLang), blockTitle]}
                labelFormatter={(_label: unknown, p: ReadonlyArray<{ payload?: { fullName?: string } }>) =>
                  p?.[0]?.payload?.fullName ?? ''
                }
                contentStyle={BAR_CHART_TOOLTIP_STYLE}
              />
              <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardCategoryBar')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      {renderBarBlock(barRowsDebit, 'أعلى الفئات — السحوبات', 'var(--noorix-accent-red)', barDebitAxisW)}
      {renderBarBlock(barRowsCredit, 'أعلى الفئات — الإيداعات', 'var(--noorix-accent-green)', barCreditAxisW)}
      <div className="flex flex flex-wrap mt-4 border-t border-noorix-border nx-bank-bar-legend-row">
        <div className="flex items-center gap-8 text-[12px]">
          <span className="nx-legend-dot--bar nx-legend-dot--bar-red" />
          <span className="font-semibold">سحوبات</span>
        </div>
        <div className="flex items-center gap-8 text-[12px]">
          <span className="nx-legend-dot--bar nx-legend-dot--bar-green" />
          <span className="font-semibold">إيداعات</span>
        </div>
      </div>
    </BankAnalysisCardShell>
  );
}
