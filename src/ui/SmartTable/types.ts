import type { CSSProperties, ReactNode } from 'react';

export type SmartTableDataMode = 'manual' | 'client';

export type SmartTableColumn<TRow = any> = {
  key: string;
  kind?: 'id' | 'text' | 'date' | 'money' | 'number' | 'status' | 'actions' | 'meta';
  label?: ReactNode;
  header?: ReactNode;
  align?: string;
  numeric?: boolean;
  sortable?: boolean;
  shrink?: boolean;
  width?: CSSProperties['width'];
  minWidth?: number | string;
  maxWidth?: number | string;
  cellClassName?: string;
  render?: (value: unknown, row: TRow, index: number) => ReactNode;
};

export type SmartTableFooterSegment = {
  keys: string[];
  content?: ReactNode;
  className?: string;
};

export type SmartTableProps<TRow = any> = {
  columns?: SmartTableColumn<TRow>[];
  data?: TRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  dataMode?: SmartTableDataMode;
  sortingMode?: SmartTableDataMode;
  paginationMode?: SmartTableDataMode;
  filteringMode?: SmartTableDataMode;
  onPageChange?: (p: number) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  footerCells?: ReactNode;
  footerRow?: SmartTableFooterSegment[] | null;
  title?: ReactNode;
  badge?: ReactNode;
  searchValue?: string;
  onSearchChange?: (q: string) => void;
  showSearchInHeader?: boolean;
  emptyMessage?: string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc' | string;
  onSort?: (key: string) => void;
  children?: ReactNode;
  footer?: ReactNode;
  tableMinWidth?: number | string;
  compact?: boolean;
  showRowNumbers?: boolean;
  innerPadding?: number | string;
  tableLayout?: CSSProperties['tableLayout'];
  rowNumberWidth?: number | string;
  getRowClassName?: (row: TRow, index: number) => string | undefined;
  getRowStyle?: (row: TRow, index: number) => CSSProperties | undefined;
  isRowExpanded?: (row: TRow, index: number) => boolean;
  renderExpandedRow?: (row: TRow, index: number) => ReactNode;
  renderMobileCard?: (row: TRow, index: number) => ReactNode;
  stripeMobileCards?: boolean;
  renderCompactRow?: (row: TRow, index: number) => ReactNode;
  stickyActionColumn?: boolean;
  tableId?: string;
  frameClassName?: string;
  keyExtractor?: (row: TRow, index: number) => string | number;
};
