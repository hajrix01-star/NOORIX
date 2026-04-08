import React from 'react';
import { cn } from './cn';

/** جذر شاشة قسم داخل `app-main` — يطابق معايير الهامش في المشروع */
export default function ScreenShell({ children, className, ...rest }) {
  return (
    <div className={cn('flex flex-col gap-4 py-4 px-0 md:px-3 lg:px-6', className)} {...rest}>
      {children}
    </div>
  );
}
