/**
 * src/ui/index.js — نقطة الاستيراد المركزية لمكتبة مكوّنات نووريكس
 *
 * الاستخدام:
 *   import { Button, Input, Card, Badge, Modal, Drawer, AdaptiveSheet, Spinner } from '../../ui';
 *
 * أو باستيراد المكوّن مباشرة:
 *   import Button from '../../ui/Button';
 */

import './ui.css';

export { default as Button    } from './Button';
export { default as Input     } from './Input';
export { default as Card      } from './Card';
export { default as Badge     } from './Badge';
export { default as Modal          } from './Modal';
export { default as Drawer         } from './Drawer';
export { default as AdaptiveSheet } from './AdaptiveSheet';
export { useAdaptiveSheetNarrow, ADAPTIVE_SHEET_BREAKPOINT_PX } from './AdaptiveSheet';
export { default as Spinner   } from './Spinner';
export { default as Divider   } from './Divider';
export { default as FormRow   } from './FormRow';
export { default as ScreenTabs } from './ScreenTabs';
export { default as ScreenShell } from './ScreenShell';
export { default as ScreenTitle } from './ScreenTitle';
export { default as KebabMenu } from './KebabMenu';

/**
 * SmartTable — الجدول الذكي المركزي
 * Pagination | Sort | Search | Loading Skeleton | Mobile Cards | Sticky Actions
 * مصدر: src/components/common/SmartTable.jsx (يُستدعى من ui/ للحفاظ على مرجع واحد)
 */
export { default as SmartTable } from '../components/common/SmartTable';

export { SurfaceCard, ExecCard, StatCard } from './Card';
export { BADGE_COLORS } from './Badge';
export { cn } from './cn';
