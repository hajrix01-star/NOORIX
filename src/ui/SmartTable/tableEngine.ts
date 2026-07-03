import { useMemo } from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
  type SortingState,
  type Table,
} from '@tanstack/react-table';
import type { SmartTableColumn } from './types';
import { columnLabel } from './columnUtils';

export type SmartTableEngineSortDir = 'asc' | 'desc' | string;

export type SmartTableEngineRow<TRow> = {
  id: string;
  index: number;
  original: TRow;
  tanstackRow: Row<TRow>;
};

export type SmartTableEngineColumnState = {
  isSorted: boolean;
  sortDir: 'asc' | 'desc' | undefined;
  canSort: boolean;
  ariaSort: 'ascending' | 'descending' | 'none';
  sortIndicator: string;
};

export type SmartTableEnginePagination = {
  page: number;
  safePageSize: number;
  totalPages: number;
  pageIndex: number;
};

export type SmartTableEngineResult<TRow> = {
  table: Table<TRow>;
  rows: SmartTableEngineRow<TRow>[];
  columns: SmartTableColumn<TRow>[];
  pagination: SmartTableEnginePagination;
  getColumnState: (key: string) => SmartTableEngineColumnState;
  toggleSort: (key: string) => void;
  setPage: (page: number) => void;
};

function toSortingState(sortKey: string | undefined, sortDir: SmartTableEngineSortDir | undefined): SortingState {
  if (!sortKey) return [];
  return [{ id: sortKey, desc: sortDir !== 'asc' }];
}

function toPaginationState(page: number, safePageSize: number): PaginationState {
  return {
    pageIndex: Math.max(0, page - 1),
    pageSize: safePageSize,
  };
}

export function useSmartTableEngine<TRow extends Record<string, any>>({
  columns,
  data,
  sortKey,
  sortDir = 'desc',
  page = 1,
  pageSize = 50,
  total = data.length,
  onSort,
  onPageChange,
}: {
  columns: SmartTableColumn<TRow>[];
  data: TRow[];
  sortKey?: string;
  sortDir?: SmartTableEngineSortDir;
  page?: number;
  pageSize?: number;
  total?: number;
  onSort?: (key: string) => void;
  onPageChange?: (page: number) => void;
}): SmartTableEngineResult<TRow> {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const pagination = useMemo(
    () => toPaginationState(page, safePageSize),
    [page, safePageSize],
  );
  const sorting = useMemo(() => toSortingState(sortKey, sortDir), [sortKey, sortDir]);

  const columnDefs = useMemo<Array<ColumnDef<TRow, unknown>>>(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => row[col.key],
        header: () => columnLabel(col),
        enableSorting: Boolean(col.sortable),
        meta: { noorixColumn: col },
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
    state: {
      pagination,
      sorting,
    },
  });

  const rows = table.getRowModel().rows.map((row) => ({
    id: row.id,
    index: row.index,
    original: row.original,
    tanstackRow: row,
  }));

  const getColumnState = (key: string): SmartTableEngineColumnState => {
    const column = table.getColumn(key);
    const isSorted = sortKey === key;
    const normalizedSortDir = isSorted && sortDir === 'asc' ? 'asc' : (isSorted ? 'desc' : undefined);

    return {
      isSorted,
      sortDir: normalizedSortDir,
      canSort: Boolean(column?.getCanSort() && onSort),
      ariaSort: isSorted ? (normalizedSortDir === 'asc' ? 'ascending' : 'descending') : 'none',
      sortIndicator: isSorted ? (normalizedSortDir === 'asc' ? '▲' : '▼') : '⇅',
    };
  };

  const toggleSort = (key: string) => {
    if (table.getColumn(key)?.getCanSort()) {
      onSort?.(key);
    }
  };

  const setPage = (nextPage: number) => {
    if (nextPage >= 1 && nextPage <= totalPages) {
      onPageChange?.(nextPage);
    }
  };

  return {
    table,
    rows,
    columns,
    pagination: {
      page,
      safePageSize,
      totalPages,
      pageIndex: pagination.pageIndex,
    },
    getColumnState,
    toggleSort,
    setPage,
  };
}
