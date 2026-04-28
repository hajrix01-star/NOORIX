import React from 'react';
import { FmtNum } from '../../../../../ui';
import type { PieDisplayMode } from '../../bankAnalysisTab.types';

type PayloadEntry = {
  name?: string;
  value?: number;
  payload?: {
    fill?: string;
    debit?: number;
    credit?: number;
    percent?: string;
    count?: number;
  };
};

/** Tooltip مخصص للـ PieChart */
export function BankAnalysisPieTooltip({
  active,
  payload,
  pieMode,
  t,
}: {
  active?: boolean;
  payload?: unknown;
  pieMode: PieDisplayMode;
  t: (k: string) => string;
}) {
  const list = Array.isArray(payload) ? payload : [];
  if (!active || !list.length) return null;
  const d = list[0] as PayloadEntry;
  const p = d.payload ?? {};
  return (
    <div className="text-[12px] nx-rtl nx-recharts-tooltip-shell">
      <div className="font-bold text-noorix-text mb-1.5">{d.name}</div>
      {pieMode === 'combined' ? (
        <>
          <div className="text-noorix-red mb-[3px]">
            {t('bankStatementColDebit')}: <FmtNum n={Number(p.debit)} className="nx-num-bold" />
          </div>
          <div className="text-noorix-green mb-[3px]">
            {t('bankStatementColCredit')}: <FmtNum n={Number(p.credit)} className="nx-num-bold" />
          </div>
          <div className="font-bold mb-1 nx-recharts-tooltip-footer--loose">
            {t('bankPieCenterVolume')}: <FmtNum n={Number(d.value)} className="inline-block ltr" />
          </div>
        </>
      ) : (
        <div className="font-bold mb-1" style={{ color: p.fill }}>
          <FmtNum n={Number(d.value)} />
        </div>
      )}
      <div className="text-noorix-muted">{p.percent}%</div>
      {p.count != null ? (
        <div className="text-noorix-muted text-[11px] mt-1">
          {t('bankStatementTransactions')}: {p.count}
        </div>
      ) : null}
    </div>
  );
}
