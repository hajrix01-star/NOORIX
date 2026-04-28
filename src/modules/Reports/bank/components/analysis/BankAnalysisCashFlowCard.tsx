import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { BankAnalysisCardShell } from './BankAnalysisCardShell';
import { BankAnalysisDailyTooltip } from './BankAnalysisDailyTooltip';

export function BankAnalysisCashFlowCard({
  cardId,
  dailyData,
  t,
  removeLabel,
  onRemoveCard,
}: {
  cardId: AnalysisCardId;
  dailyData: Array<Record<string, unknown>>;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
}) {
  if (dailyData.length < 2) return null;
  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardCashFlow')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      <div className="w-full h-[260px]">
        <ResponsiveContainer>
          <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradDeposits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradWithdrawals" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--noorix-accent-red)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--noorix-accent-red)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" vertical={false} />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 10 }}
              width={60}
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip content={<BankAnalysisDailyTooltip />} />
            <ReferenceLine y={0} stroke="var(--noorix-text-muted-2)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="deposits"
              stroke="#16a34a"
              strokeWidth={2}
              fill="url(#gradDeposits)"
              name="إيداعات"
            />
            <Area
              type="monotone"
              dataKey="withdrawals"
              stroke="var(--noorix-accent-red)"
              strokeWidth={2}
              fill="url(#gradWithdrawals)"
              name="سحوبات"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-6 mt-2.5 flex items-center">
        <div className="flex items-center gap-6 text-[12px]">
          <span className="nx-legend-dot nx-legend-dot--income" />
          <span>إيداعات</span>
        </div>
        <div className="flex items-center gap-6 text-[12px]">
          <span className="nx-legend-dot nx-legend-dot--expense" />
          <span>سحوبات</span>
        </div>
      </div>
    </BankAnalysisCardShell>
  );
}
