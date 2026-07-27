import React, { type ReactNode } from 'react';
import { cn } from './cn';

/** Root spacing for a normal app screen inside `app-main`. */
export const SCREEN_SHELL_PAGE_CLASS =
  'nx-screen-shell nx-screen-shell--page flex min-w-0 flex-col gap-4 py-4 px-0 md:px-3 lg:px-6';

/** Wide operational workspaces: tables, dashboards, and dense ERP screens. */
export const SCREEN_SHELL_DATA_CLASS =
  'nx-screen-shell nx-screen-shell--data flex min-w-0 flex-col gap-4 py-4 px-0';

/** Financial and analytical reports with adaptive matrix/table widths. */
export const SCREEN_SHELL_REPORT_CLASS =
  'nx-screen-shell nx-screen-shell--report flex min-w-0 flex-col gap-4 py-4 px-0';

/** Reading and editing surfaces that should stay comfortable on wide screens. */
export const SCREEN_SHELL_FORM_CLASS =
  'nx-screen-shell nx-screen-shell--form mx-auto flex w-full min-w-0 max-w-[1180px] flex-col gap-4 py-4 px-0 md:px-3 lg:px-6';

/** Embedded inside a tab/card; no py/px to avoid doubled gutters. */
export const SCREEN_SHELL_EMBEDDED_CLASS =
  'nx-screen-shell nx-screen-shell--embedded flex min-w-0 flex-col gap-4';

export type ScreenShellVariant = 'page' | 'data' | 'report' | 'form' | 'embedded';

export type ScreenShellProps = {
  children?: ReactNode;
  className?: string;
  variant?: ScreenShellVariant;
  embedded?: boolean;
} & Record<string, unknown>;

const screenShellClassByVariant: Record<ScreenShellVariant, string> = {
  page: SCREEN_SHELL_PAGE_CLASS,
  data: SCREEN_SHELL_DATA_CLASS,
  report: SCREEN_SHELL_REPORT_CLASS,
  form: SCREEN_SHELL_FORM_CLASS,
  embedded: SCREEN_SHELL_EMBEDDED_CLASS,
};

export default function ScreenShell({
  children,
  className,
  variant = 'page',
  embedded = false,
  ...rest
}: ScreenShellProps) {
  const base = screenShellClassByVariant[embedded ? 'embedded' : variant];
  return (
    <div className={cn(base, className)} {...rest}>
      {children}
    </div>
  );
}
