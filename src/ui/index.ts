/**
 * src/ui/index.ts — نقطة الاستيراد المركزية لمكتبة مكوّنات نووريكس
 *
 * الاستخدام:
 *   import { Button, Input, Card, Badge, Modal, AdaptiveSheet, Spinner } from '../../ui';
 *
 * أو باستيراد المكوّن مباشرة:
 *   import Button from '../../ui/Button';
 */

import './ui.css';
import './tableControls.css';

export { default as Button          } from './Button';
export { default as Input           } from './Input';
export { DateField, TransactionDatePicker, DateRangeField, DateFilterBar, YearDateFilter, MonthDateFilter, useDateFilter } from './date';
export type { DateFieldProps, TransactionDatePickerProps, DateRangeFieldProps, DateFilterBarProps, YearDateFilterProps, MonthDateFilterProps, DateFilterController } from './date';
export { default as Checkbox        } from './Checkbox';
export { default as Radio           } from './Radio';
export { default as FileInput       } from './FileInput';
export { default as FileTrigger     } from './FileTrigger';
export { default as EditableTextCell } from './EditableTextCell';
export { default as EditableNumberCell } from './EditableNumberCell';
export { default as EditableCheckboxCell } from './EditableCheckboxCell';
export { default as InlineSelect    } from './InlineSelect';
export { default as Card            } from './Card';
export { default as Badge           } from './Badge';
export { default as Modal           } from './Modal';
export { default as DialogActions   } from './DialogActions';
export type { DialogAction, DialogActionRole, DialogActionsProps } from './DialogActions';
export { default as PrintPreviewModal } from './PrintPreviewModal';
export { usePrintPreview } from './usePrintPreview';
export { default as AdaptiveSheet   } from './AdaptiveSheet';
export { useAdaptiveSheetNarrow } from './responsive';
export {
  NOORIX_BREAKPOINTS,
  maxWidthQuery,
  useIsMobile640,
  useIsNarrow700,
  useIsNarrow768,
  useMaxWidth,
  useMediaQuery,
} from './responsive';
export { NOORIX_DEFAULT_DEBOUNCE_MS, useDebouncedValue } from './timing';
export { default as Spinner         } from './Spinner';
export { default as Divider         } from './Divider';
export { default as FormRow         } from './FormRow';
export { default as ScreenTabs      } from './ScreenTabs';
export { default as ScreenShell     } from './ScreenShell';
export { default as ScreenTitle     } from './ScreenTitle';
export { default as Toolbar         } from './Toolbar';
export type { ToolbarProps          } from './Toolbar';
export { default as KebabMenu       } from './KebabMenu';
export { FilterToolbar, SearchableOptionsPicker, csvToFilterValues, filterValuesToCsv } from './filters';
export type { FilterToolbarProps } from './filters';
export type {
  SearchableOption,
  SearchableOptionsPickerMultiProps,
  SearchableOptionsPickerProps,
  SearchableOptionsPickerSingleProps,
} from './filters';
export { default as FilterScrollStrip } from './FilterScrollStrip';
export { default as ColorSwatch    } from './ColorSwatch';
export type { ColorSwatchProps     } from './ColorSwatch';
export { default as DataBar        } from './DataBar';
export type { DataBarProps         } from './DataBar';
export { default as FloatingPanel  } from './FloatingPanel';
export type { FloatingPanelProps   } from './FloatingPanel';
export { default as RuntimeStyleBox } from './RuntimeStyleBox';
export type { RuntimeStyleBoxProps } from './RuntimeStyleBox';
export { default as MetricCard      } from './MetricCard';
export { default as SummaryBar      } from './SummaryBar';
export type { SummaryBarItem, SummaryBarProps, SummaryBarTone } from './SummaryBar';
export { default as ChartState      } from './ChartState';
export type { ChartStateKind, ChartStateProps } from './ChartState';
export { default as SimpleTable     } from './SimpleTable';
export type { SimpleTableColumn, SimpleTableProps } from './SimpleTable';
export { default as MatrixTable     } from './MatrixTable';
export type { MatrixTableColumn, MatrixTableProps } from './MatrixTable';
export { FmtNum } from './FmtNum';

/**
 * SmartTable — الجدول الذكي المركزي
 * Pagination | Sort | Search | Loading Skeleton | Mobile Cards | Sticky Actions
 */
export {
  default as SmartTable,
  type SmartTableColumn,
  type SmartTableColumnSize,
  type SmartTableDataMode,
  type SmartTableFooterSegment,
  type SmartTableProps,
} from './SmartTable';

export { cn } from './cn';
