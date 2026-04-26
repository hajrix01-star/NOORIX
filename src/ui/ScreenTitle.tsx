import React, { type ReactNode } from 'react';
import { cn } from './cn';

export type ScreenTitleProps = { children?: ReactNode; className?: string };

export default function ScreenTitle({ children, className = '' }: ScreenTitleProps) {
  return (
    <h1 className={cn('text-[20px] font-bold text-noorix-text m-0', className)}>
      {children}
    </h1>
  );
}
