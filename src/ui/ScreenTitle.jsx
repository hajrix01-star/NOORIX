import React from 'react';
import { cn } from './cn';

export default function ScreenTitle({ children, className }) {
  return (
    <h1 className={cn('text-[20px] font-bold text-noorix-text m-0', className)}>
      {children}
    </h1>
  );
}
