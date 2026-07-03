import { memo } from 'react';
import type React from 'react';
import { cn } from '../cn';

type EngineRow<TRow> = {
  original: TRow;
  index: number;
};

export type SmartTableResponsiveRowsProps<TRow = any> = {
  rows: Array<EngineRow<TRow>>;
  dataLength: number;
  emptyMsg: string;
  rowKey: (row: TRow, index: number) => React.Key;
};

export type SmartTableCompactRowsProps<TRow = any> = SmartTableResponsiveRowsProps<TRow> & {
  renderCompactRow: (row: TRow, index: number) => React.ReactNode;
};

export type SmartTableMobileCardsProps<TRow = any> = SmartTableResponsiveRowsProps<TRow> & {
  renderMobileCard: (row: TRow, index: number) => React.ReactNode;
  stripeMobileCards: boolean;
};

export const SmartTableCompactRows = memo(function SmartTableCompactRows<TRow = any>({
  rows,
  dataLength,
  emptyMsg,
  rowKey,
  renderCompactRow,
}: SmartTableCompactRowsProps<TRow>) {
  return (
    <div>
      {dataLength === 0 ? (
        <div className="text-center text-noorix-muted text-[13px] py-6 px-4">
          {emptyMsg}
        </div>
      ) : rows.map(({ original: row, index: i }) => (
        <div
          key={rowKey(row, i)}
          className={cn(
            'nx-compact-row',
            i % 2 === 1 ? 'nx-compact-row--stripe' : 'nx-compact-row--base',
          )}
        >
          {renderCompactRow(row, i)}
        </div>
      ))}
    </div>
  );
});

export const SmartTableMobileCards = memo(function SmartTableMobileCards<TRow = any>({
  rows,
  dataLength,
  emptyMsg,
  rowKey,
  renderMobileCard,
  stripeMobileCards,
}: SmartTableMobileCardsProps<TRow>) {
  return (
    <div className="flex flex-col gap-2 py-2 px-2 sm:px-3 min-w-0 max-w-full box-border">
      {dataLength === 0 ? (
        <div className="text-center text-noorix-muted text-[13px] py-6 px-4">
          {emptyMsg}
        </div>
      ) : rows.map(({ original: row, index: i }) => (
        <div
          key={rowKey(row, i)}
          className={cn(
            'nx-mobile-card-row px-4 py-3',
            stripeMobileCards
              ? (i % 2 === 1 ? 'nx-mobile-card-row--stripe' : 'nx-mobile-card-row--base')
              : 'nx-mobile-card-row--base',
          )}
        >
          {renderMobileCard(row, i)}
        </div>
      ))}
    </div>
  );
});
