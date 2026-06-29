import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Button, FmtNum } from '../../../../../ui';
import type { AnalysisCardId, PieDisplayMode, PieSliceRow } from '../../bankAnalysisTab.types';
import { pieSliceFill } from '../../bankAnalysisHelpers';
import { BankAnalysisCardShell } from './BankAnalysisCardShell';
import { BankAnalysisPieTooltip } from './BankAnalysisPieTooltip';

export function BankAnalysisCategoryPieCard({
  cardId,
  pieMode,
  setPieMode,
  pieDisplayData,
  pieGrandTotals,
  summaryKeysLen,
  t,
  removeLabel,
  onRemoveCard,
  setPieDrilldownCategory,
}: {
  cardId: AnalysisCardId;
  pieMode: PieDisplayMode;
  setPieMode: (m: PieDisplayMode) => void;
  pieDisplayData: PieSliceRow[];
  pieGrandTotals: { totalDebit: number; totalCredit: number; totalVolume: number };
  summaryKeysLen: number;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
  setPieDrilldownCategory: (name: string | null) => void;
}) {
  if (summaryKeysLen === 0) return null;

  const centerTitle =
    pieMode === 'combined'
      ? t('bankPieCenterVolume')
      : pieMode === 'debit'
        ? t('bankPieCenterWithdrawals')
        : t('bankPieCenterRevenue');
  const centerMain =
    pieMode === 'combined'
      ? pieGrandTotals.totalVolume
      : pieMode === 'debit'
        ? pieGrandTotals.totalDebit
        : pieGrandTotals.totalCredit;

  const modes: PieDisplayMode[] = ['combined', 'debit', 'credit'];
  const displayedShareLabel = t('bankPieDisplayedShare') === 'bankPieDisplayedShare'
    ? 'النسبة من المعروض'
    : t('bankPieDisplayedShare');

  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardCategoryPie')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      <div className="flex items-center gap-8 flex flex-wrap mb-3.5">
        <span className="text-[12px] font-bold text-noorix-muted">{t('bankPieViewMode')}</span>
        {modes.map((m) => (
          <Button
            key={m}
            size="sm"
            variant={pieMode === m ? 'primary' : 'default'}
            onClick={() => setPieMode(m)}
          >
            {t(`bankPieMode_${m}`)}
          </Button>
        ))}
      </div>
      <p className="text-[12px] text-noorix-muted m-0 mb-3.5 nx-line-145">
        {t('bankPieLegendHint')}{' '}
        <span className="font-semibold text-noorix-text">({displayedShareLabel} · Top 10)</span>
      </p>
      <div className="flex flex-wrap gap-6 items-stretch">
        <div className="nx-pie-chart-wrap">
          {pieDisplayData.length > 0 ? (
            <div className="nx-pie-center-label">
              <div className="text-noorix-muted font-semibold text-[10px] nx-line-145">{centerTitle}</div>
              <div className="font-extrabold text-noorix-text nx-ltr mt-1 text-[17px]">
                <FmtNum n={centerMain} />
              </div>
              {pieMode === 'combined' && (pieGrandTotals.totalDebit > 0 || pieGrandTotals.totalCredit > 0) ? (
                <div className="text-[10px] mt-[6px] leading-[1.35]">
                  <div className="text-noorix-red nx-ltr">
                    <FmtNum n={pieGrandTotals.totalDebit} />
                  </div>
                  <div className="text-noorix-green nx-ltr">
                    <FmtNum n={pieGrandTotals.totalCredit} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {pieDisplayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieDisplayData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={76}
                  outerRadius={120}
                  paddingAngle={2}
                  cursor="pointer"
                  isAnimationActive={false}
                  label={(props: { percent?: number }) =>
                    (props.percent ?? 0) > 0.05 ? `${((props.percent ?? 0) * 100).toFixed(0)}%` : ''
                  }
                  labelLine={{ stroke: 'var(--noorix-text-muted-2)', strokeWidth: 1 }}
                  onClick={(_, index: number) => {
                    const item = pieDisplayData[index];
                    if (item?.name) setPieDrilldownCategory(item.name);
                  }}
                >
                  {pieDisplayData.map((item, i) => (
                    <Cell
                      key={item.name}
                      fill={pieSliceFill(pieMode, i, item)}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={(tipProps) => (
                    <BankAnalysisPieTooltip
                      active={tipProps.active}
                      payload={tipProps.payload}
                      pieMode={pieMode}
                      t={t}
                    />
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center bg-noorix-bg-muted rounded-xl text-[14px] text-noorix-muted h-[320px] nx-pie-empty-box">
              {t('bankNoCategoryData')}
            </div>
          )}
        </div>
        <div className="flex flex-col nx-pie-legend-aside">
          <div className="mb-2.5 flex items-center justify-between gap-2 text-[12px] font-bold text-noorix-muted">
            <span>{t('bankPieCategoryKey')}</span>
            <span className="text-[11px] font-semibold text-noorix-muted">{displayedShareLabel}</span>
          </div>
          <div className="rounded-xl p-3 bg-noorix-bg-muted flex-1 min-w-0 grid gap-2 border border-noorix-border">
            {pieDisplayData.length === 0 ? (
              <span className="text-[12px] text-noorix-muted text-center p-3">{t('bankNoCategoryData')}</span>
            ) : (
              pieDisplayData.map((item, i) => {
                const dot = pieSliceFill(pieMode, i, item);
                return (
                  <Button
                    key={item.name}
                    variant="ghost"
                    className="bank-pie-legend-row nx-bank-pie-legend-btn flex flex-col w-full text-[13px] text-end"
                    onClick={() => setPieDrilldownCategory(item.name)}
                  >
                    <div className="flex items-center gap-10 w-full">
                      <span className="nx-bank-dot-10" style={{ background: dot }} />
                      <span className="flex-1 min-w-0 truncate font-semibold">{item.name}</span>
                      <span className="text-noorix-muted shrink-0 text-[12px]">{item.percent}%</span>
                      <FmtNum n={item.value} className="font-extrabold nx-ltr shrink-0 text-[13px]" />
                    </div>
                    {pieMode === 'combined' ? (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-noorix-muted ps-5">
                        <span className="text-noorix-red">
                          {t('bankStatementColDebit')}:{' '}
                          <strong className="nx-ltr">
                            <FmtNum n={item.debit} />
                          </strong>
                        </span>
                        <span className="text-noorix-green">
                          {t('bankStatementColCredit')}:{' '}
                          <strong className="nx-ltr">
                            <FmtNum n={item.credit} />
                          </strong>
                        </span>
                      </div>
                    ) : null}
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </BankAnalysisCardShell>
  );
}
