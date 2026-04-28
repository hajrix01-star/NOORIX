import React, { type ReactNode } from 'react';
import { Button } from '../../../../../ui';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';

export function BankAnalysisCardShell({
  cardId,
  title,
  icon,
  onRemove,
  removeLabel,
  children,
}: {
  cardId: AnalysisCardId;
  title: string;
  icon: string;
  onRemove: (id: AnalysisCardId) => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="noorix-surface-card nx-analysis-card">
      <div className="nx-analysis-card__head">
        <div className="nx-analysis-card__title-cluster">
          <span className="text-[20px] shrink-0 leading-none">{icon}</span>
          <span className="font-bold text-[15px] leading-[1.35]">{title}</span>
        </div>
        <Button size="sm" onClick={() => onRemove(cardId)} className="shrink-0 whitespace-nowrap">
          {removeLabel}
        </Button>
      </div>
      <div className="nx-analysis-card__body">{children}</div>
    </div>
  );
}

export function BankAnalysisProgressBar({
  value,
  color = 'var(--noorix-accent-blue)',
  max = 100,
}: {
  value: number;
  color?: string;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="nx-progress-track flex-1 min-w-0">
      <div className="nx-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
