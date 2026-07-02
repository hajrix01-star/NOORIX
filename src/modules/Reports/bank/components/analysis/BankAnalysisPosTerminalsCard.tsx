import React from 'react';
import { FmtNum, SimpleTable } from '../../../../../ui';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { ANALYSIS_CARD_COLORS } from '../../bankAnalysisConstants';
import { BankAnalysisCardShell, BankAnalysisProgressBar } from './BankAnalysisCardShell';

type PosTerminal = { terminalId: string; count: number; total: number };
type PosTerminalRow = PosTerminal & { id: string; rowNumber: number; pct: number };

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
  const rows: PosTerminalRow[] = posTerminals.slice(0, 8).map((term, index) => ({
    ...term,
    id: term.terminalId,
    rowNumber: index + 1,
    pct: totalPOS > 0 ? (term.total / totalPOS) * 100 : 0,
  }));

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
          <SimpleTable<PosTerminalRow>
            data={rows}
            tableClassName="text-[12px] nx-table-collapse"
            frameClassName="rounded-lg border border-noorix-border"
            getRowClassName={(_row, index) => `nx-bank-row ${index % 2 ? 'nx-bank-row--b' : 'nx-bank-row--a'}`}
            columns={[
              { key: 'rowNumber', label: '#', cellClassName: 'font-bold text-noorix-muted nx-td-pad' },
              {
                key: 'terminalId',
                label: 'الجهاز',
                cellClassName: 'nx-td-pad',
                render: (value) => <code className="nx-code-inline">...{String(value).slice(-8)}</code>,
              },
              { key: 'count', label: 'العمليات', align: 'center', cellClassName: 'text-center nx-td-pad' },
              {
                key: 'total',
                label: 'المبلغ',
                numeric: true,
                cellClassName: 'text-end nx-ltr font-extrabold text-noorix-green nx-td-pad',
                render: (value) => <FmtNum n={Number(value)} />,
              },
              {
                key: 'pct',
                label: 'النسبة',
                cellClassName: 'text-end nx-td-pad',
                render: (value, row, index) => (
                  <div className="flex items-center justify-end gap-2">
                    <BankAnalysisProgressBar
                      value={row.total}
                      max={totalPOS}
                      color={ANALYSIS_CARD_COLORS[index % ANALYSIS_CARD_COLORS.length]}
                    />
                    <span className="text-[11px] text-noorix-muted min-w-[36px] nx-ltr text-start">
                      {Number(value).toFixed(1)}%
                    </span>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </BankAnalysisCardShell>
  );
}
