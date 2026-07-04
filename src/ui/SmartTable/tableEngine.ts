import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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
export type SmartTableEngineMode = 'manual' | 'client';

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
  canPreviousPage: boolean;
  canNextPage: boolean;
  firstPage: number;
  previousPage: number;
  nextPage: number;
  lastPage: number;
};

export type SmartTableEngineSearch = {
  value: string;
  setValue: (value: string) => void;
};

export type SmartTableEngineResult<TRow> = {
  table: Table<TRow>;
  rows: SmartTableEngineRow<TRow>[];
  columns: SmartTableColumn<TRow>[];
  pagination: SmartTableEnginePagination;
  search: SmartTableEngineSearch;
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

function cellMatchesQuery(value: unknown, query: string) {
  return String(value ?? '').toLowerCase().includes(query);
}

export function useSmartTableEngine<TRow extends Record<string, any>>({
  columns,
  data,
  sortKey,
  sortDir = 'desc',
  page = 1,
  pageSize = 50,
  total = data.length,
  sortingMode = 'manual',
  paginationMode = 'manual',
  filteringMode = 'manual',
  searchValue = '',
  onSearchChange,
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
  sortingMode?: SmartTableEngineMode;
  paginationMode?: SmartTableEngineMode;
  filteringMode?: SmartTableEngineMode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSort?: (key: string) => void;
  onPageChange?: (page: number) => void;
}): SmartTableEngineResult<TRow> {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const [clientSorting, setClientSorting] = useState<SortingState>(() => toSortingState(sortKey, sortDir));
  const [clientPagination, setClientPagination] = useState<PaginationState>(() => toPaginationState(page, safePageSize));
  const [clientSearchValue, setClientSearchValue] = useState(searchValue);

  const controlledPagination = useMemo(
    () => toPaginationState(page, safePageSize),
    [page, safePageSize],
  );
  const controlledSorting = useMemo(() => toSortingState(sortKey, sortDir), [sortKey, sortDir]);
  const pagination = paginationMode === 'client' && !onPageChange ? clientPagination : controlledPagination;
  const sorting = sortingMode === 'client' && !onSort ? clientSorting : controlledSorting;
  const globalFilter = filteringMode === 'client' && !onSearchChange ? clientSearchValue : searchValue;

  useEffect(() => {
    if (paginationMode === 'client' && !onPageChange) {
      setClientPagination((current) => (
        current.pageSize === safePageSize ? current : { ...current, pageSize: safePageSize }
      ));
    }
  }, [onPageChange, paginationMode, safePageSize]);

  useEffect(() => {
    if (sortingMode !== 'client' || onSort) {
      setClientSorting(controlledSorting);
    }
  }, [controlledSorting, onSort, sortingMode]);

  useEffect(() => {
    if (paginationMode !== 'client' || onPageChange) {
      setClientPagination(controlledPagination);
    }
  }, [controlledPagination, onPageChange, paginationMode]);

  useEffect(() => {
    if (filteringMode !== 'client' || onSearchChange) {
      setClientSearchValue(searchValue);
    }
  }, [filteringMode, onSearchChange, searchValue]);

  const columnDefs = useMemo<Array<ColumnDef<TRow, unknown>>>(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => row[col.key],
        header: () => columnLabel(col),
        enableSorting: Boolean(col.sortable),
        enableGlobalFilter: col.key !== 'actions',
        meta: { noorixColumn: col },
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: filteringMode === 'client' ? getFilteredRowModel() : undefined,
    getSortedRowModel: sortingMode === 'client' ? getSortedRowModel() : undefined,
    getPaginationRowModel: paginationMode === 'client' ? getPaginationRowModel() : undefined,
    manualFiltering: filteringMode === 'manual',
    manualPagination: paginationMode === 'manual',
    manualSorting: sortingMode === 'manual',
    pageCount: paginationMode === 'manual' ? totalPages : undefined,
    state: {
      globalFilter,
      pagination,
      sorting,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const query = String(filterValue ?? '').trim().toLowerCase();
      return !query || cellMatchesQuery(row.getValue(columnId), query);
    },
    onGlobalFilterChange: (value) => {
      const next = String(value ?? '');
      if (onSearchChange) {
        onSearchChange(next);
      } else {
        setClientSearchValue(next);
      }
      if (paginationMode === 'client' && !onPageChange) {
        setClientPagination((current) => ({ ...current, pageIndex: 0 }));
      }
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      if (onPageChange) {
        onPageChange(next.pageIndex + 1);
        return;
      }
      setClientPagination(next);
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setClientSorting(next);
    },
  });

  const rows = table.getRowModel().rows.map((row) => ({
    id: row.id,
    index: row.index,
    original: row.original,
    tanstackRow: row,
  }));

  const getColumnState = useCallback((key: string): SmartTableEngineColumnState => {
    const column = table.getColumn(key);
    const activeSort = sorting.find((item) => item.id === key);
    const isSorted = Boolean(activeSort);
    const normalizedSortDir = isSorted && activeSort?.desc === false ? 'asc' : (isSorted ? 'desc' : undefined);

    return {
      isSorted,
      sortDir: normalizedSortDir,
      canSort: Boolean(column?.getCanSort() && (onSort || sortingMode === 'client')),
      ariaSort: isSorted ? (normalizedSortDir === 'asc' ? 'ascending' : 'descending') : 'none',
      sortIndicator: isSorted ? (normalizedSortDir === 'asc' ? '^' : 'v') : '-',
    };
  }, [onSort, sorting, sortingMode, table]);

  const toggleSort = useCallback((key: string) => {
    const column = table.getColumn(key);
    if (!column?.getCanSort()) return;
    if (onSort) {
      onSort(key);
      return;
    }
    if (sortingMode === 'client') {
      column.toggleSorting();
    }
  }, [onSort, sortingMode, table]);

  const setPage = useCallback((nextPage: number) => {
    const pageCount = table.getPageCount();
    if (nextPage < 1 || nextPage > pageCount) return;
    if (onPageChange) {
      onPageChange(nextPage);
      return;
    }
    if (paginationMode === 'client') {
      table.setPageIndex(nextPage - 1);
    }
  }, [onPageChange, paginationMode, table]);

  const pageCount = table.getPageCount();
  const currentPage = pagination.pageIndex + 1;

  return {
    table,
    rows,
    columns,
    pagination: {
      page: currentPage,
      safePageSize,
      totalPages: pageCount,
      pageIndex: pagination.pageIndex,
      canPreviousPage: table.getCanPreviousPage(),
      canNextPage: table.getCanNextPage(),
      firstPage: 1,
      previousPage: Math.max(1, currentPage - 1),
      nextPage: Math.min(pageCount, currentPage + 1),
      lastPage: pageCount,
    },
    search: {
      value: String(globalFilter ?? ''),
      setValue: table.setGlobalFilter,
    },
    getColumnState,
    toggleSort,
    setPage,
  };
}
