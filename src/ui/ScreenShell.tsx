import React, { type ReactNode } from 'react';
import { cn } from './cn';

/** قانون جذر الشاشة الكاملة داخل `app-main` — لا تكرّر هذا السطر يدوياً في شاشات جديدة */
export const SCREEN_SHELL_PAGE_CLASS =
  'flex min-w-0 flex-col gap-4 py-4 px-0 md:px-3 lg:px-6';

/** داخل تبويب أو كرت أب — بدون py/px حتى لا يتضاعف الهامش مع `ScreenShell` الخارجي */
export const SCREEN_SHELL_EMBEDDED_CLASS = 'flex min-w-0 flex-col gap-4';

export type ScreenShellProps = {
  children?: ReactNode;
  className?: string;
  variant?: string;
  embedded?: boolean;
} & Record<string, unknown>;

/**
 * جذر شاشة قسم داخل `app-main`.
 *
 * - **page (افتراضي):** يطبّق `SCREEN_SHELL_PAGE_CLASS` — على الجوال `px-0` والهامش الأفقي من `.app-main` فقط.
 * - **embedded** أو **variant="embedded":** `flex flex-col gap-4` فقط (مثل قائمة موظفين داخل تبويب الموارد البشرية).
 */
export default function ScreenShell({ children, className, variant = 'page', embedded = false, ...rest }: ScreenShellProps) {
  const isEmbedded = embedded || variant === 'embedded';
  const base = isEmbedded ? SCREEN_SHELL_EMBEDDED_CLASS : SCREEN_SHELL_PAGE_CLASS;
  return (
    <div className={cn(base, className)} {...rest}>
      {children}
    </div>
  );
}
