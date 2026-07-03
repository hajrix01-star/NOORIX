import { memo } from 'react';
import type React from 'react';
import Input from '../Input';
import type { SmartTableColumn } from './types';
import SmartTableColumnVisibility from './SmartTableColumnVisibility';

export type SmartTableHeaderProps = {
  title?: React.ReactNode;
  badge?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearchInHeader: boolean;
  tableId?: string;
  showColumnVisibility: boolean;
  hideableCols: SmartTableColumn<any>[];
  hiddenCols: Set<string>;
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
  t: (key: string, ...args: unknown[]) => string;
};

const SmartTableHeader = memo(function SmartTableHeader({
  title,
  badge,
  searchValue,
  onSearchChange,
  showSearchInHeader,
  tableId,
  showColumnVisibility,
  hideableCols,
  hiddenCols,
  onToggleColumn,
  onResetColumns,
  t,
}: SmartTableHeaderProps) {
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
            onChange={(e: any) => onSearchChange(e.target.value)}
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
            onToggleColumn={onToggleColumn}
            onResetColumns={onResetColumns}
          />
        )}
      </div>
    </div>
  );
});

export default SmartTableHeader;
