import React from 'react';
import { Button } from '../../../../../ui';
import type { AnalysisCardDef } from '../../bankAnalysisTab.types';

export function BankAnalysisCardsToolbar({
  activeCount,
  addOpen,
  setAddOpen,
  availableToAdd,
  addCard,
  addLabel,
  t,
}: {
  activeCount: number;
  addOpen: boolean;
  setAddOpen: React.Dispatch<React.SetStateAction<boolean>>;
  availableToAdd: AnalysisCardDef[];
  addCard: (id: string) => void;
  addLabel: string;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap bg-noorix-bg-muted border border-noorix-border rounded-xl gap-2.5 px-4 py-3">
      <span className="text-[13px] text-noorix-muted">{activeCount} بطاقة معروضة</span>
      <div className="nx-bank-add-wrap">
        <Button
          size="sm"
          onClick={() => setAddOpen((v) => !v)}
          disabled={availableToAdd.length === 0}
        >
          + {addLabel}
          {availableToAdd.length > 0 && (
            <span className="nx-pill-count">{availableToAdd.length}</span>
          )}
        </Button>
        {addOpen && availableToAdd.length > 0 && (
          <div className="bank-analysis-add-menu nx-bank-add-menu">
            {availableToAdd.map((c) => (
              <Button
                key={c.id}
                variant="ghost"
                className="bank-add-card-item nx-bank-add-menu-item flex items-center gap-2.5 w-full text-[13px] text-end border-b border-noorix-border"
                onClick={() => {
                  addCard(c.id);
                  setAddOpen(false);
                }}
              >
                <span>{c.icon}</span>
                <span>{t(c.nameKey)}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
