import { memo } from 'react';
import type React from 'react';
import Input from '../Input';
import type { SmartTableColumn, SmartTableRow } from './types';
import SmartTableColumnVisibility from './SmartTableColumnVisibility';

export type SmartTableHeaderProps<TRow extends SmartTableRow = SmartTableRow> = {
  title?: React.ReactNode;
  badge?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearchInHeader: boolean;
  tableId?: string;
  showColumnVisibility: boolean;
  hideableCols: SmartTableColumn<TRow>[];
  hiddenCols: Set<string>;
  hasCustomColumnWidths: boolean;
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
  onResetColumnWidths: () => void;
  t: (key: string, ...args: unknown[]) => string;
};

function SmartTableHeaderInner<TRow extends SmartTableRow = SmartTableRow>({
  title,
  badge,
  searchValue,
  onSearchChange,
  showSearchInHeader,
  tableId,
  showColumnVisibility,
  hideableCols,
  hiddenCols,
  hasCustomColumnWidths,
  onToggleColumn,
  onResetColumns,
  onResetColumnWidths,
  t,
}: SmartTableHeaderProps<TRow>) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap px-4 py-2.5 border-b border-noorix-border">
      <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
        {title && <span className="font-bold text-[15px] shrink-0">{title}</span>}
        {badge && <div className="flex items-center gap-2 flex-wrap min-w-0">{badge}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onSearchChange && showSearchInHeader && (
          <Input
            type="search"
            value={searchValue ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            size="sm"
            className="noorix-table-search"
            aria-label={t('searchPlaceholder')}
          />
        )}
        {tableId && showColumnVisibility && (
          <SmartTableColumnVisibility
            columns={hideableCols}
            hiddenCols={hiddenCols}
            hasCustomColumnWidths={hasCustomColumnWidths}
            onToggleColumn={onToggleColumn}
            onResetColumns={onResetColumns}
            onResetColumnWidths={onResetColumnWidths}
          />
        )}
      </div>
    </div>
  );
}

const SmartTableHeader = memo(SmartTableHeaderInner) as typeof SmartTableHeaderInner;

export default SmartTableHeader;
