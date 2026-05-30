/**
 * غلاف موحّد لتبويبات HR القائمة على الجوال: تحكم بـ px-4، صفوف بعرض الكرت.
 */
import React, { type ReactNode } from 'react';
import { ScreenShell, cn } from '../../../ui';
import {
  HR_EMBEDDED_SHELL_FLAT_CLASS,
  HR_FLAT_LIST_CLASS,
  HR_TAB_CONTROLS_CLASS,
} from '../hrWorkspaceLayout';

export type HrFlatListTabShellProps = {
  embedded?: boolean;
  shellClassName?: string;
  controls: ReactNode;
  /** بين التحكم والقائمة (مثل شريط إضافة سريع للإقامات) */
  beforeList?: ReactNode;
  list: ReactNode;
  children?: ReactNode;
};

export function HrFlatListTabShell({
  embedded,
  shellClassName,
  controls,
  beforeList,
  list,
  children,
}: HrFlatListTabShellProps) {
  if (!embedded) {
    return (
      <>
        {controls}
        {beforeList}
        {list}
        {children}
      </>
    );
  }

  return (
    <ScreenShell embedded className={cn(HR_EMBEDDED_SHELL_FLAT_CLASS, shellClassName)}>
      <div className={HR_TAB_CONTROLS_CLASS}>{controls}</div>
      {beforeList ? (
        <div className={cn(HR_TAB_CONTROLS_CLASS, 'pt-0')}>{beforeList}</div>
      ) : null}
      <div className={HR_FLAT_LIST_CLASS}>{list}</div>
      {children}
    </ScreenShell>
  );
}
