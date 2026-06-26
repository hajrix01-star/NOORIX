import type { CSSProperties, ReactNode } from 'react';

/** عمود جدول ذكي — مرّر `TRow` من الشاشة لتضييق نوع الصف في `render` */
export type SmartTableColumn<TRow = any> = {
  key: string;
  label?: ReactNode;
  header?: ReactNode;
  align?: string;
  numeric?: boolean;
  sortable?: boolean;
  shrink?: boolean;
  width?: CSSProperties['width'];
  minWidth?: number | string;
  maxWidth?: number | string;
  /** صنف CSS على th/td — لعرض أعمدة مرِن (em/ch) */
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
  /** بعض الشاشات تمرّر اتجاهًا كنص ديناميكي */
  sortDir?: 'asc' | 'desc' | string;
  onSort?: (key: string) => void;
  children?: ReactNode;
  /** أسفل الإطار — بعض الشاشات القديمة تعرض ملخصًا خارج tbody بدلاً من children */
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
  /**
   * بديل renderMobileCard — يعرض كل سجل كسطرين مضغوطَين (List-Row pattern).
   * عند تمريره يُعطى الأولوية على renderMobileCard في العروض الضيقة.
   */
  renderCompactRow?: (row: TRow, index: number) => ReactNode;
  stickyActionColumn?: boolean;
  tableId?: string;
  /** صنف إضافي على غلاف noorix-table-frame */
  frameClassName?: string;
  /** موروث — غير مستخدم داخلياً؛ يُبقي توافقاً مع شاشات قديمة */
  keyExtractor?: (row: TRow, index: number) => string | number;
};
