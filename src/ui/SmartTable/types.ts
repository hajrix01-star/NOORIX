import type { CSSProperties, ReactNode } from 'react';

/**
 * عمود جدول ذكي — `render` يستخدم `row: any` عمداً لبقاء التوافق مع شاشات تُضيّق نوع الصف.
 */
export type SmartTableColumn = {
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
  /** الصف يُعرَّف كـ `any` للتوافق مع الشاشات التي تمرّر أنواعًا ضيقة في الدالة دون كسر تعيين الأعمدة */
  render?: (value: unknown, row: any, index: number) => ReactNode;
};

export type SmartTableFooterSegment = {
  keys: string[];
  content?: ReactNode;
  className?: string;
};

export type SmartTableProps = {
  columns?: SmartTableColumn[];
  data?: Record<string, unknown>[];
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
  tableMinWidth?: number;
  compact?: boolean;
  showRowNumbers?: boolean;
  innerPadding?: number | string;
  tableLayout?: CSSProperties['tableLayout'];
  rowNumberWidth?: number | string;
  getRowClassName?: (row: any, index: number) => string | undefined;
  getRowStyle?: (row: any, index: number) => CSSProperties | undefined;
  renderMobileCard?: (row: any, index: number) => ReactNode;
  stripeMobileCards?: boolean;
  stickyActionColumn?: boolean;
  tableId?: string;
  /** موروث — غير مستخدم داخلياً؛ يُبقي توافقاً مع شاشات قديمة */
  keyExtractor?: (row: any, index: number) => string | number;
};
